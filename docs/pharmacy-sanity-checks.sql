-- Pharmacy sector — sanity checks (Supabase SQL Editor).
-- Replace the UUID in section D with your tenant_id.

-- ═══════════════════════════════════════════════════════════════════════════
-- B) Core objects (no tenant filter)
-- ═══════════════════════════════════════════════════════════════════════════

SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'pharma_batch_availability_v',
    'pharma_prescription_queue_v',
    'pharma_dispense_history_v'
  )
ORDER BY table_name;

SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'pharmacy_receive_batches',
    'pharmacy_dispense_prescription',
    'pharmacy_complete_otc_sale',
    'pharmacy_return_to_supplier',
    'pharmacy_mark_batch_expired',
    'pharmacy_adjust_batch_stock',
    'pharmacy_next_document_number',
    'pharmacy_can_operate',
    'pharmacy_can_manage_sensitive'
  )
ORDER BY p.proname;

-- ═══════════════════════════════════════════════════════════════════════════
-- D) Per-tenant counts — edit UUID
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tid uuid := '00000000-0000-0000-0000-000000000000';  -- <<< REPLACE
BEGIN
  RAISE NOTICE 'pharma_products: %',
    (SELECT COUNT(*)::text FROM public.pharma_products WHERE tenant_id = tid AND is_active = true);
  RAISE NOTICE 'pharma_batches: %',
    (SELECT COUNT(*)::text FROM public.pharma_batches WHERE tenant_id = tid);
  RAISE NOTICE 'pharma_prescriptions: %',
    (SELECT COUNT(*)::text FROM public.pharma_prescriptions WHERE tenant_id = tid);
  RAISE NOTICE 'pharma_prescription_items: %',
    (SELECT COUNT(*)::text FROM public.pharma_prescription_items WHERE tenant_id = tid);
  RAISE NOTICE 'patients/customers (contacts): %',
    (SELECT COUNT(*)::text FROM public.contacts WHERE tenant_id = tid AND type IN ('patient', 'customer') AND COALESCE(is_active, true) = true);
  RAISE NOTICE 'suppliers (contacts): %',
    (SELECT COUNT(*)::text FROM public.contacts WHERE tenant_id = tid AND type = 'supplier' AND COALESCE(is_active, true) = true);
  RAISE NOTICE 'pharma_patient_med_history rows: %',
    (SELECT COUNT(*)::text FROM public.pharma_patient_med_history WHERE tenant_id = tid);
  RAISE NOTICE 'seed prescriptions (NW-SEED-RX-*): %',
    (SELECT COUNT(*)::text FROM public.pharma_prescriptions WHERE tenant_id = tid AND prescription_number LIKE 'NW-SEED-RX-%');
END $$;
