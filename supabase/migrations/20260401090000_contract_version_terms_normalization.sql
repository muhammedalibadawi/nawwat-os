BEGIN;

CREATE TABLE public.commercial_contract_version_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_version_id UUID NOT NULL,
    term_group TEXT NOT NULL
        CHECK (term_group IN ('commission', 'payment_fee', 'shipping_responsibility', 'return_expiry', 'settlement')),
    term_code TEXT NOT NULL,
    label TEXT NOT NULL,
    summary TEXT,
    term_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, contract_version_id, term_group, term_code),
    CONSTRAINT commercial_contract_version_terms_version_fk
        FOREIGN KEY (tenant_id, contract_version_id)
        REFERENCES public.commercial_contract_versions(tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT commercial_contract_version_terms_label_not_blank
        CHECK (char_length(btrim(label)) > 0),
    CONSTRAINT commercial_contract_version_terms_code_not_blank
        CHECK (char_length(btrim(term_code)) > 0),
    CONSTRAINT commercial_contract_version_terms_config_is_object
        CHECK (jsonb_typeof(term_config) = 'object')
);

CREATE INDEX idx_contract_version_terms_tenant_version
    ON public.commercial_contract_version_terms(tenant_id, contract_version_id, sort_order, created_at);

CREATE INDEX idx_contract_version_terms_group
    ON public.commercial_contract_version_terms(tenant_id, term_group)
    WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_commercial_contract_version_terms_updated_at ON public.commercial_contract_version_terms;
CREATE TRIGGER trg_commercial_contract_version_terms_updated_at
    BEFORE UPDATE ON public.commercial_contract_version_terms
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.commercial_contract_version_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_contract_version_terms: jwt_select_admin"
    ON public.commercial_contract_version_terms FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contract_version_terms: jwt_insert_admin"
    ON public.commercial_contract_version_terms FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contract_version_terms: jwt_update_admin"
    ON public.commercial_contract_version_terms FOR UPDATE TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

COMMIT;
