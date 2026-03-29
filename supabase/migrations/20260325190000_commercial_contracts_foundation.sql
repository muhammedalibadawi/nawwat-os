-- NawwatOS Commercial contracts + versions
BEGIN;

CREATE TABLE public.commercial_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_code TEXT NOT NULL,
    name TEXT NOT NULL,
    channel_account_id UUID,
    counterparty_contact_id UUID,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'suspended', 'ended')),
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    current_version_id UUID,
    summary TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, contract_code),
    CONSTRAINT commercial_contracts_channel_fk
        FOREIGN KEY (tenant_id, channel_account_id)
        REFERENCES public.channel_accounts(tenant_id, id)
        ON DELETE SET NULL,
    CONSTRAINT commercial_contracts_counterparty_fk
        FOREIGN KEY (tenant_id, counterparty_contact_id)
        REFERENCES public.contacts(tenant_id, id)
        ON DELETE SET NULL
);

CREATE INDEX idx_commercial_contracts_tenant ON public.commercial_contracts(tenant_id);
CREATE INDEX idx_commercial_contracts_channel ON public.commercial_contracts(tenant_id, channel_account_id)
    WHERE channel_account_id IS NOT NULL;

CREATE TABLE public.commercial_contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL,
    version_number INT NOT NULL CHECK (version_number >= 1),
    is_current BOOLEAN NOT NULL DEFAULT false,
    commission_summary TEXT,
    payment_fee_summary TEXT,
    shipping_responsibility_summary TEXT,
    return_expiry_summary TEXT,
    settlement_terms_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, contract_id, version_number),
    CONSTRAINT commercial_contract_versions_contract_fk
        FOREIGN KEY (tenant_id, contract_id)
        REFERENCES public.commercial_contracts(tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX idx_commercial_contract_versions_tenant_contract
    ON public.commercial_contract_versions(tenant_id, contract_id);

CREATE UNIQUE INDEX uq_commercial_contract_versions_one_current
    ON public.commercial_contract_versions(tenant_id, contract_id)
    WHERE is_current = true;

ALTER TABLE public.commercial_contracts
    ADD CONSTRAINT commercial_contracts_current_version_fk
    FOREIGN KEY (tenant_id, current_version_id)
    REFERENCES public.commercial_contract_versions(tenant_id, id)
    ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_commercial_contracts_updated_at ON public.commercial_contracts;
CREATE TRIGGER trg_commercial_contracts_updated_at
    BEFORE UPDATE ON public.commercial_contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.commercial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_contract_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_contracts: jwt_select_admin"
    ON public.commercial_contracts FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contracts: jwt_insert_admin"
    ON public.commercial_contracts FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contracts: jwt_update_admin"
    ON public.commercial_contracts FOR UPDATE TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contract_versions: jwt_select_admin"
    ON public.commercial_contract_versions FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contract_versions: jwt_insert_admin"
    ON public.commercial_contract_versions FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "commercial_contract_versions: jwt_update_admin"
    ON public.commercial_contract_versions FOR UPDATE TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

COMMIT;
