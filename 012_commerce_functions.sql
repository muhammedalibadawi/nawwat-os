-- ============================================================
-- NawwatOS — Migration 012_commerce_functions
-- Commerce Integration Layer - Helper Functions & Triggers
-- ============================================================

BEGIN;

-- ============================================================
-- 0) Job Idempotency Index
-- ============================================================
-- Required to support idempotent sync job enqueueing
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_jobs_idempotency 
    ON public.sync_jobs(tenant_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 1) Helper: Resolve canonical_sku_id from item_id
-- ============================================================
-- Invoker: Normal (Invoker's RLS applies)
-- Caller: Frontend/Authenticated User OR Internal helpers
-- Note: This function depends on public.current_tenant_id(), so it is a JWT-context helper. 
-- It is NOT a generic service-role helper unless the tenant context is explicitly established beforehand.
CREATE OR REPLACE FUNCTION public.get_canonical_sku_for_item(p_item_id UUID)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_canonical_sku_id UUID;
BEGIN
    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'NawwatOS Context Error: No active tenant ID found. JWT context is required.';
    END IF;

    SELECT id INTO v_canonical_sku_id
    FROM public.canonical_skus
    WHERE tenant_id = v_tenant_id
      AND item_id = p_item_id;

    RETURN v_canonical_sku_id;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.get_canonical_sku_for_item(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_canonical_sku_for_item(UUID) TO authenticated, service_role;

-- ============================================================
-- 2) Core: Create Sync Job (Idempotent)
-- ============================================================
-- Invoker: SECURITY DEFINER
-- Search Path: public, pg_temp (prevents hijacking)
-- Caller: Backend/Service-Role ONLY
-- Note: Accepts an optional p_tenant_id. If missing, attempts to use JWT context.
-- Explicitly restricted to service_role to prevent authenticated users from 
-- creating arbitrary sync jobs.
CREATE OR REPLACE FUNCTION public.create_sync_job(
    p_channel_account_id UUID,
    p_job_type TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_priority INT DEFAULT 0,
    p_idempotency_key TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_job_id UUID;
BEGIN
    -- Fallback to JWT context if explicit tenant ID is not provided
    v_tenant_id := COALESCE(p_tenant_id, public.current_tenant_id());
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'NawwatOS Context Error: Tenant ID must be provided directly or available via JWT.';
    END IF;

    -- Basic tenant verification: ensure the channel account belongs to the tenant
    IF p_channel_account_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.channel_accounts 
            WHERE id = p_channel_account_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'NawwatOS Security Error: Channel account not found or does not belong to the active tenant.';
        END IF;
    END IF;

    -- Idempotent Insertion (ON CONFLICT using the partial unique index)
    INSERT INTO public.sync_jobs (
        tenant_id, 
        channel_account_id, 
        job_type, 
        payload, 
        priority, 
        idempotency_key
    )
    VALUES (
        v_tenant_id, 
        p_channel_account_id, 
        p_job_type, 
        p_payload, 
        p_priority, 
        p_idempotency_key
    )
    ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET 
        updated_at = now() -- Touch the row so caller knows it existed
    RETURNING id INTO v_job_id;

    -- TODO: Audit Integration
    -- Call public.stamp_audit_chain() here when the audit layer is finalized.

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_sync_job(UUID, TEXT, JSONB, INT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sync_job(UUID, TEXT, JSONB, INT, TEXT, UUID) TO service_role;


-- ============================================================
-- 3) Core: Log Inbound Webhook (Idempotent)
-- ============================================================
-- Invoker: SECURITY DEFINER
-- Search Path: public, pg_temp
-- Caller: Edge Function / Webhook Receiver (Service-Role equivalent)
-- Note: An explicit p_tenant_id is heavily encouraged here, as webhooks rarely have JWTs.
CREATE OR REPLACE FUNCTION public.log_inbound_webhook(
    p_channel_account_id UUID,
    p_event_type TEXT,
    p_payload JSONB,
    p_idempotency_key TEXT DEFAULT NULL,
    p_source_event_id TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_event_id UUID;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, public.current_tenant_id());
    IF v_tenant_id IS NULL THEN
         RAISE EXCEPTION 'NawwatOS Context Error: Webhook receiver must provide explicit tenant_id or set JWT context.';
    END IF;

    -- Validate channel account ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.channel_accounts 
        WHERE id = p_channel_account_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'NawwatOS Security Error: Channel account not found or does not belong to the active tenant.';
    END IF;

    -- Idempotent insertion using the table's existing unique index
    -- uq_webhook_dedupe: (tenant_id, channel_account_id, idempotency_key)
    INSERT INTO public.inbound_webhook_events (
        tenant_id,
        channel_account_id,
        event_type,
        payload,
        idempotency_key,
        source_event_id
    )
    VALUES (
        v_tenant_id,
        p_channel_account_id,
        p_event_type,
        p_payload,
        p_idempotency_key,
        p_source_event_id
    )
    ON CONFLICT (tenant_id, channel_account_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET 
        updated_at = now() -- Minimal touch to return existing ID safely
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.log_inbound_webhook(UUID, TEXT, JSONB, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_inbound_webhook(UUID, TEXT, JSONB, TEXT, TEXT, UUID) TO service_role;


-- ============================================================
-- 4) Action: Enqueue Inventory Push 
-- ============================================================
-- Invoker: SECURITY DEFINER
-- Search Path: public, pg_temp
-- Caller: Frontend/Authenticated User (User-triggered UI action)
-- Note: This is an explicit frontend manual action wrapper. Because create_sync_job 
-- is now properly shielded and restricted to service_role, this function must be 
-- SECURITY DEFINER to escalate privileges safely. It enforces strict role checks 
-- (owner or branch_manager only) before calling the core job creator.
CREATE OR REPLACE FUNCTION public.enqueue_inventory_push(
    p_item_id UUID,
    p_channel_account_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_canonical_sku_id UUID;
    v_job_id UUID;
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

    -- Resolve canonical SKU securely within caller's context
    v_canonical_sku_id := public.get_canonical_sku_for_item(p_item_id);
    IF v_canonical_sku_id IS NULL THEN
        RAISE EXCEPTION 'Cannot enqueue inventory push: Item % has no mapped canonical_sku.', p_item_id;
    END IF;

    -- Delegate to the elevated job creation function.
    -- Because this function is SECURITY DEFINER, it has permissions to call create_sync_job.
    -- TODO: This frontend wrapper currently does not supply a deterministic idempotency_key.
    -- Repeated UI clicks may enqueue duplicate inventory sync jobs.
    -- In a later pass, generate a stable key such as:
    -- `inventory_push:{tenant_id}:{item_id}:{channel_account_id}`
    -- or accept a request-scoped key from the frontend.
    SELECT public.create_sync_job(
        p_channel_account_id,
        'inventory_push',
        jsonb_build_object(
            'tenant_id', v_tenant_id,
            'item_id', p_item_id,
            'canonical_sku_id', v_canonical_sku_id
        ),
        10, -- Priority 10 for inventory updates
        NULL, -- Dynamically generate, or allow a caller ID here in future
        v_tenant_id -- Explicit backend handoff
    ) INTO v_job_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enqueue_inventory_push(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_inventory_push(UUID, UUID) TO authenticated;

COMMIT;
