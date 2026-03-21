-- ============================================================
-- NawwatOS — Migration 010_commerce_tables
-- Commerce Integration Layer (Adjusted for v5.1 + Security Patches)
-- ============================================================

BEGIN;

-- ============================================================
-- 1) channel_accounts
-- ============================================================
CREATE TABLE public.channel_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel_name TEXT NOT NULL CHECK (channel_name IN ('salla', 'shopify', 'noon', 'woocommerce')),
    connection_status TEXT NOT NULL DEFAULT 'disconnected',
    
    -- Secrets Handling (Rule 1 & Rule 4)
    -- Raw API keys and tokens are no longer stored in plain JSONB. 
    -- Reference to vault/encrypted storage pattern introduced in v2 patches.
    -- TODO: Define actual storage/read/write functions (Vault strategy) before usage.
    credentials_secret_id UUID, 
    -- Non-sensitive metadata (e.g. shop URL, region)
    credentials_metadata JSONB DEFAULT '{}'::jsonb,
    
    health_status TEXT DEFAULT 'healthy',
    last_error_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Required for composite FK discipline (Rule 1)
    UNIQUE (tenant_id, id)
);

CREATE INDEX idx_channel_accounts_tenant ON public.channel_accounts(tenant_id);

-- ============================================================
-- 2) canonical_skus
-- ============================================================
-- Aligned with single-SKU MVP items table (Rule 5)
-- Explicit constraint: Currently, 1 NawwatOS `items` row = 1 sellable canonical SKU. 
-- Do not imply full variant parity in core until `item_variants` arrives.
CREATE TABLE public.canonical_skus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Composite FK referencing public.items(tenant_id, id) (Rule 1)
    item_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, item_id) REFERENCES public.items(tenant_id, id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Required for composite FK discipline (Rule 1)
    UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX uq_canonical_skus_tenant_item ON public.canonical_skus(tenant_id, item_id);
CREATE UNIQUE INDEX uq_canonical_skus_tenant_sku ON public.canonical_skus(tenant_id, sku);

-- ============================================================
-- 3) channel_catalog_items (Variant-Level)
-- ============================================================
-- Granular strictly to the variant level (Rule 4)
CREATE TABLE public.channel_catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Composite FK referencing public.channel_accounts(tenant_id, id) (Rule 1)
    channel_account_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, channel_account_id) REFERENCES public.channel_accounts(tenant_id, id) ON DELETE CASCADE,
    
    external_product_id TEXT NOT NULL,
    external_variant_id TEXT NOT NULL,
    parent_external_id TEXT, -- If applicable for hierarchy
    
    barcode TEXT,
    sku TEXT,
    name TEXT NOT NULL,
    option_values JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Required for composite FK discipline (Rule 1)
    UNIQUE (tenant_id, id)
);

CREATE INDEX idx_channel_catalog_items_tenant_acc ON public.channel_catalog_items(tenant_id, channel_account_id);
CREATE UNIQUE INDEX uq_channel_catalog_items_ext_var ON public.channel_catalog_items(tenant_id, channel_account_id, external_variant_id);

-- ============================================================
-- 4) sku_mappings
-- ============================================================
CREATE TABLE public.sku_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Composite FK referencing public.canonical_skus(tenant_id, id) (Rule 1)
    canonical_sku_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, canonical_sku_id) REFERENCES public.canonical_skus(tenant_id, id) ON DELETE CASCADE,
    
    -- Composite FK referencing public.channel_catalog_items(tenant_id, id) (Rule 1)
    channel_item_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, channel_item_id) REFERENCES public.channel_catalog_items(tenant_id, id) ON DELETE CASCADE,
    
    -- Validation rules (Rule 6)
    mapping_status TEXT NOT NULL DEFAULT 'suggested' 
        CHECK (mapping_status IN ('suggested','confirmed','ambiguous','review_required','rejected','inactive')),
    confidence_score NUMERIC(5,2) DEFAULT 0.00,
    rejected_reason TEXT,
    
    confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    last_validated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active unicity protection: prevent two canonical SKUs mapping to same active external variant (Rule 7)
CREATE UNIQUE INDEX sku_mappings_active_ext_variant_idx 
    ON public.sku_mappings (tenant_id, channel_item_id) 
    WHERE mapping_status IN ('confirmed', 'suggested');

-- ============================================================
-- 5) inbound_webhook_events
-- ============================================================
CREATE TABLE public.inbound_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Composite FK referencing public.channel_accounts(tenant_id, id) (Rule 1)
    channel_account_id UUID NOT NULL,
    FOREIGN KEY (tenant_id, channel_account_id) REFERENCES public.channel_accounts(tenant_id, id) ON DELETE CASCADE,
    
    idempotency_key TEXT, -- (Rule 2)
    source_event_id TEXT,
    event_type TEXT NOT NULL,
    
    payload JSONB NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook dedupe index (Rule 11)
CREATE UNIQUE INDEX uq_webhook_dedupe ON public.inbound_webhook_events(tenant_id, channel_account_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Immutable payload trigger & Block DELETE (Rule 2)
CREATE OR REPLACE FUNCTION public.trg_webhook_immutable_payload()
RETURNS trigger AS $$
BEGIN
  IF NEW.payload IS DISTINCT FROM OLD.payload THEN
    RAISE EXCEPTION 'Webhook event payload is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_payload_protect
  BEFORE UPDATE ON public.inbound_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_immutable_payload();

CREATE OR REPLACE FUNCTION public.trg_webhook_prevent_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Webhook events cannot be deleted. Historic data is immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_delete_protect
  BEFORE DELETE ON public.inbound_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_prevent_delete();

-- ============================================================
-- 6) sync_jobs
-- ============================================================
CREATE TABLE public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Composite FK referencing public.channel_accounts(tenant_id, id) (Rule 1)
    channel_account_id UUID,
    FOREIGN KEY (tenant_id, channel_account_id) REFERENCES public.channel_accounts(tenant_id, id) ON DELETE CASCADE,
    
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Distributed worker orchestration fields (Rule 3)
    idempotency_key TEXT,
    correlation_id TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    priority INT NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ,
    worker_id TEXT,
    job_group TEXT,
    job_partition TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Worker polling indices (Rule 11)
CREATE INDEX idx_sync_jobs_worker_poll ON public.sync_jobs(tenant_id, status, next_retry_at);
CREATE INDEX idx_sync_jobs_channel_poll ON public.sync_jobs(channel_account_id, status, created_at);
CREATE INDEX idx_sync_jobs_queued_partial ON public.sync_jobs(tenant_id, status) WHERE status IN ('queued', 'running');

-- ============================================================
-- 7) Timestamp Triggers
-- ============================================================
-- Relying on existing NawwatOS public.set_updated_at() helper (Rule 3)
CREATE TRIGGER set_channel_accounts_updated_at BEFORE UPDATE ON public.channel_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_canonical_skus_updated_at BEFORE UPDATE ON public.canonical_skus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_channel_catalog_items_updated_at BEFORE UPDATE ON public.channel_catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_sku_mappings_updated_at BEFORE UPDATE ON public.sku_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_inbound_webhook_events_updated_at BEFORE UPDATE ON public.inbound_webhook_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_sync_jobs_updated_at BEFORE UPDATE ON public.sync_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8) Audit Integration Notes (Rule 2)
-- ============================================================
-- TODO: Implement audit hooks for public.channel_accounts, public.sku_mappings, and public.sync_jobs.
-- These tables should pipe state transitions to `public.audit_log` via `public.stamp_audit_chain()` 
-- or a commerce-specific helper once the precise integration layer is defined.

COMMIT;
