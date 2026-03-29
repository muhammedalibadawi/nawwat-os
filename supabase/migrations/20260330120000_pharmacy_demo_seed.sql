-- Minimal pharmacy demo: products + batches from existing tenant items (no new contacts).
-- Skips if tenant already has pharma_products.

BEGIN;

DO $$
DECLARE
  v_tenant uuid;
  v_branch uuid;
  v_item_a uuid;
  v_item_b uuid;
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
BEGIN
  SELECT b.tenant_id, b.id
  INTO v_tenant, v_branch
  FROM public.branches b
  WHERE b.is_active = true
  ORDER BY b.is_default DESC NULLS LAST, b.created_at ASC
  LIMIT 1;

  IF v_tenant IS NULL OR v_branch IS NULL THEN
    RAISE NOTICE 'pharmacy_demo_seed: no active branch — skip';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.pharma_products WHERE tenant_id = v_tenant LIMIT 1) THEN
    RAISE NOTICE 'pharmacy_demo_seed: pharma_products already present for tenant % — skip', v_tenant;
    RETURN;
  END IF;

  SELECT i.id INTO v_item_a
  FROM public.items i
  WHERE i.tenant_id = v_tenant AND i.is_active = true
  ORDER BY i.created_at ASC
  LIMIT 1;

  SELECT i.id INTO v_item_b
  FROM public.items i
  WHERE i.tenant_id = v_tenant AND i.is_active = true AND i.id <> v_item_a
  ORDER BY i.created_at ASC
  LIMIT 1;

  IF v_item_a IS NULL THEN
    RAISE NOTICE 'pharmacy_demo_seed: no items for tenant — skip';
    RETURN;
  END IF;

  INSERT INTO public.pharma_products (
    id, tenant_id, item_id, generic_name, brand_name, strength, dosage_form, route,
    requires_prescription, controlled_drug, refrigerated, is_otc, is_active, metadata
  ) VALUES
    (p1, v_tenant, v_item_a, 'Paracetamol', 'DemoPain', '500mg', 'tablet', 'oral',
     true, false, false, false, true, '{}'::jsonb);

  INSERT INTO public.pharma_batches (
    id, tenant_id, product_id, branch_id, batch_number, expiry_date, manufacture_date,
    qty_on_hand, qty_reserved, qty_damaged, purchase_cost, selling_price, received_at, is_active
  ) VALUES
    (b1, v_tenant, p1, v_branch, 'DEMO-BATCH-RX-01', (CURRENT_DATE + interval '180 days')::date, CURRENT_DATE,
     200, 0, 0, 2.5, 8.0, now(), true);

  IF v_item_b IS NOT NULL AND v_item_b <> v_item_a THEN
    INSERT INTO public.pharma_products (
      id, tenant_id, item_id, generic_name, brand_name, strength, dosage_form, route,
      requires_prescription, controlled_drug, refrigerated, is_otc, is_active, metadata
    ) VALUES
      (p2, v_tenant, v_item_b, 'Oral rehydration', 'DemoORS', NULL, 'sachet', 'oral',
       false, false, false, true, true, '{}'::jsonb);

    INSERT INTO public.pharma_batches (
      id, tenant_id, product_id, branch_id, batch_number, expiry_date, manufacture_date,
      qty_on_hand, qty_reserved, qty_damaged, purchase_cost, selling_price, received_at, is_active
    ) VALUES
      (b2, v_tenant, p2, v_branch, 'DEMO-BATCH-OTC-01', (CURRENT_DATE + interval '365 days')::date, CURRENT_DATE,
       500, 0, 0, 0.5, 3.0, now(), true);
  END IF;

  RAISE NOTICE 'pharmacy_demo_seed: inserted demo products/batches for tenant % branch %', v_tenant, v_branch;
END $$;

COMMIT;
