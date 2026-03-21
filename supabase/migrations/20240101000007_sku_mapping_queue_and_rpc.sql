-- ============================================================
-- NawwatOS — Migration 026_sku_mapping_queue_and_rpc
-- SKU Mapping Queue View & Confirmation RPC
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Actionable Queue View
-- ============================================================
CREATE OR REPLACE VIEW public.commerce_mapping_queue_v WITH (security_invoker = true) AS
SELECT 
    sm.id AS mapping_id,
    sm.tenant_id,
    sm.canonical_sku_id,
    cs.item_id,
    cs.sku,
    cci.channel_account_id,
    ca.channel_name,
    sm.channel_item_id,
    cci.external_variant_id,
    sm.mapping_status,
    sm.confidence_score,
    sm.rejected_reason,
    sm.confirmed_at,
    sm.last_validated_at
FROM public.sku_mappings sm
JOIN public.canonical_skus cs 
  ON cs.id = sm.canonical_sku_id 
 AND cs.tenant_id = sm.tenant_id
JOIN public.channel_catalog_items cci 
  ON cci.id = sm.channel_item_id 
 AND cci.tenant_id = sm.tenant_id
JOIN public.channel_accounts ca 
  ON ca.id = cci.channel_account_id 
 AND ca.tenant_id = sm.tenant_id;


-- ============================================================
-- 2) Confirmation RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_sku_mapping(p_mapping_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_role TEXT;
    v_mapping_status TEXT;
BEGIN
    -- 1. Standard NawwatOS Tenancy Extraction
    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context is missing';
    END IF;

    -- 2. Validate Required Role (Phase 2 constraint)
    v_user_role := public.current_user_role();
    IF v_user_role NOT IN ('owner', 'branch_manager', 'master_admin') THEN
        RAISE EXCEPTION 'Permission denied. Role % cannot confirm SKU mappings.', v_user_role;
    END IF;

    -- 3. Row Lock & RLS Check
    SELECT mapping_status 
      INTO v_mapping_status
      FROM public.sku_mappings
     WHERE id = p_mapping_id
       AND tenant_id = v_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mapping not found or does not belong to the active tenant.';
    END IF;

    -- 4. Transition Logic Guard
    IF v_mapping_status = 'confirmed' THEN
        RETURN true; -- Operation is idempotent
    ELSIF v_mapping_status NOT IN ('suggested', 'review_required') THEN
        RAISE EXCEPTION 'Cannot confirm an inactive or rejected mapping. Must be "suggested" or "review_required".';
    END IF;

    -- 5. Authorized Write Path execution
    UPDATE public.sku_mappings
       SET mapping_status = 'confirmed',
           confirmed_at = now(),
           last_validated_at = now(),
           rejected_reason = NULL,
           confirmed_by = auth.uid()
     WHERE id = p_mapping_id
       AND tenant_id = v_tenant_id;

    RETURN true;
END;
$$;

-- Explicitly revoke public access, only allow authenticated (which RLS/RPC then filters)
REVOKE ALL ON FUNCTION public.confirm_sku_mapping(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_sku_mapping(UUID) TO authenticated;

COMMIT;
