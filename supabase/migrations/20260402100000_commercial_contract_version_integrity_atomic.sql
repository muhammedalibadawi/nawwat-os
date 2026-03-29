-- NawwatOS — Commercial contract version integrity + atomic current-version promotion
BEGIN;

UPDATE public.commercial_contracts AS c
SET current_version_id = NULL
WHERE c.current_version_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM public.commercial_contract_versions AS v
     WHERE v.id = c.current_version_id
       AND v.tenant_id = c.tenant_id
       AND v.contract_id = c.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_commercial_contract_versions_tenant_contract_version_id
    ON public.commercial_contract_versions(tenant_id, contract_id, id);

ALTER TABLE public.commercial_contracts
    DROP CONSTRAINT IF EXISTS commercial_contracts_current_version_fk;

ALTER TABLE public.commercial_contracts
    ADD CONSTRAINT commercial_contracts_current_version_contract_fk
    FOREIGN KEY (tenant_id, id, current_version_id)
    REFERENCES public.commercial_contract_versions(tenant_id, contract_id, id)
    ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.commercial_contract_version_create_and_set_current(
    p_contract_id UUID,
    p_promote_version_id UUID DEFAULT NULL,
    p_version_number INT DEFAULT NULL,
    p_commission_summary TEXT DEFAULT NULL,
    p_payment_fee_summary TEXT DEFAULT NULL,
    p_shipping_responsibility_summary TEXT DEFAULT NULL,
    p_return_expiry_summary TEXT DEFAULT NULL,
    p_settlement_terms_summary TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_version_id UUID;
    v_next_number INT;
BEGIN
    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context is missing';
    END IF;

    v_role := public.current_user_role();
    IF v_role IS NULL OR v_role NOT IN ('owner', 'branch_manager') THEN
        RAISE EXCEPTION 'Permission denied for role %', v_role;
    END IF;

    PERFORM 1
      FROM public.commercial_contracts AS c
     WHERE c.id = p_contract_id
       AND c.tenant_id = v_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract not found or access denied';
    END IF;

    UPDATE public.commercial_contract_versions
       SET is_current = FALSE
     WHERE tenant_id = v_tenant_id
       AND contract_id = p_contract_id;

    IF p_promote_version_id IS NOT NULL THEN
        UPDATE public.commercial_contract_versions
           SET is_current = TRUE
         WHERE id = p_promote_version_id
           AND tenant_id = v_tenant_id
           AND contract_id = p_contract_id
        RETURNING id
          INTO v_version_id;

        IF v_version_id IS NULL THEN
            RAISE EXCEPTION 'Version not found or does not belong to this contract';
        END IF;
    ELSE
        v_next_number := p_version_number;
        IF v_next_number IS NULL THEN
            SELECT COALESCE(MAX(version_number), 0) + 1
              INTO v_next_number
              FROM public.commercial_contract_versions
             WHERE tenant_id = v_tenant_id
               AND contract_id = p_contract_id;
        END IF;

        INSERT INTO public.commercial_contract_versions (
            tenant_id,
            contract_id,
            version_number,
            is_current,
            commission_summary,
            payment_fee_summary,
            shipping_responsibility_summary,
            return_expiry_summary,
            settlement_terms_summary
        ) VALUES (
            v_tenant_id,
            p_contract_id,
            v_next_number,
            TRUE,
            NULLIF(trim(p_commission_summary), ''),
            NULLIF(trim(p_payment_fee_summary), ''),
            NULLIF(trim(p_shipping_responsibility_summary), ''),
            NULLIF(trim(p_return_expiry_summary), ''),
            NULLIF(trim(p_settlement_terms_summary), '')
        )
        RETURNING id
          INTO v_version_id;
    END IF;

    UPDATE public.commercial_contracts
       SET current_version_id = v_version_id
     WHERE id = p_contract_id
       AND tenant_id = v_tenant_id;

    RETURN v_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.commercial_contract_version_create_and_set_current(
    UUID,
    UUID,
    INT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commercial_contract_version_create_and_set_current(
    UUID,
    UUID,
    INT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT
) TO authenticated;

COMMIT;