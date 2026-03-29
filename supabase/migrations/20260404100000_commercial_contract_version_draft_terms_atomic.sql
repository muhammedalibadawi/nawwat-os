-- Draft (non-current) contract version + optional normalized terms in one transaction.
BEGIN;

CREATE OR REPLACE FUNCTION public.commercial_contract_version_create_draft_with_terms(
    p_contract_id UUID,
    p_version_number INT DEFAULT NULL,
    p_commission_summary TEXT DEFAULT NULL,
    p_payment_fee_summary TEXT DEFAULT NULL,
    p_shipping_responsibility_summary TEXT DEFAULT NULL,
    p_return_expiry_summary TEXT DEFAULT NULL,
    p_settlement_terms_summary TEXT DEFAULT NULL,
    p_terms JSONB DEFAULT '[]'::jsonb
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
    elem JSONB;
    v_group TEXT;
    v_code TEXT;
    v_label TEXT;
    v_summary TEXT;
    v_config JSONB;
    v_sort INT;
    v_active BOOLEAN;
BEGIN
    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant context is missing';
    END IF;

    v_role := public.current_user_role();
    IF v_role IS NULL OR v_role NOT IN ('owner', 'branch_manager') THEN
        RAISE EXCEPTION 'Permission denied for role %', v_role;
    END IF;

    IF p_terms IS NOT NULL AND jsonb_typeof(p_terms) <> 'array' THEN
        RAISE EXCEPTION 'p_terms must be a JSON array';
    END IF;

    PERFORM 1
      FROM public.commercial_contracts AS c
     WHERE c.id = p_contract_id
       AND c.tenant_id = v_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract not found or access denied';
    END IF;

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
        FALSE,
        NULLIF(trim(p_commission_summary), ''),
        NULLIF(trim(p_payment_fee_summary), ''),
        NULLIF(trim(p_shipping_responsibility_summary), ''),
        NULLIF(trim(p_return_expiry_summary), ''),
        NULLIF(trim(p_settlement_terms_summary), '')
    )
    RETURNING id
      INTO v_version_id;

    FOR elem IN SELECT jsonb_array_elements(COALESCE(p_terms, '[]'::jsonb))
    LOOP
        v_group := trim(elem->>'term_group');
        IF v_group IS NULL
            OR v_group NOT IN (
                'commission',
                'payment_fee',
                'shipping_responsibility',
                'return_expiry',
                'settlement'
            )
        THEN
            RAISE EXCEPTION 'Invalid or missing term_group for commercial contract version term';
        END IF;

        v_code := trim(elem->>'term_code');
        IF v_code IS NULL OR length(v_code) = 0 THEN
            RAISE EXCEPTION 'term_code is required for commercial contract version term';
        END IF;

        v_label := trim(elem->>'label');
        IF v_label IS NULL OR length(v_label) = 0 THEN
            RAISE EXCEPTION 'label is required for commercial contract version term';
        END IF;

        v_summary := NULLIF(trim(elem->>'summary'), '');

        v_config := COALESCE(elem->'term_config', '{}'::jsonb);
        IF jsonb_typeof(v_config) <> 'object' THEN
            RAISE EXCEPTION 'term_config must be a JSON object';
        END IF;

        IF elem ? 'sort_order' AND elem->>'sort_order' IS NOT NULL AND elem->>'sort_order' <> '' THEN
            v_sort := (elem->>'sort_order')::INT;
        ELSE
            v_sort := 0;
        END IF;
        IF v_sort < 0 THEN
            RAISE EXCEPTION 'sort_order must be >= 0';
        END IF;

        IF elem ? 'is_active' AND elem->'is_active' IS NOT NULL THEN
            v_active := (elem->>'is_active')::BOOLEAN;
        ELSE
            v_active := TRUE;
        END IF;

        INSERT INTO public.commercial_contract_version_terms (
            tenant_id,
            contract_version_id,
            term_group,
            term_code,
            label,
            summary,
            term_config,
            sort_order,
            is_active
        ) VALUES (
            v_tenant_id,
            v_version_id,
            v_group,
            v_code,
            v_label,
            v_summary,
            v_config,
            v_sort,
            v_active
        );
    END LOOP;

    RETURN v_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.commercial_contract_version_create_draft_with_terms(
    UUID,
    INT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commercial_contract_version_create_draft_with_terms(
    UUID,
    INT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    JSONB
) TO authenticated;

COMMIT;
