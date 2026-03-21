-- ============================================================
-- NawwatOS — Migration 016_salla_retry_rpc
-- Commerce Integration Layer - Webhook Retry Helper
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Helper: Retry Inbound Webhook
-- ============================================================
-- Invoker: SECURITY DEFINER
-- Search Path: public, pg_temp
-- Caller: Authenticated Frontend Users (owner, branch_manager)
-- Action: Resets a 'failed' webhook event securely back to 'retrying'
--         without creating duplicate idempotency_key records.
CREATE OR REPLACE FUNCTION public.retry_inbound_webhook(p_event_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_updated_id UUID;
BEGIN
    -- 1. Resolve Tenant Context
    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'NawwatOS Context Error: No active tenant ID found.';
    END IF;

    -- 2. Validate Role Privileges
    -- Only 'owner' and 'branch_manager' are authorized to trigger retries.
    v_role := public.current_user_role();
    IF v_role NOT IN ('owner', 'branch_manager') THEN
        RAISE EXCEPTION 'Insufficient Privileges: Only owner or branch_manager can retry webhooks.';
    END IF;

    -- 3. Execute the Safe Retry Mutation
    -- This natively blocks retrying a 'completed' or 'processing' job
    -- by strictly requiring status = 'failed'.
    UPDATE public.inbound_webhook_events
    SET 
        status = 'retrying',
        error_message = NULL,
        processed_at = NULL,
        updated_at = now()
    WHERE id = p_event_id
      AND tenant_id = v_tenant_id   -- Enforce strict tenant isolation
      AND status = 'failed'         -- Atomic safety lock
    RETURNING id INTO v_updated_id;

    -- 4. Return boolean result indicating success
    IF v_updated_id IS NOT NULL THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Restrict base execution, granting only to authenticated users and backend
REVOKE ALL ON FUNCTION public.retry_inbound_webhook(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_inbound_webhook(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_inbound_webhook(UUID) TO service_role;

COMMIT;
