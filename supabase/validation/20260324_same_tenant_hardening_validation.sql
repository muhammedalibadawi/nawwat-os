-- Run after applying 20260324100000_same_tenant_hardening.sql
-- Example:
--   supabase db query < supabase/validation/20260324_same_tenant_hardening_validation.sql

-- 1) Sector tables requested by product but still missing from this repo/db
SELECT
  expected.table_name,
  'missing_expected_sector_table' AS issue_type
FROM unnest(
  ARRAY[
    'fb_order_items',
    'fb_kds_tickets',
    'retail_inventory',
    'retail_transfer_items',
    'retail_sale_items',
    'retail_return_items',
    'psa_tasks',
    'psa_project_members',
    'psa_timesheets',
    'psa_expenses',
    'psa_billable_items'
  ]
) AS expected(table_name)
WHERE to_regclass('public.' || expected.table_name) IS NULL
ORDER BY expected.table_name;

-- 2) Legacy RLS patterns that still trust public.users(auth_id) directly
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  'legacy_users_auth_lookup' AS issue_type
FROM pg_policies
WHERE COALESCE(qual, '') ILIKE '%SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()%'
   OR COALESCE(with_check, '') ILIKE '%SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()%'
   OR COALESCE(qual, '') ILIKE '%SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid()%'
   OR COALESCE(with_check, '') ILIKE '%SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid()%'
ORDER BY schemaname, tablename, policyname;

-- 3) INSERT/UPDATE/ALL policies that still miss WITH CHECK
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  'missing_with_check' AS issue_type
FROM pg_policies
WHERE cmd IN ('INSERT', 'UPDATE', 'ALL')
  AND with_check IS NULL
ORDER BY schemaname, tablename, policyname;

-- 4) Tenant-scoped FKs added NOT VALID that still need data cleanup + validate
SELECT
  conrelid::regclass AS table_name,
  conname,
  convalidated,
  'tenant_fk_not_validated_yet' AS issue_type
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND conname LIKE 'fk\_%\_tenant%' ESCAPE '\'
  AND convalidated IS FALSE
ORDER BY conrelid::regclass::text, conname;

-- 5) High-value mismatch checks for current tables
SELECT 'chart_of_accounts.parent_id' AS relation_name, COUNT(*) AS violation_count
FROM public.chart_of_accounts c
LEFT JOIN public.chart_of_accounts p
  ON p.id = c.parent_id
 AND p.tenant_id = c.tenant_id
WHERE c.parent_id IS NOT NULL
  AND p.id IS NULL

UNION ALL

SELECT 'categories.parent_id' AS relation_name, COUNT(*) AS violation_count
FROM public.categories c
LEFT JOIN public.categories p
  ON p.id = c.parent_id
 AND p.tenant_id = c.tenant_id
WHERE c.parent_id IS NOT NULL
  AND p.id IS NULL

UNION ALL

SELECT 'invoices.contact_id' AS relation_name, COUNT(*) AS violation_count
FROM public.invoices i
LEFT JOIN public.contacts c
  ON c.id = i.contact_id
 AND c.tenant_id = i.tenant_id
WHERE i.contact_id IS NOT NULL
  AND c.id IS NULL

UNION ALL

SELECT 'payment_links.invoice_id' AS relation_name, COUNT(*) AS violation_count
FROM public.payment_links pl
LEFT JOIN public.invoices i
  ON i.id = pl.invoice_id
 AND i.tenant_id = pl.tenant_id
WHERE pl.invoice_id IS NOT NULL
  AND i.id IS NULL

UNION ALL

SELECT 'orders.contact_id' AS relation_name, COUNT(*) AS violation_count
FROM public.orders o
LEFT JOIN public.contacts c
  ON c.id = o.contact_id
 AND c.tenant_id = o.tenant_id
WHERE o.contact_id IS NOT NULL
  AND c.id IS NULL

UNION ALL

SELECT 'shipments.supplier_id' AS relation_name, COUNT(*) AS violation_count
FROM public.shipments s
LEFT JOIN public.contacts c
  ON c.id = s.supplier_id
 AND c.tenant_id = s.tenant_id
WHERE s.supplier_id IS NOT NULL
  AND c.id IS NULL

UNION ALL

SELECT 'bank_transactions.bank_account_id' AS relation_name, COUNT(*) AS violation_count
FROM public.bank_transactions bt
LEFT JOIN public.bank_accounts ba
  ON ba.id = bt.bank_account_id
 AND ba.tenant_id = bt.tenant_id
WHERE bt.bank_account_id IS NOT NULL
  AND ba.id IS NULL

UNION ALL

SELECT 'loyalty_transactions.customer_id' AS relation_name, COUNT(*) AS violation_count
FROM public.loyalty_transactions lt
LEFT JOIN public.contacts c
  ON c.id = lt.customer_id
 AND c.tenant_id = lt.tenant_id
WHERE lt.customer_id IS NOT NULL
  AND c.id IS NULL

UNION ALL

SELECT 'inventory_writeoffs.item_id' AS relation_name, COUNT(*) AS violation_count
FROM public.inventory_writeoffs iw
LEFT JOIN public.items i
  ON i.id = iw.item_id
 AND i.tenant_id = iw.tenant_id
WHERE iw.item_id IS NOT NULL
  AND i.id IS NULL
ORDER BY relation_name;
