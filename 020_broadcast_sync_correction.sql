-- ============================================================
-- NawwatOS — Migration 020_broadcast_sync_correction
-- Replaces enqueue_inventory_push_internal with explicit fan-out
-- ============================================================

BEGIN;

/*  
  1. Revise Internal Helper (Single Source of Truth for Fan-Out logic)
     - `p_channel_account_id` IS NOT NULL => Enqueues one explicit job
     - `p_channel_account_id` IS NULL     => Fans out array-style across eligible active mapped channels
*/
CREATE OR REPLACE FUNCTION public.enqueue_inventory_push_internal(
    p_tenant_id UUID,
    p_item_id UUID,
    p_channel_account_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_canonical_sku_id UUID;
    v_window_start TIMESTAMPTZ;
    v_epoch TEXT;
    v_idempotency_key TEXT;
    r RECORD;
BEGIN
    -- 1. Resolve canonical SKU (explicit tenant context)
    SELECT id INTO v_canonical_sku_id
    FROM public.canonical_skus
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id;

    -- If the item isn't mapped to a canonical SKU, it's not a commerce item. Exit silently.
    IF v_canonical_sku_id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Duplicate Protection / Sync Storm Avoidance
    -- Window_start rounds down to the nearest 5 minutes
    v_window_start := date_trunc('hour', now()) + date_part('minute', now())::int / 5 * interval '5 min';
    v_epoch := extract(epoch FROM v_window_start)::int::TEXT;

    -- 3. Fan-out or Single Dispatch
    IF p_channel_account_id IS NOT NULL THEN
        -- Single explicit channel enqueue
        v_idempotency_key := 'inv_push:' || p_tenant_id::TEXT || ':' || p_item_id::TEXT || ':' || p_channel_account_id::TEXT || ':' || v_epoch;
        
        PERFORM public.create_sync_job(
            p_channel_account_id,
            'inventory_push',
            jsonb_build_object(
                'tenant_id', p_tenant_id,
                'item_id', p_item_id,
                'canonical_sku_id', v_canonical_sku_id,
                'trigger', 'targeted'
            ),
            10,
            v_idempotency_key, 
            p_tenant_id
        );
    ELSE
        -- Fan out across eligible active channel accounts with confirmed mapping
        FOR r IN (
            SELECT DISTINCT ca.id AS target_channel_id
            FROM public.sku_mappings sm
            JOIN public.channel_catalog_items cci 
              ON cci.id = sm.channel_item_id 
             AND cci.tenant_id = sm.tenant_id
            JOIN public.channel_accounts ca 
              ON ca.id = cci.channel_account_id 
             AND ca.tenant_id = cci.tenant_id
            WHERE sm.tenant_id = p_tenant_id
              AND sm.canonical_sku_id = v_canonical_sku_id
              AND sm.mapping_status = 'confirmed'
              AND ca.connection_status = 'connected'
              AND cci.status = 'active'
        ) LOOP
            v_idempotency_key := 'inv_push:' || p_tenant_id::TEXT || ':' || p_item_id::TEXT || ':' || r.target_channel_id::TEXT || ':' || v_epoch;
            
            PERFORM public.create_sync_job(
                r.target_channel_id,
                'inventory_push',
                jsonb_build_object(
                    'tenant_id', p_tenant_id,
                    'item_id', p_item_id,
                    'canonical_sku_id', v_canonical_sku_id,
                    'trigger', 'broadcast'
                ),
                10,
                v_idempotency_key,
                p_tenant_id
            );
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Ensure grants are consistent
REVOKE ALL ON FUNCTION public.enqueue_inventory_push_internal(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_inventory_push_internal(UUID, UUID, UUID) TO service_role;


/*  
  2. Revise Frontend UI Action Wrapper 
     - Dropping and recreating to update the return type from UUID down to VOID 
       since the internal target might fan out to multiple job UUIDs.
     - We keep it explicitly as a safe-wrapper relaying `p_channel_account_id`.
*/
DROP FUNCTION IF EXISTS public.enqueue_inventory_push(UUID, UUID);

CREATE OR REPLACE FUNCTION public.enqueue_inventory_push(
    p_item_id UUID,
    p_channel_account_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
BEGIN
    v_tenant_id := public.current_tenant_id(); 
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'NawwatOS Context Error: No active tenant ID found.';
    END IF;

    v_role := public.current_user_role();
    
    -- Explicit Role Verification (Tenant Safety Rule)
    -- Allow strictly only owner and branch_manager. Reject cashier.
    IF v_role NOT IN ('owner', 'branch_manager') THEN
        RAISE EXCEPTION 'NawwatOS Access Denied: Only owners and branch managers can enqueue inventory pushes. Current role: %', v_role;
    END IF;

    -- Delegate cleanly to the protected internal Fan-Out logic.
    -- The internal helper acts as our single determinism checkpoint.
    PERFORM public.enqueue_inventory_push_internal(
        v_tenant_id,
        p_item_id,
        p_channel_account_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enqueue_inventory_push(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_inventory_push(UUID, UUID) TO authenticated;

COMMIT;
