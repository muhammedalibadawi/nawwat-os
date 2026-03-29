-- Prescription + patient demo data for manual pharmacy testing (tenant-scoped, idempotent).
-- Skips if seed prescriptions already exist for the chosen tenant.
-- Safe to re-run: uses sentinel notes / prescription numbers.

BEGIN;

DO $$
DECLARE
  v_tenant uuid;
  v_branch uuid;
  pid1 uuid;
  pid2 uuid;
  sid uuid;
  p_rx uuid;
  p_otc uuid;
  rx_verified uuid := gen_random_uuid();
  rx_draft uuid := gen_random_uuid();
  pi1 uuid := gen_random_uuid();
  pi2 uuid := gen_random_uuid();
  pi3 uuid := gen_random_uuid();
BEGIN
  SELECT b.tenant_id, b.id
  INTO v_tenant, v_branch
  FROM public.branches b
  WHERE b.is_active = true
  ORDER BY b.is_default DESC NULLS LAST, b.created_at ASC
  LIMIT 1;

  IF v_tenant IS NULL OR v_branch IS NULL THEN
    RAISE NOTICE 'pharmacy_prescription_demo_seed: no active branch — skip';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pharma_prescriptions pr
    WHERE pr.tenant_id = v_tenant
      AND pr.prescription_number IN ('NW-SEED-RX-001', 'NW-SEED-RX-002')
    LIMIT 1
  ) THEN
    RAISE NOTICE 'pharmacy_prescription_demo_seed: seed prescriptions already exist for tenant % — skip', v_tenant;
    RETURN;
  END IF;

  SELECT pp.id
  INTO p_rx
  FROM public.pharma_products pp
  WHERE pp.tenant_id = v_tenant AND pp.is_active = true AND pp.requires_prescription = true
  ORDER BY pp.created_at ASC
  LIMIT 1;

  SELECT pp.id
  INTO p_otc
  FROM public.pharma_products pp
  WHERE pp.tenant_id = v_tenant AND pp.is_active = true AND COALESCE(pp.requires_prescription, false) = false
  ORDER BY pp.created_at ASC
  LIMIT 1;

  IF p_rx IS NULL THEN
    SELECT pp.id INTO p_rx FROM public.pharma_products pp
    WHERE pp.tenant_id = v_tenant AND pp.is_active = true
    ORDER BY pp.created_at ASC LIMIT 1;
  END IF;

  IF p_rx IS NULL THEN
    RAISE NOTICE 'pharmacy_prescription_demo_seed: no pharma_products for tenant — skip';
    RETURN;
  END IF;

  IF p_otc IS NULL OR p_otc = p_rx THEN
    p_otc := p_rx;
  END IF;

  -- Patients (reuse if same seed notes already present)
  SELECT c.id INTO pid1
  FROM public.contacts c
  WHERE c.tenant_id = v_tenant AND c.notes = 'nawwat_seed:pharma_patient_1'
  LIMIT 1;

  IF pid1 IS NULL THEN
    INSERT INTO public.contacts (tenant_id, name, type, email, phone, is_active, notes)
    VALUES (
      v_tenant,
      N'مريض تجريبي — أحمد',
      'patient',
      'pharma-seed-p1@demo.nawwat.invalid',
      '+971500000001',
      true,
      'nawwat_seed:pharma_patient_1'
    )
    RETURNING id INTO pid1;
  END IF;

  SELECT c.id INTO pid2
  FROM public.contacts c
  WHERE c.tenant_id = v_tenant AND c.notes = 'nawwat_seed:pharma_patient_2'
  LIMIT 1;

  IF pid2 IS NULL THEN
    INSERT INTO public.contacts (tenant_id, name, type, email, phone, is_active, notes)
    VALUES (
      v_tenant,
      N'مريض تجريبي — فاطمة',
      'patient',
      'pharma-seed-p2@demo.nawwat.invalid',
      '+971500000002',
      true,
      'nawwat_seed:pharma_patient_2'
    )
    RETURNING id INTO pid2;
  END IF;

  -- Supplier for receiving / batch flows (optional reference)
  SELECT c.id INTO sid
  FROM public.contacts c
  WHERE c.tenant_id = v_tenant AND c.notes = 'nawwat_seed:pharma_supplier_1'
  LIMIT 1;

  IF sid IS NULL THEN
    INSERT INTO public.contacts (tenant_id, name, type, email, phone, is_active, notes)
    VALUES (
      v_tenant,
      N'مورد تجريبي — صيدلية',
      'supplier',
      'pharma-seed-supplier@demo.nawwat.invalid',
      '+971400000001',
      true,
      'nawwat_seed:pharma_supplier_1'
    )
    RETURNING id INTO sid;
  END IF;

  INSERT INTO public.pharma_prescriptions (
    id, tenant_id, branch_id, prescription_number, patient_id,
    doctor_name, doctor_license, prescription_date, source_type, status, notes,
    insurance_provider, policy_number, created_by
  ) VALUES (
    rx_verified, v_tenant, v_branch, 'NW-SEED-RX-001', pid1,
    N'Dr. Demo', 'LIC-DEMO-001', CURRENT_DATE, 'manual', 'verified',
    N'وصفة تجريبية جاهزة للصرف (seed).',
    NULL, NULL, NULL
  );

  INSERT INTO public.pharma_prescriptions (
    id, tenant_id, branch_id, prescription_number, patient_id,
    doctor_name, doctor_license, prescription_date, source_type, status, notes,
    insurance_provider, policy_number, created_by
  ) VALUES (
    rx_draft, v_tenant, v_branch, 'NW-SEED-RX-002', pid2,
    N'Dr. Demo', 'LIC-DEMO-001', CURRENT_DATE, 'manual', 'draft',
    N'مسودة وصفة للتعديل من شاشة الوصفات (seed).',
    NULL, NULL, NULL
  );

  INSERT INTO public.pharma_prescription_items (
    id, tenant_id, prescription_id, product_id, prescribed_qty, dispensed_qty,
    dosage_instructions, duration_text, substitutions_allowed, status, note
  ) VALUES
    (pi1, v_tenant, rx_verified, p_rx, 20, 0,
     N'مرتين يومياً بعد الأكل', N'5 أيام', true, 'pending', 'nawwat_seed:item'),
    (pi2, v_tenant, rx_verified, p_otc, 6, 0,
     N'عند الحاجة', N'3 أيام', false, 'pending', 'nawwat_seed:item');

  IF p_otc <> p_rx THEN
    INSERT INTO public.pharma_prescription_items (
      id, tenant_id, prescription_id, product_id, prescribed_qty, dispensed_qty,
      dosage_instructions, duration_text, substitutions_allowed, status, note
    ) VALUES
      (pi3, v_tenant, rx_draft, p_otc, 10, 0,
       N'مرة يومياً', N'7 أيام', true, 'pending', 'nawwat_seed:item');
  ELSE
    INSERT INTO public.pharma_prescription_items (
      id, tenant_id, prescription_id, product_id, prescribed_qty, dispensed_qty,
      dosage_instructions, duration_text, substitutions_allowed, status, note
    ) VALUES
      (pi3, v_tenant, rx_draft, p_rx, 10, 0,
       N'مرة يومياً', N'7 أيام', true, 'pending', 'nawwat_seed:item');
  END IF;

  INSERT INTO public.pharma_patient_med_history (
    tenant_id, patient_id, product_id, last_dispensed_at, last_quantity, dispense_count, notes
  ) VALUES (
    v_tenant, pid1, p_rx, (now() AT TIME ZONE 'utc') - interval '30 days', 10, 1,
    'nawwat_seed: prior dispense sample'
  )
  ON CONFLICT (tenant_id, patient_id, product_id) DO NOTHING;

  RAISE NOTICE 'pharmacy_prescription_demo_seed: inserted demo prescriptions + patients for tenant %', v_tenant;
END $$;

COMMIT;
