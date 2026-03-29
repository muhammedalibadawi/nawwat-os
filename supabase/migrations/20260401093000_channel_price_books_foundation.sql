BEGIN;

CREATE TABLE public.channel_price_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel_account_id UUID NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'SAR',
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, channel_account_id, name),
    CONSTRAINT channel_price_books_name_not_blank
        CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT channel_price_books_effective_range_valid
        CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
    CONSTRAINT channel_price_books_channel_fk
        FOREIGN KEY (tenant_id, channel_account_id)
        REFERENCES public.channel_accounts(tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX idx_channel_price_books_tenant_channel
    ON public.channel_price_books(tenant_id, channel_account_id, created_at DESC);

CREATE UNIQUE INDEX uq_channel_price_books_one_default
    ON public.channel_price_books(tenant_id, channel_account_id)
    WHERE is_default = true;

CREATE TABLE public.channel_price_book_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    price_book_id UUID NOT NULL,
    canonical_sku_id UUID NOT NULL,
    list_price NUMERIC(15,2) NOT NULL CHECK (list_price >= 0),
    floor_price NUMERIC(15,2) CHECK (floor_price IS NULL OR floor_price >= 0),
    currency TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, price_book_id, canonical_sku_id),
    CONSTRAINT channel_price_book_lines_price_book_fk
        FOREIGN KEY (tenant_id, price_book_id)
        REFERENCES public.channel_price_books(tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT channel_price_book_lines_canonical_sku_fk
        FOREIGN KEY (tenant_id, canonical_sku_id)
        REFERENCES public.canonical_skus(tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT channel_price_book_lines_floor_lte_list
        CHECK (floor_price IS NULL OR floor_price <= list_price)
);

CREATE INDEX idx_channel_price_book_lines_price_book
    ON public.channel_price_book_lines(tenant_id, price_book_id, created_at);

CREATE INDEX idx_channel_price_book_lines_canonical
    ON public.channel_price_book_lines(tenant_id, canonical_sku_id);

DROP TRIGGER IF EXISTS trg_channel_price_books_updated_at ON public.channel_price_books;
CREATE TRIGGER trg_channel_price_books_updated_at
    BEFORE UPDATE ON public.channel_price_books
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_channel_price_book_lines_updated_at ON public.channel_price_book_lines;
CREATE TRIGGER trg_channel_price_book_lines_updated_at
    BEFORE UPDATE ON public.channel_price_book_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.channel_price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_price_book_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_price_books: jwt_select_admin"
    ON public.channel_price_books FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_price_books: jwt_insert_admin"
    ON public.channel_price_books FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_price_books: jwt_update_admin"
    ON public.channel_price_books FOR UPDATE TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_price_book_lines: jwt_select_admin"
    ON public.channel_price_book_lines FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_price_book_lines: jwt_insert_admin"
    ON public.channel_price_book_lines FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

CREATE POLICY "channel_price_book_lines: jwt_update_admin"
    ON public.channel_price_book_lines FOR UPDATE TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('owner', 'branch_manager')
    );

COMMIT;
