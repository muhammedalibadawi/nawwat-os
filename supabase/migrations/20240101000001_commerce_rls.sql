-- ============================================================
-- NawwatOS — Migration 011_commerce_rls
-- Commerce Integration Layer RLS
-- Depends on:
--   1) nawwat_schema_v5_1_FINAL.sql
--   2) 01_security_patch.sql
--   3) 01_security_patch_v2.sql
--   4) 010_commerce_tables.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 0) ENABLE RLS
-- ============================================================

ALTER TABLE public.channel_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_skus         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_catalog_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_mappings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs              ENABLE ROW LEVEL SECURITY;

-- Optional hardening: enforce RLS even for table owners
-- Uncomment if you want stricter behavior during local/admin usage
-- ALTER TABLE public.channel_accounts       FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.canonical_skus         FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.channel_catalog_items  FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.sku_mappings           FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.inbound_webhook_events FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.sync_jobs              FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 1) DROP EXISTING POLICIES (idempotent reruns)
-- ============================================================

-- channel_accounts
DROP POLICY IF EXISTS "channel_accounts: jwt_select_admin"  ON public.channel_accounts;
DROP POLICY IF EXISTS "channel_accounts: jwt_insert_admin"  ON public.channel_accounts;
DROP POLICY IF EXISTS "channel_accounts: jwt_update_admin"  ON public.channel_accounts;

-- canonical_skus
DROP POLICY IF EXISTS "canonical_skus: jwt_select_staff"    ON public.canonical_skus;
DROP POLICY IF EXISTS "canonical_skus: jwt_insert_admin"    ON public.canonical_skus;
DROP POLICY IF EXISTS "canonical_skus: jwt_update_admin"    ON public.canonical_skus;

-- channel_catalog_items
DROP POLICY IF EXISTS "channel_catalog_items: jwt_select_staff" ON public.channel_catalog_items;
DROP POLICY IF EXISTS "channel_catalog_items: jwt_insert_admin" ON public.channel_catalog_items;
DROP POLICY IF EXISTS "channel_catalog_items: jwt_update_admin" ON public.channel_catalog_items;

-- sku_mappings
DROP POLICY IF EXISTS "sku_mappings: jwt_select_staff"      ON public.sku_mappings;
DROP POLICY IF EXISTS "sku_mappings: jwt_insert_admin"      ON public.sku_mappings;
DROP POLICY IF EXISTS "sku_mappings: jwt_update_admin"      ON public.sku_mappings;

-- inbound_webhook_events
DROP POLICY IF EXISTS "inbound_webhook_events: jwt_select_admin" ON public.inbound_webhook_events;

-- sync_jobs
DROP POLICY IF EXISTS "sync_jobs: jwt_select_admin"         ON public.sync_jobs;

-- ============================================================
-- 2) channel_accounts
-- owner + branch_manager can read/write
-- no DELETE policy
-- ============================================================

CREATE POLICY "channel_accounts: jwt_select_admin"
ON public.channel_accounts
FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

CREATE POLICY "channel_accounts: jwt_insert_admin"
ON public.channel_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

CREATE POLICY "channel_accounts: jwt_update_admin"
ON public.channel_accounts
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

-- ============================================================
-- 3) canonical_skus
-- owner + branch_manager + cashier can SELECT
-- owner + branch_manager can INSERT/UPDATE
-- no DELETE policy
-- ============================================================

CREATE POLICY "canonical_skus: jwt_select_staff"
ON public.canonical_skus
FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager', 'cashier')
);

CREATE POLICY "canonical_skus: jwt_insert_admin"
ON public.canonical_skus
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

CREATE POLICY "canonical_skus: jwt_update_admin"
ON public.canonical_skus
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

-- ============================================================
-- 4) channel_catalog_items
-- owner + branch_manager + cashier can SELECT
-- owner + branch_manager can INSERT/UPDATE
-- no DELETE policy
-- ============================================================

CREATE POLICY "channel_catalog_items: jwt_select_staff"
ON public.channel_catalog_items
FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager', 'cashier')
);

CREATE POLICY "channel_catalog_items: jwt_insert_admin"
ON public.channel_catalog_items
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

CREATE POLICY "channel_catalog_items: jwt_update_admin"
ON public.channel_catalog_items
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

-- ============================================================
-- 5) sku_mappings
-- owner + branch_manager + cashier can SELECT
-- owner + branch_manager can INSERT/UPDATE
-- no DELETE policy
-- ============================================================

CREATE POLICY "sku_mappings: jwt_select_staff"
ON public.sku_mappings
FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager', 'cashier')
);

CREATE POLICY "sku_mappings: jwt_insert_admin"
ON public.sku_mappings
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

CREATE POLICY "sku_mappings: jwt_update_admin"
ON public.sku_mappings
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
)
WITH CHECK (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

-- ============================================================
-- 6) inbound_webhook_events
-- Monitoring SELECT only for owner + branch_manager
-- No frontend INSERT/UPDATE/DELETE policy
-- Backend/service-role should handle writes
-- ============================================================

CREATE POLICY "inbound_webhook_events: jwt_select_admin"
ON public.inbound_webhook_events
FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

-- Intentionally NO INSERT policy for authenticated users
-- Intentionally NO UPDATE policy for authenticated users
-- Intentionally NO DELETE policy

-- ============================================================
-- 7) sync_jobs
-- Monitoring SELECT only for owner + branch_manager
-- No frontend INSERT/UPDATE/DELETE policy
-- Backend/service-role should handle writes
-- ============================================================

CREATE POLICY "sync_jobs: jwt_select_admin"
ON public.sync_jobs
FOR SELECT
TO authenticated
USING (
  tenant_id = public.current_tenant_id()
  AND public.current_user_role() IN ('owner', 'branch_manager')
);

-- Intentionally NO INSERT policy for authenticated users
-- Intentionally NO UPDATE policy for authenticated users
-- Intentionally NO DELETE policy

COMMIT;
