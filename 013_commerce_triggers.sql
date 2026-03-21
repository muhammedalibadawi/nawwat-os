-- ============================================================
-- NawwatOS — Migration 013_commerce_triggers
-- Commerce Integration Layer - Inventory Triggers
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Internal Helper: Enqueue Inventory Push (Backend-Safe)
-- ============================================================
-- Invoker: SECURITY DEFINER
-- Search Path: public, pg_temp
-- Caller: Database Triggers (Service-Role equivalent execution path)
-- Note: This is an internal, backend-only helper. It does NOT depend on JWT context.
-- It requires an explicit tenant_id. It is used exclusively by the database triggers
-- to safely enqueue sync jobs without exposing arbitrary enqueue power to the frontend.
CREATE OR REPLACE FUNCTION public.enqueue_inventory_push_internal(
    p_tenant_id UUID,
    p_item_id UUID,
    p_channel_account_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_canonical_sku_id UUID;
    v_idempotency_key TEXT;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- 1. Resolve canonical SKU (explicit tenant context, bypassing JWT helper)
    SELECT id INTO v_canonical_sku_id
    FROM public.canonical_skus
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id;

    -- If the item isn't mapped to a canonical SKU, it's not a commerce item. Exit silently.
    IF v_canonical_sku_id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Duplicate Protection / Sync Storm Avoidance
    -- Strategy: We generate a deterministic windowed idempotency key.
    -- If multiple movements happen for the same item within the same 5-minute window,
    -- they collapse into a single sync job constraint violation (handled safely by create_sync_job's ON CONFLICT).
    -- window_start rounds down to the nearest 5 minutes.
    v_window_start := date_trunc('hour', now()) + date_part('minute', now())::int / 5 * interval '5 min';
    
    v_idempotency_key := 'inv_push:' || p_tenant_id::TEXT || ':' || p_item_id::TEXT || ':' || extract(epoch FROM v_window_start)::TEXT;

    -- Optional Alternative Strategy check: Are there already 'queued' jobs for this item?
    -- This is slightly slower but prevents the queue from growing if workers go offline.
    IF EXISTS (
        SELECT 1 FROM public.sync_jobs 
        WHERE tenant_id = p_tenant_id 
          AND job_type = 'inventory_push' 
          AND status IN ('queued', 'running')
          AND payload->>'item_id' = p_item_id::TEXT
          AND created_at >= now() - interval '5 minutes'
    ) THEN
        -- A recent job is already pending for this item. Skip enqueueing a redundant one.
        RETURN;
    END IF;

    -- 3. Enqueue the sync job using the secured core function
    -- Note: We pass the explicit p_tenant_id to safely bypass JWT context requirements in the backend.
    PERFORM public.create_sync_job(
        p_channel_account_id,
        'inventory_push',
        jsonb_build_object(
            'tenant_id', p_tenant_id,
            'item_id', p_item_id,
            'canonical_sku_id', v_canonical_sku_id,
            'trigger', 'auto_inventory_movement'
        ),
        10, -- Priority 10 for inventory updates
        v_idempotency_key, 
        p_tenant_id -- Explicit backend handoff
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.enqueue_inventory_push_internal(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_inventory_push_internal(UUID, UUID, UUID) TO service_role;


-- ============================================================
-- 2) Trigger Function: React to Inventory Movements
-- ============================================================
-- Invoker: Normal (Trigger context operates as table owner / service-role)
-- Source Table: public.inventory_movements
-- Note: Reacts to any immutable ledger movement and queues a sync if it's a commerce item.
CREATE OR REPLACE FUNCTION public.trg_inventory_movement_enqueue_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- We only care about AFTER INSERT on the movement ledger.
    -- (Updates/Deletes are blocked by the trg_im_immutable trigger anyway).
    
    -- Call the backend-safe internal helper, passing the required explicit tenant context.
    -- This isolates the trigger from needing any frontend JWT context.
    PERFORM public.enqueue_inventory_push_internal(
        NEW.tenant_id,
        NEW.item_id,
        NULL -- Broadcast to all channels
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Not meant to be called directly, only by the DB trigger system.
REVOKE ALL ON FUNCTION public.trg_inventory_movement_enqueue_sync() FROM PUBLIC;


-- ============================================================
-- 3) Attach Trigger to Source Table
-- ============================================================
-- Source of Truth: `public.inventory_movements`
-- Why not `public.stock_levels`? 
-- In NawwatOS v5.1, `inventory_movements` is the immutable double-entry ledger for items. 
-- `stock_levels` is a derived balance table updated via the `update_stock_on_movement` trigger.
-- Relying on the immutable event stream (`inventory_movements`) prevents race conditions 
-- and guarantees we catch every discrete stock change exactly once.
DROP TRIGGER IF EXISTS trg_commerce_inventory_push ON public.inventory_movements;

CREATE TRIGGER trg_commerce_inventory_push
    AFTER INSERT ON public.inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_inventory_movement_enqueue_sync();

COMMIT;
