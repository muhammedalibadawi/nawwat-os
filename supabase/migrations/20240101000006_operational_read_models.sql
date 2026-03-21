-- ============================================================
-- NawwatOS — Migration 021_operational_read_models
-- Operational Views for Commerce Pipeline Monitoring
-- ============================================================

BEGIN;

-- Note: We use `WITH (security_invoker = true)` on all views.
-- This native PostgreSQL 15+ feature ensures that querying the view tests
-- the underlying table's Row-Level Security (RLS) policies against the 
-- caller's current JWT context or role, preserving our strict multi-tenant isolation.


-- ============================================================
-- 1) commerce_failed_webhooks_v
-- Purpose: Identifies failed inbound webhook events for triage.
-- ============================================================
CREATE OR REPLACE VIEW public.commerce_failed_webhooks_v WITH (security_invoker = true) AS
SELECT 
    iwe.id,
    iwe.tenant_id,
    iwe.channel_account_id,
    ca.channel_name,
    iwe.source_event_id,
    iwe.event_type,
    iwe.error_message,
    iwe.created_at,
    iwe.updated_at
FROM public.inbound_webhook_events iwe
JOIN public.channel_accounts ca ON ca.id = iwe.channel_account_id
WHERE iwe.status = 'failed';


-- ============================================================
-- 2) commerce_pending_webhooks_v
-- Purpose: Real-time visibility into the ingress worker queue.
-- ============================================================
CREATE OR REPLACE VIEW public.commerce_pending_webhooks_v WITH (security_invoker = true) AS
SELECT 
    iwe.id,
    iwe.tenant_id,
    iwe.channel_account_id,
    ca.channel_name,
    iwe.source_event_id,
    iwe.event_type,
    iwe.status,
    iwe.created_at,
    -- Provides an interval representing how long the event has been stuck
    (now() - iwe.created_at) AS age 
FROM public.inbound_webhook_events iwe
JOIN public.channel_accounts ca ON ca.id = iwe.channel_account_id
WHERE iwe.status IN ('pending', 'processing', 'retrying');


-- ============================================================
-- 3) commerce_recent_sync_jobs_v
-- Purpose: High-level audit feed of outbound synchronization.
-- ============================================================
CREATE OR REPLACE VIEW public.commerce_recent_sync_jobs_v WITH (security_invoker = true) AS
SELECT 
    sj.id,
    sj.tenant_id,
    sj.channel_account_id,
    ca.channel_name,
    sj.job_type,
    sj.status,
    sj.created_at,
    sj.locked_at AS started_at,
    sj.completed_at,
    sj.last_error
FROM public.sync_jobs sj
LEFT JOIN public.channel_accounts ca ON ca.id = sj.channel_account_id;


-- ============================================================
-- 4) commerce_failed_sync_jobs_v
-- Purpose: Highlights terminal push failures requiring admin intervention.
-- ============================================================
CREATE OR REPLACE VIEW public.commerce_failed_sync_jobs_v WITH (security_invoker = true) AS
SELECT 
    sj.id,
    sj.tenant_id,
    sj.channel_account_id,
    ca.channel_name,
    sj.job_type,
    sj.status,
    sj.created_at,
    sj.locked_at AS started_at,
    sj.last_error
FROM public.sync_jobs sj
JOIN public.channel_accounts ca ON ca.id = sj.channel_account_id
WHERE sj.status = 'failed';


-- ============================================================
-- 5) commerce_mapping_readiness_v
-- Purpose: Aggregates catalog mapping health to highlight unmapped or unconfirmed inventory.
-- ============================================================
CREATE OR REPLACE VIEW public.commerce_mapping_readiness_v WITH (security_invoker = true) AS
SELECT 
    cs.id AS canonical_sku_id,
    cs.tenant_id,
    cs.item_id,
    cs.sku,
    COUNT(sm.id) AS total_mappings,
    COUNT(sm.id) FILTER (WHERE sm.mapping_status = 'confirmed') AS confirmed_mappings,
    COUNT(sm.id) FILTER (WHERE sm.mapping_status = 'suggested') AS suggested_mappings,
    COUNT(sm.id) FILTER (WHERE sm.mapping_status IN ('ambiguous', 'review_required', 'rejected', 'inactive')) AS blocked_mappings
FROM public.canonical_skus cs
LEFT JOIN public.sku_mappings sm ON sm.canonical_sku_id = cs.id
GROUP BY cs.id, cs.tenant_id, cs.item_id, cs.sku;

COMMIT;
