BEGIN;

CREATE TABLE public.channel_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    price_book_id UUID NOT NULL,
    canonical_sku_id UUID,
    rule_type TEXT NOT NULL
        CHECK (rule_type IN ('min_price_override', 'target_margin_pct', 'max_discount_pct', 'merchant_of_record', 'flow_type')),
    numeric_value NUMERIC(15,4),
    text_value TEXT,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    CONSTRAINT channel_pricing_rules_price_book_fk
        FOREIGN KEY (tenant_id, price_book_id)
        REFERENCES public.channel_price_books(tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT channel_pricing_rules_canonical_sku_fk
        FOREIGN KEY (tenant_id, canonical_sku_id)
        REFERENCES public.canonical_skus(tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT channel_pricing_rules_effective_range_valid
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
    CONSTRAINT channel_pricing_rules_value_presence
        CHECK (
            (rule_type IN ('min_price_override', 'target_margin_pct', 'max_discount_pct') AND numeric_value IS NOT NULL)
            OR
            (rule_type IN ('merchant_of_record', 'flow_type') AND text_value IS NOT NULL)
        ),
    CONSTRAINT channel_pricing_rules_merchant_of_record_values
        CHECK (
            rule_type <> 'merchant_of_record'
            OR text_value IN ('merchant', 'channel')
        ),
    CONSTRAINT channel_pricing_rules_flow_type_values
        CHECK (
            rule_type <> 'flow_type'
            OR text_value IN (
                'channel_collects_then_payout',
                'merchant_collects_then_fees_due',
                'split_settlement',
                'manual_reconciliation'
            )
        ),
    CONSTRAINT channel_pricing_rules_numeric_nonnegative
        CHECK (numeric_value IS NULL OR numeric_value >= 0)
);

CREATE INDEX idx_channel_pricing_rules_price_book
    ON public.channel_pricing_rules(tenant_id, price_book_id, is_active, sort_order, created_at);

CREATE INDEX idx_channel_pricing_rules_canonical
    ON public.channel_pricing_rules(tenant_id, canonical_sku_id)
    WHERE canonical_sku_id IS NOT NULL;

CREATE UNIQUE INDEX uq_channel_pricing_rules_book_scope
    ON public.channel_pricing_rules(tenant_id, price_book_id, rule_type)
    WHERE canonical_sku_id IS NULL;

CREATE UNIQUE INDEX uq_channel_pricing_rules_sku_scope
    ON public.channel_pricing_rules(tenant_id, price_book_id, canonical_sku_id, rule_type)
    WHERE canonical_sku_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_channel_pricing_rules_updated_at ON public.channel_pricing_rules;
CREATE TRIGGER trg_channel_pricing_rules_updated_at
    BEFORE UPDATE ON public.channel_pricing_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.channel_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_pricing_rules: jwt_select_admin"
    ON public.channel_pricing_rules FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_pricing_rules: jwt_insert_admin"
    ON public.channel_pricing_rules FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_pricing_rules: jwt_update_admin"
    ON public.channel_pricing_rules FOR UPDATE TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

COMMIT;
