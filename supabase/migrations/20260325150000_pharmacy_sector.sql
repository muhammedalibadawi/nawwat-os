BEGIN;

-- =============================================================================
-- NawwatOS Pharmacy Sector
-- -----------------------------------------------------------------------------
-- Specialized, batch-aware pharmacy layer built on top of shared ERP tables:
--   - items / contacts / branches / users
--   - invoices / invoice_items / payments
--   - tenant membership helpers from the shared foundation
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_current_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'default_branch_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.pharmacy_branch_allowed(p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(public.current_app_role(), '');
  v_branch_id uuid := public.pharmacy_current_branch_id();
BEGIN
  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  IF p_branch_id IS NULL THEN
    RETURN true;
  END IF;

  IF v_role IN ('owner', 'master_admin', 'branch_manager') THEN
    RETURN true;
  END IF;

  IF v_branch_id IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_branch_id = p_branch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_current_branch_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_current_branch_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pharmacy_branch_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_branch_allowed(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_can_operate(
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(public.current_app_role(), '');
BEGIN
  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  IF NOT public.is_tenant_staff(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF NOT public.pharmacy_branch_allowed(p_branch_id) THEN
    RETURN false;
  END IF;

  RETURN v_role IN (
    'owner',
    'master_admin',
    'branch_manager',
    'pharmacist',
    'cashier',
    'doctor',
    'receptionist',
    'warehouse',
    'procurement',
    'accountant'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pharmacy_can_manage_inventory(
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(public.current_app_role(), '');
BEGIN
  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  IF NOT public.is_tenant_staff(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF NOT public.pharmacy_branch_allowed(p_branch_id) THEN
    RETURN false;
  END IF;

  RETURN public.is_tenant_admin(p_tenant_id)
    OR v_role IN ('owner', 'branch_manager', 'pharmacist', 'warehouse', 'procurement');
END;
$$;

CREATE OR REPLACE FUNCTION public.pharmacy_can_manage_sensitive(
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(public.current_app_role(), '');
BEGIN
  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  IF NOT public.is_tenant_staff(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF NOT public.pharmacy_branch_allowed(p_branch_id) THEN
    RETURN false;
  END IF;

  RETURN public.is_tenant_admin(p_tenant_id)
    OR v_role IN ('owner', 'branch_manager', 'pharmacist');
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_can_operate(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_can_operate(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pharmacy_can_manage_inventory(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_can_manage_inventory(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pharmacy_can_manage_sensitive(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_can_manage_sensitive(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_next_document_number(
  p_doc_type text,
  p_tenant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_document text;
BEGIN
  IF to_regprocedure('public.next_document_number(text,uuid,uuid,date,integer)') IS NOT NULL THEN
    EXECUTE
      'SELECT public.next_document_number($1, $2, $3, CURRENT_DATE, 6)'
      INTO v_document
      USING p_doc_type, p_tenant_id, p_branch_id;
  END IF;

  IF v_document IS NULL OR btrim(v_document) = '' THEN
    v_document := upper(COALESCE(NULLIF(p_doc_type, ''), 'PH'))
      || '-'
      || to_char(now(), 'YYYYMMDD')
      || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  END IF;

  RETURN v_document;
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_next_document_number(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_next_document_number(text, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_safe_audit(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_branch_id uuid DEFAULT NULL,
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF to_regprocedure('public.log_audit_event(uuid,text,text,uuid,jsonb,boolean,uuid)') IS NOT NULL THEN
    EXECUTE
      'SELECT public.log_audit_event($1, $2, $3, $4, $5, $6, $7)'
      USING p_tenant_id, p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::jsonb), p_success, p_branch_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_safe_audit(uuid, text, text, uuid, jsonb, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_safe_audit(uuid, text, text, uuid, jsonb, uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_effective_tax_rate(
  p_tenant_id uuid,
  p_tax_profile_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_rate numeric := 0;
BEGIN
  IF p_tax_profile_id IS NOT NULL
     AND to_regclass('public.tax_profiles') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'SELECT COALESCE(rate, 0) FROM public.tax_profiles WHERE tenant_id = $1 AND id = $2 LIMIT 1'
        INTO v_rate
        USING p_tenant_id, p_tax_profile_id;
    EXCEPTION
      WHEN undefined_column THEN
        v_rate := 0;
    END;
  END IF;

  IF COALESCE(v_rate, 0) = 0
     AND to_regprocedure('public.get_effective_branch_settings(uuid,uuid)') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'SELECT COALESCE((public.get_effective_branch_settings($1, $2))->>''vat_rate'', ''0'')::numeric'
        INTO v_rate
        USING p_tenant_id, p_branch_id;
    EXCEPTION
      WHEN undefined_function THEN
        v_rate := 0;
    END;
  END IF;

  RETURN COALESCE(v_rate, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_effective_tax_rate(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_effective_tax_rate(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_upsert_med_history(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF p_patient_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.pharma_patient_med_history (
    tenant_id,
    patient_id,
    product_id,
    last_dispensed_at,
    last_quantity,
    dispense_count,
    notes
  )
  VALUES (
    p_tenant_id,
    p_patient_id,
    p_product_id,
    now(),
    COALESCE(p_quantity, 0),
    1,
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  ON CONFLICT (tenant_id, patient_id, product_id)
  DO UPDATE SET
    last_dispensed_at = EXCLUDED.last_dispensed_at,
    last_quantity = EXCLUDED.last_quantity,
    dispense_count = public.pharma_patient_med_history.dispense_count + 1,
    notes = COALESCE(EXCLUDED.notes, public.pharma_patient_med_history.notes);
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_upsert_med_history(uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_upsert_med_history(uuid, uuid, uuid, numeric, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Specialized pharmacy tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharma_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  generic_name text,
  brand_name text,
  strength text,
  dosage_form text,
  route text,
  manufacturer text,
  requires_prescription boolean NOT NULL DEFAULT false,
  controlled_drug boolean NOT NULL DEFAULT false,
  refrigerated boolean NOT NULL DEFAULT false,
  narcotic_schedule text,
  tax_profile_id uuid,
  is_otc boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, item_id),
  CONSTRAINT fk_pharma_products_item
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.pharma_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  batch_number text NOT NULL,
  barcode text,
  expiry_date date NOT NULL,
  manufacture_date date,
  qty_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  qty_reserved numeric(14,3) NOT NULL DEFAULT 0,
  qty_damaged numeric(14,3) NOT NULL DEFAULT 0,
  purchase_cost numeric(15,4) NOT NULL DEFAULT 0,
  selling_price numeric(15,4) NOT NULL DEFAULT 0,
  supplier_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, branch_id, product_id, batch_number),
  CONSTRAINT fk_pharma_batches_product
    FOREIGN KEY (tenant_id, product_id)
    REFERENCES public.pharma_products(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_batches_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_batches_supplier
    FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.pharma_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  prescription_number text NOT NULL,
  patient_id uuid NOT NULL,
  doctor_name text,
  doctor_license text,
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'uploaded', 'erx', 'walk_in')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'partially_dispensed', 'dispensed', 'cancelled', 'expired')),
  notes text,
  attachment_url text,
  insurance_provider text,
  policy_number text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, prescription_number),
  CONSTRAINT fk_pharma_prescriptions_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_prescriptions_patient
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharma_prescriptions_created_by
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.pharma_prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL,
  product_id uuid NOT NULL,
  prescribed_qty numeric(14,3) NOT NULL CHECK (prescribed_qty > 0),
  dispensed_qty numeric(14,3) NOT NULL DEFAULT 0 CHECK (dispensed_qty >= 0),
  dosage_instructions text,
  duration_text text,
  substitutions_allowed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_dispensed', 'dispensed', 'cancelled')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_pharma_prescription_items_prescription
    FOREIGN KEY (tenant_id, prescription_id)
    REFERENCES public.pharma_prescriptions(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_prescription_items_product
    FOREIGN KEY (tenant_id, product_id)
    REFERENCES public.pharma_products(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pharma_dispenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  dispense_number text NOT NULL,
  prescription_id uuid,
  patient_id uuid,
  cashier_id uuid,
  pharmacist_id uuid,
  invoice_id uuid,
  dispense_mode text NOT NULL CHECK (dispense_mode IN ('prescription', 'otc')),
  subtotal numeric(15,4) NOT NULL DEFAULT 0,
  tax_amount numeric(15,4) NOT NULL DEFAULT 0,
  discount_amount numeric(15,4) NOT NULL DEFAULT 0,
  total_amount numeric(15,4) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'voided')),
  dispense_status text NOT NULL DEFAULT 'draft' CHECK (dispense_status IN ('draft', 'completed', 'cancelled', 'returned')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, dispense_number),
  CONSTRAINT fk_pharma_dispenses_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_dispenses_prescription
    FOREIGN KEY (tenant_id, prescription_id)
    REFERENCES public.pharma_prescriptions(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_pharma_dispenses_patient
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_pharma_dispenses_cashier
    FOREIGN KEY (tenant_id, cashier_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_pharma_dispenses_pharmacist
    FOREIGN KEY (tenant_id, pharmacist_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_pharma_dispenses_invoice
    FOREIGN KEY (tenant_id, invoice_id)
    REFERENCES public.invoices(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.pharma_dispense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dispense_id uuid NOT NULL,
  prescription_item_id uuid,
  product_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(15,4) NOT NULL,
  discount_amount numeric(15,4) NOT NULL DEFAULT 0,
  tax_amount numeric(15,4) NOT NULL DEFAULT 0,
  line_total numeric(15,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_pharma_dispense_items_dispense
    FOREIGN KEY (tenant_id, dispense_id)
    REFERENCES public.pharma_dispenses(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_dispense_items_prescription_item
    FOREIGN KEY (tenant_id, prescription_item_id)
    REFERENCES public.pharma_prescription_items(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_pharma_dispense_items_product
    FOREIGN KEY (tenant_id, product_id)
    REFERENCES public.pharma_products(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharma_dispense_items_batch
    FOREIGN KEY (tenant_id, batch_id)
    REFERENCES public.pharma_batches(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pharma_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  product_id uuid NOT NULL,
  batch_id uuid,
  movement_type text NOT NULL CHECK (movement_type IN (
    'receive', 'dispense', 'return_customer', 'return_supplier',
    'adjustment', 'expire', 'damage', 'transfer_in', 'transfer_out', 'reserve', 'release'
  )),
  quantity numeric(14,3) NOT NULL,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_pharma_stock_movements_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_stock_movements_product
    FOREIGN KEY (tenant_id, product_id)
    REFERENCES public.pharma_products(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharma_stock_movements_batch
    FOREIGN KEY (tenant_id, batch_id)
    REFERENCES public.pharma_batches(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_pharma_stock_movements_created_by
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.pharma_supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  return_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'completed', 'cancelled')),
  reason text,
  total_amount numeric(15,4) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, return_number),
  CONSTRAINT fk_pharma_supplier_returns_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_supplier_returns_supplier
    FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_pharma_supplier_returns_created_by
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.pharma_supplier_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  return_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(15,4) NOT NULL DEFAULT 0,
  line_total numeric(15,4) NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_pharma_supplier_return_items_return
    FOREIGN KEY (tenant_id, return_id)
    REFERENCES public.pharma_supplier_returns(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_supplier_return_items_batch
    FOREIGN KEY (tenant_id, batch_id)
    REFERENCES public.pharma_batches(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pharma_insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  dispense_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  insurer_name text,
  policy_number text,
  claim_number text,
  approved_amount numeric(15,4) NOT NULL DEFAULT 0,
  claimed_amount numeric(15,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  submission_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_pharma_insurance_claims_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_insurance_claims_dispense
    FOREIGN KEY (tenant_id, dispense_id)
    REFERENCES public.pharma_dispenses(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_insurance_claims_patient
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pharma_patient_med_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  product_id uuid NOT NULL,
  last_dispensed_at timestamptz,
  last_quantity numeric(14,3),
  dispense_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, patient_id, product_id),
  CONSTRAINT fk_pharma_patient_med_history_patient
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_pharma_patient_med_history_product
    FOREIGN KEY (tenant_id, product_id)
    REFERENCES public.pharma_products(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pharma_products_tenant ON public.pharma_products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pharma_products_item ON public.pharma_products(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_pharma_batches_lookup ON public.pharma_batches(tenant_id, branch_id, product_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_pharma_batches_supplier ON public.pharma_batches(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_pharma_prescriptions_queue ON public.pharma_prescriptions(tenant_id, branch_id, status, prescription_date);
CREATE INDEX IF NOT EXISTS idx_pharma_prescriptions_patient ON public.pharma_prescriptions(tenant_id, patient_id, prescription_date DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_prescription_items_prescription ON public.pharma_prescription_items(tenant_id, prescription_id);
CREATE INDEX IF NOT EXISTS idx_pharma_dispenses_branch ON public.pharma_dispenses(tenant_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_dispenses_patient ON public.pharma_dispenses(tenant_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_dispense_items_dispense ON public.pharma_dispense_items(tenant_id, dispense_id);
CREATE INDEX IF NOT EXISTS idx_pharma_stock_movements_branch ON public.pharma_stock_movements(tenant_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_stock_movements_ref ON public.pharma_stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_pharma_supplier_returns_branch ON public.pharma_supplier_returns(tenant_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_insurance_claims_status ON public.pharma_insurance_claims(tenant_id, branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharma_patient_med_history_patient ON public.pharma_patient_med_history(tenant_id, patient_id, last_dispensed_at DESC);

DROP TRIGGER IF EXISTS trg_pharma_products_upd ON public.pharma_products;
CREATE TRIGGER trg_pharma_products_upd BEFORE UPDATE ON public.pharma_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_batches_upd ON public.pharma_batches;
CREATE TRIGGER trg_pharma_batches_upd BEFORE UPDATE ON public.pharma_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_prescriptions_upd ON public.pharma_prescriptions;
CREATE TRIGGER trg_pharma_prescriptions_upd BEFORE UPDATE ON public.pharma_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_prescription_items_upd ON public.pharma_prescription_items;
CREATE TRIGGER trg_pharma_prescription_items_upd BEFORE UPDATE ON public.pharma_prescription_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_dispenses_upd ON public.pharma_dispenses;
CREATE TRIGGER trg_pharma_dispenses_upd BEFORE UPDATE ON public.pharma_dispenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_supplier_returns_upd ON public.pharma_supplier_returns;
CREATE TRIGGER trg_pharma_supplier_returns_upd BEFORE UPDATE ON public.pharma_supplier_returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_insurance_claims_upd ON public.pharma_insurance_claims;
CREATE TRIGGER trg_pharma_insurance_claims_upd BEFORE UPDATE ON public.pharma_insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pharma_patient_med_history_upd ON public.pharma_patient_med_history;
CREATE TRIGGER trg_pharma_patient_med_history_upd BEFORE UPDATE ON public.pharma_patient_med_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Read models
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pharma_batch_availability_v AS
SELECT
  b.id,
  b.tenant_id,
  b.branch_id,
  br.name AS branch_name,
  b.product_id,
  p.item_id,
  i.sku,
  i.barcode AS item_barcode,
  i.name AS item_name,
  i.name_ar AS item_name_ar,
  COALESCE(NULLIF(p.brand_name, ''), i.name) AS brand_name,
  COALESCE(NULLIF(p.generic_name, ''), i.name_ar, i.name) AS generic_name,
  p.strength,
  p.dosage_form,
  p.requires_prescription,
  p.controlled_drug,
  p.refrigerated,
  p.is_otc,
  b.batch_number,
  b.barcode,
  b.expiry_date,
  b.manufacture_date,
  b.qty_on_hand,
  b.qty_reserved,
  b.qty_damaged,
  GREATEST(b.qty_on_hand - b.qty_reserved, 0) AS available_qty,
  b.purchase_cost,
  b.selling_price,
  b.supplier_id,
  c.name AS supplier_name,
  b.received_at,
  b.is_active,
  (b.expiry_date < CURRENT_DATE) AS is_expired,
  ((b.expiry_date >= CURRENT_DATE) AND (b.expiry_date <= CURRENT_DATE + INTERVAL '60 days')) AS is_near_expiry
FROM public.pharma_batches b
JOIN public.pharma_products p
  ON p.tenant_id = b.tenant_id
 AND p.id = b.product_id
JOIN public.items i
  ON i.tenant_id = p.tenant_id
 AND i.id = p.item_id
JOIN public.branches br
  ON br.tenant_id = b.tenant_id
 AND br.id = b.branch_id
LEFT JOIN public.contacts c
  ON c.tenant_id = b.tenant_id
 AND c.id = b.supplier_id;

CREATE OR REPLACE VIEW public.pharma_prescription_queue_v AS
SELECT
  pr.id,
  pr.tenant_id,
  pr.branch_id,
  pr.prescription_number,
  pr.patient_id,
  patient.name AS patient_name,
  pr.doctor_name,
  pr.doctor_license,
  pr.prescription_date,
  pr.source_type,
  pr.status,
  pr.notes,
  pr.insurance_provider,
  pr.policy_number,
  COUNT(pi.id) AS item_count,
  COALESCE(SUM(pi.prescribed_qty), 0) AS prescribed_qty_total,
  COALESCE(SUM(pi.dispensed_qty), 0) AS dispensed_qty_total,
  MAX(pr.updated_at) AS updated_at
FROM public.pharma_prescriptions pr
LEFT JOIN public.contacts patient
  ON patient.tenant_id = pr.tenant_id
 AND patient.id = pr.patient_id
LEFT JOIN public.pharma_prescription_items pi
  ON pi.tenant_id = pr.tenant_id
 AND pi.prescription_id = pr.id
GROUP BY
  pr.id,
  pr.tenant_id,
  pr.branch_id,
  pr.prescription_number,
  pr.patient_id,
  patient.name,
  pr.doctor_name,
  pr.doctor_license,
  pr.prescription_date,
  pr.source_type,
  pr.status,
  pr.notes,
  pr.insurance_provider,
  pr.policy_number;

CREATE OR REPLACE VIEW public.pharma_dispense_history_v AS
SELECT
  d.id,
  d.tenant_id,
  d.branch_id,
  d.dispense_number,
  d.prescription_id,
  d.patient_id,
  patient.name AS patient_name,
  d.cashier_id,
  d.pharmacist_id,
  d.invoice_id,
  d.dispense_mode,
  d.subtotal,
  d.tax_amount,
  d.discount_amount,
  d.total_amount,
  d.payment_status,
  d.dispense_status,
  d.notes,
  d.created_at,
  COUNT(di.id) AS line_count,
  COALESCE(SUM(di.quantity), 0) AS total_quantity
FROM public.pharma_dispenses d
LEFT JOIN public.contacts patient
  ON patient.tenant_id = d.tenant_id
 AND patient.id = d.patient_id
LEFT JOIN public.pharma_dispense_items di
  ON di.tenant_id = d.tenant_id
 AND di.dispense_id = d.id
GROUP BY
  d.id,
  d.tenant_id,
  d.branch_id,
  d.dispense_number,
  d.prescription_id,
  d.patient_id,
  patient.name,
  d.cashier_id,
  d.pharmacist_id,
  d.invoice_id,
  d.dispense_mode,
  d.subtotal,
  d.tax_amount,
  d.discount_amount,
  d.total_amount,
  d.payment_status,
  d.dispense_status,
  d.notes,
  d.created_at;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.pharma_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_dispenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_dispense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_supplier_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharma_patient_med_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharma_products_select ON public.pharma_products;
CREATE POLICY pharma_products_select ON public.pharma_products
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, NULL));

DROP POLICY IF EXISTS pharma_products_manage ON public.pharma_products;
CREATE POLICY pharma_products_manage ON public.pharma_products
  FOR ALL
  USING (public.pharmacy_can_manage_inventory(tenant_id, NULL))
  WITH CHECK (public.pharmacy_can_manage_inventory(tenant_id, NULL));

DROP POLICY IF EXISTS pharma_batches_select ON public.pharma_batches;
CREATE POLICY pharma_batches_select ON public.pharma_batches
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_prescriptions_select ON public.pharma_prescriptions;
CREATE POLICY pharma_prescriptions_select ON public.pharma_prescriptions
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_prescriptions_manage ON public.pharma_prescriptions;
CREATE POLICY pharma_prescriptions_manage ON public.pharma_prescriptions
  FOR ALL
  USING (public.pharmacy_can_manage_sensitive(tenant_id, branch_id))
  WITH CHECK (public.pharmacy_can_manage_sensitive(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_prescription_items_select ON public.pharma_prescription_items;
CREATE POLICY pharma_prescription_items_select ON public.pharma_prescription_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.pharma_prescriptions pr
      WHERE pr.tenant_id = public.pharma_prescription_items.tenant_id
        AND pr.id = public.pharma_prescription_items.prescription_id
        AND public.pharmacy_can_operate(pr.tenant_id, pr.branch_id)
    )
  );

DROP POLICY IF EXISTS pharma_prescription_items_manage ON public.pharma_prescription_items;
CREATE POLICY pharma_prescription_items_manage ON public.pharma_prescription_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.pharma_prescriptions pr
      WHERE pr.tenant_id = public.pharma_prescription_items.tenant_id
        AND pr.id = public.pharma_prescription_items.prescription_id
        AND public.pharmacy_can_manage_sensitive(pr.tenant_id, pr.branch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pharma_prescriptions pr
      WHERE pr.tenant_id = public.pharma_prescription_items.tenant_id
        AND pr.id = public.pharma_prescription_items.prescription_id
        AND public.pharmacy_can_manage_sensitive(pr.tenant_id, pr.branch_id)
    )
  );

DROP POLICY IF EXISTS pharma_dispenses_select ON public.pharma_dispenses;
CREATE POLICY pharma_dispenses_select ON public.pharma_dispenses
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_dispense_items_select ON public.pharma_dispense_items;
CREATE POLICY pharma_dispense_items_select ON public.pharma_dispense_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.pharma_dispenses d
      WHERE d.tenant_id = public.pharma_dispense_items.tenant_id
        AND d.id = public.pharma_dispense_items.dispense_id
        AND public.pharmacy_can_operate(d.tenant_id, d.branch_id)
    )
  );

DROP POLICY IF EXISTS pharma_stock_movements_select ON public.pharma_stock_movements;
CREATE POLICY pharma_stock_movements_select ON public.pharma_stock_movements
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_supplier_returns_select ON public.pharma_supplier_returns;
CREATE POLICY pharma_supplier_returns_select ON public.pharma_supplier_returns
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_supplier_return_items_select ON public.pharma_supplier_return_items;
CREATE POLICY pharma_supplier_return_items_select ON public.pharma_supplier_return_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.pharma_supplier_returns sr
      WHERE sr.tenant_id = public.pharma_supplier_return_items.tenant_id
        AND sr.id = public.pharma_supplier_return_items.return_id
        AND public.pharmacy_can_operate(sr.tenant_id, sr.branch_id)
    )
  );

DROP POLICY IF EXISTS pharma_insurance_claims_select ON public.pharma_insurance_claims;
CREATE POLICY pharma_insurance_claims_select ON public.pharma_insurance_claims
  FOR SELECT USING (public.pharmacy_can_manage_sensitive(tenant_id, branch_id));

DROP POLICY IF EXISTS pharma_patient_med_history_select ON public.pharma_patient_med_history;
CREATE POLICY pharma_patient_med_history_select ON public.pharma_patient_med_history
  FOR SELECT USING (public.pharmacy_can_operate(tenant_id, NULL));

-- -----------------------------------------------------------------------------
-- Internal helpers for RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_allocate_fefo(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_requested_qty numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_created_by uuid,
  p_note text DEFAULT NULL
)
RETURNS TABLE (
  batch_id uuid,
  allocated_qty numeric,
  unit_price numeric,
  tax_rate numeric,
  tax_amount numeric,
  line_total numeric,
  expiry_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_remaining numeric := COALESCE(p_requested_qty, 0);
  v_batch record;
  v_available numeric;
  v_take numeric;
  v_tax_rate numeric := 0;
BEGIN
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'الكمية المطلوبة للصرف يجب أن تكون أكبر من صفر';
  END IF;

  SELECT public.pharmacy_effective_tax_rate(p_tenant_id, p.tax_profile_id, p_branch_id)
    INTO v_tax_rate
  FROM public.pharma_products p
  WHERE p.tenant_id = p_tenant_id
    AND p.id = p_product_id;

  FOR v_batch IN
    SELECT *
    FROM public.pharma_batches b
    WHERE b.tenant_id = p_tenant_id
      AND b.branch_id = p_branch_id
      AND b.product_id = p_product_id
      AND b.is_active IS TRUE
      AND b.expiry_date >= CURRENT_DATE
    ORDER BY b.expiry_date ASC, b.received_at ASC, b.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_available := GREATEST(v_batch.qty_on_hand - v_batch.qty_reserved, 0);
    IF v_available <= 0 THEN
      CONTINUE;
    END IF;

    v_take := LEAST(v_remaining, v_available);

    UPDATE public.pharma_batches
    SET
      qty_on_hand = qty_on_hand - v_take,
      updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND id = v_batch.id;

    INSERT INTO public.pharma_stock_movements (
      tenant_id,
      branch_id,
      product_id,
      batch_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      note,
      created_by
    )
    VALUES (
      p_tenant_id,
      p_branch_id,
      p_product_id,
      v_batch.id,
      'dispense',
      -v_take,
      p_reference_type,
      p_reference_id,
      COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'تم الصرف بنظام FEFO'),
      p_created_by
    );

    batch_id := v_batch.id;
    allocated_qty := v_take;
    unit_price := COALESCE(v_batch.selling_price, 0);
    tax_rate := COALESCE(v_tax_rate, 0);
    tax_amount := ROUND((allocated_qty * unit_price) * (tax_rate / 100), 4);
    line_total := ROUND((allocated_qty * unit_price) + tax_amount, 4);
    expiry_date := v_batch.expiry_date;

    RETURN NEXT;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'لا توجد كمية متاحة كافية للصنف المطلوب في الفرع الحالي. المتبقي غير المخصص: %', v_remaining;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_allocate_fefo(uuid, uuid, uuid, numeric, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_allocate_fefo(uuid, uuid, uuid, numeric, text, uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_apply_invoice_payments(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_invoice_id uuid,
  p_contact_id uuid,
  p_received_by uuid,
  p_payments jsonb
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_payment jsonb;
  v_method text;
  v_amount numeric;
  v_total_paid numeric := 0;
BEGIN
  FOR v_payment IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    v_amount := COALESCE((v_payment ->> 'amount')::numeric, 0);
    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    v_method := COALESCE(NULLIF(lower(v_payment ->> 'method'), ''), 'cash');
    IF v_method = 'transfer' THEN
      v_method := 'bank_transfer';
    END IF;
    IF v_method NOT IN ('cash', 'card', 'bank_transfer', 'mada', 'apple_pay', 'google_pay', 'online') THEN
      RAISE EXCEPTION 'طريقة الدفع غير مدعومة: %', v_method;
    END IF;

    INSERT INTO public.payments (
      tenant_id,
      branch_id,
      reference_type,
      reference_id,
      contact_id,
      amount,
      method,
      status,
      transaction_ref,
      notes,
      received_by,
      paid_at
    )
    VALUES (
      p_tenant_id,
      p_branch_id,
      'invoice',
      p_invoice_id,
      p_contact_id,
      v_amount,
      v_method,
      'completed',
      NULLIF(btrim(COALESCE(v_payment ->> 'transaction_ref', '')), ''),
      NULLIF(btrim(COALESCE(v_payment ->> 'note', '')), ''),
      p_received_by,
      now()
    );

    v_total_paid := v_total_paid + v_amount;
  END LOOP;

  RETURN v_total_paid;
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_apply_invoice_payments(uuid, uuid, uuid, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_apply_invoice_payments(uuid, uuid, uuid, uuid, uuid, jsonb) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: Receiving
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_receive_batches(
  p_branch_id uuid,
  p_lines jsonb,
  p_supplier_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_line jsonb;
  v_product_id uuid;
  v_batch_id uuid;
  v_supplier_id uuid;
  v_qty numeric;
  v_batch_number text;
  v_expiry_date date;
  v_purchase_cost numeric;
  v_selling_price numeric;
  v_received_count integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لاستلام الدفعات';
  END IF;

  IF NOT public.pharmacy_can_manage_inventory(v_tenant_id, p_branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية استلام دفعات صيدلية لهذا الفرع';
  END IF;

  IF jsonb_typeof(COALESCE(p_lines, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'يجب إرسال قائمة دفعات صحيحة للاستلام';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := NULLIF(v_line ->> 'product_id', '')::uuid;
    v_batch_number := NULLIF(btrim(COALESCE(v_line ->> 'batch_number', '')), '');
    v_expiry_date := NULLIF(v_line ->> 'expiry_date', '')::date;
    v_qty := COALESCE((v_line ->> 'quantity')::numeric, 0);
    v_purchase_cost := COALESCE((v_line ->> 'purchase_cost')::numeric, 0);
    v_selling_price := COALESCE((v_line ->> 'selling_price')::numeric, 0);
    v_supplier_id := COALESCE(NULLIF(v_line ->> 'supplier_id', '')::uuid, p_supplier_id);

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'كل سطر استلام يجب أن يحتوي product_id صالحًا';
    END IF;

    IF v_batch_number IS NULL THEN
      RAISE EXCEPTION 'كل سطر استلام يجب أن يحتوي batch_number';
    END IF;

    IF v_expiry_date IS NULL THEN
      RAISE EXCEPTION 'كل سطر استلام يجب أن يحتوي expiry_date';
    END IF;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'كمية الاستلام يجب أن تكون أكبر من صفر للدفعة %', v_batch_number;
    END IF;

    INSERT INTO public.pharma_batches (
      tenant_id,
      product_id,
      branch_id,
      batch_number,
      barcode,
      expiry_date,
      manufacture_date,
      qty_on_hand,
      purchase_cost,
      selling_price,
      supplier_id,
      received_at,
      is_active
    )
    VALUES (
      v_tenant_id,
      v_product_id,
      p_branch_id,
      v_batch_number,
      NULLIF(btrim(COALESCE(v_line ->> 'barcode', '')), ''),
      v_expiry_date,
      NULLIF(v_line ->> 'manufacture_date', '')::date,
      v_qty,
      v_purchase_cost,
      v_selling_price,
      v_supplier_id,
      now(),
      true
    )
    ON CONFLICT (tenant_id, branch_id, product_id, batch_number)
    DO UPDATE SET
      barcode = COALESCE(EXCLUDED.barcode, public.pharma_batches.barcode),
      expiry_date = EXCLUDED.expiry_date,
      manufacture_date = COALESCE(EXCLUDED.manufacture_date, public.pharma_batches.manufacture_date),
      qty_on_hand = public.pharma_batches.qty_on_hand + EXCLUDED.qty_on_hand,
      purchase_cost = EXCLUDED.purchase_cost,
      selling_price = EXCLUDED.selling_price,
      supplier_id = COALESCE(EXCLUDED.supplier_id, public.pharma_batches.supplier_id),
      received_at = now(),
      is_active = true,
      updated_at = now()
    RETURNING id INTO v_batch_id;

    INSERT INTO public.pharma_stock_movements (
      tenant_id,
      branch_id,
      product_id,
      batch_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      note,
      created_by
    )
    VALUES (
      v_tenant_id,
      p_branch_id,
      v_product_id,
      v_batch_id,
      'receive',
      v_qty,
      'receive_batches',
      v_batch_id,
      COALESCE(NULLIF(btrim(COALESCE(v_line ->> 'note', '')), ''), p_note, 'استلام دفعة صيدلية'),
      v_user_id
    );

    v_received_count := v_received_count + 1;
  END LOOP;

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_receive_batches',
    'pharma_batches',
    NULL,
    jsonb_build_object('branch_id', p_branch_id, 'line_count', v_received_count),
    p_branch_id,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'received_count', v_received_count,
    'branch_id', p_branch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_receive_batches(uuid, jsonb, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_receive_batches(uuid, jsonb, uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: Prescription dispensing
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_dispense_prescription(
  p_prescription_id uuid,
  p_branch_id uuid,
  p_lines jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL,
  p_controlled_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_prescription public.pharma_prescriptions%ROWTYPE;
  v_line jsonb;
  v_prescription_item public.pharma_prescription_items%ROWTYPE;
  v_product public.pharma_products%ROWTYPE;
  v_requested_qty numeric;
  v_remaining_qty numeric;
  v_dispense_id uuid;
  v_invoice_id uuid;
  v_dispense_no text;
  v_invoice_no text;
  v_item_subtotal numeric;
  v_item_tax numeric;
  v_item_total numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_paid numeric := 0;
  v_all_dispensed boolean := true;
  v_any_dispensed boolean := false;
  v_alloc record;
  v_item_name text;
  v_item_name_ar text;
  v_line_index integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لصرف الوصفة';
  END IF;

  IF NOT public.pharmacy_can_manage_sensitive(v_tenant_id, p_branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية صرف وصفة في هذا الفرع';
  END IF;

  SELECT *
    INTO v_prescription
  FROM public.pharma_prescriptions
  WHERE tenant_id = v_tenant_id
    AND id = p_prescription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الوصفة المطلوبة غير موجودة';
  END IF;

  IF v_prescription.branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'الوصفة مرتبطة بفرع مختلف ولا يمكن صرفها من هذا الفرع';
  END IF;

  IF v_prescription.status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'لا يمكن صرف وصفة حالتها %', v_prescription.status;
  END IF;

  IF jsonb_typeof(COALESCE(p_lines, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'يجب إرسال بنود الصرف المراد تنفيذها';
  END IF;

  v_dispense_no := public.pharmacy_next_document_number('PHDSP', v_tenant_id, p_branch_id);

  INSERT INTO public.pharma_dispenses (
    tenant_id,
    branch_id,
    dispense_number,
    prescription_id,
    patient_id,
    cashier_id,
    pharmacist_id,
    dispense_mode,
    notes
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    v_dispense_no,
    p_prescription_id,
    v_prescription.patient_id,
    v_user_id,
    v_user_id,
    'prescription',
    COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), NULL)
  )
  RETURNING id INTO v_dispense_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT *
      INTO v_prescription_item
    FROM public.pharma_prescription_items
    WHERE tenant_id = v_tenant_id
      AND id = NULLIF(v_line ->> 'prescription_item_id', '')::uuid
      AND prescription_id = p_prescription_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'أحد بنود الوصفة غير موجود أو لا ينتمي للوصفة الحالية';
    END IF;

    SELECT *
      INTO v_product
    FROM public.pharma_products
    WHERE tenant_id = v_tenant_id
      AND id = v_prescription_item.product_id;

    IF NOT FOUND OR v_product.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'أحد الأصناف الدوائية غير متاح للصرف';
    END IF;

    IF v_product.controlled_drug AND NULLIF(btrim(COALESCE(p_controlled_note, '')), '') IS NULL THEN
      RAISE EXCEPTION 'الصنف % مادة خاضعة للرقابة ويستلزم ملاحظة تدقيق قبل الصرف', v_product.brand_name;
    END IF;

    v_remaining_qty := GREATEST(v_prescription_item.prescribed_qty - v_prescription_item.dispensed_qty, 0);
    v_requested_qty := COALESCE((v_line ->> 'quantity')::numeric, v_remaining_qty);

    IF v_requested_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية المصروفة يجب أن تكون أكبر من صفر';
    END IF;

    IF v_requested_qty > v_remaining_qty THEN
      RAISE EXCEPTION 'الكمية المطلوبة (%) تتجاوز الكمية المتبقية في الوصفة (%)', v_requested_qty, v_remaining_qty;
    END IF;

    v_item_subtotal := 0;
    v_item_tax := 0;
    v_item_total := 0;

    FOR v_alloc IN
      SELECT *
      FROM public.pharmacy_allocate_fefo(
        v_tenant_id,
        p_branch_id,
        v_product.id,
        v_requested_qty,
        'prescription_dispense',
        v_dispense_id,
        v_user_id,
        COALESCE(NULLIF(btrim(COALESCE(p_controlled_note, '')), ''), p_notes)
      )
    LOOP
      INSERT INTO public.pharma_dispense_items (
        tenant_id,
        dispense_id,
        prescription_item_id,
        product_id,
        batch_id,
        quantity,
        unit_price,
        discount_amount,
        tax_amount,
        line_total
      )
      VALUES (
        v_tenant_id,
        v_dispense_id,
        v_prescription_item.id,
        v_product.id,
        v_alloc.batch_id,
        v_alloc.allocated_qty,
        v_alloc.unit_price,
        0,
        v_alloc.tax_amount,
        v_alloc.line_total
      );

      v_item_subtotal := v_item_subtotal + (v_alloc.allocated_qty * v_alloc.unit_price);
      v_item_tax := v_item_tax + v_alloc.tax_amount;
      v_item_total := v_item_total + v_alloc.line_total;
    END LOOP;

    UPDATE public.pharma_prescription_items
    SET
      dispensed_qty = dispensed_qty + v_requested_qty,
      status = CASE
        WHEN (dispensed_qty + v_requested_qty) >= prescribed_qty THEN 'dispensed'
        WHEN (dispensed_qty + v_requested_qty) > 0 THEN 'partially_dispensed'
        ELSE 'pending'
      END,
      updated_at = now()
    WHERE tenant_id = v_tenant_id
      AND id = v_prescription_item.id;

    PERFORM public.pharmacy_upsert_med_history(
      v_tenant_id,
      v_prescription.patient_id,
      v_product.id,
      v_requested_qty,
      p_notes
    );

    v_subtotal := v_subtotal + v_item_subtotal;
    v_tax := v_tax + v_item_tax;
    v_total := v_total + v_item_total;
    v_any_dispensed := true;
  END LOOP;

  SELECT bool_and(status = 'dispensed'), bool_or(status IN ('dispensed', 'partially_dispensed'))
    INTO v_all_dispensed, v_any_dispensed
  FROM public.pharma_prescription_items
  WHERE tenant_id = v_tenant_id
    AND prescription_id = p_prescription_id;

  UPDATE public.pharma_prescriptions
  SET
    status = CASE
      WHEN v_all_dispensed THEN 'dispensed'
      WHEN v_any_dispensed THEN 'partially_dispensed'
      ELSE status
    END,
    updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = p_prescription_id;

  v_invoice_no := public.pharmacy_next_document_number('PHINV', v_tenant_id, p_branch_id);

  INSERT INTO public.invoices (
    tenant_id,
    branch_id,
    invoice_no,
    invoice_type,
    status,
    contact_id,
    issue_date,
    subtotal,
    discount_amount,
    taxable_amount,
    tax_amount,
    total,
    amount_paid,
    currency,
    notes,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    v_invoice_no,
    'sale',
    'sent',
    v_prescription.patient_id,
    CURRENT_DATE,
    ROUND(v_subtotal, 2),
    0,
    ROUND(v_subtotal, 2),
    ROUND(v_tax, 2),
    ROUND(v_total, 2),
    0,
    'AED',
    COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), 'فاتورة صرف وصفة طبية'),
    v_user_id
  )
  RETURNING id INTO v_invoice_id;

  FOR v_line IN
    SELECT
      di.product_id,
      SUM(di.quantity) AS quantity,
      MIN(di.unit_price) AS unit_price,
      SUM(di.tax_amount) AS tax_amount,
      SUM(di.line_total) AS line_total
    FROM public.pharma_dispense_items di
    WHERE di.tenant_id = v_tenant_id
      AND di.dispense_id = v_dispense_id
    GROUP BY di.product_id
  LOOP
    v_line_index := v_line_index + 1;

    SELECT i.name, i.name_ar
      INTO v_item_name, v_item_name_ar
    FROM public.pharma_products p
    JOIN public.items i
      ON i.tenant_id = p.tenant_id
     AND i.id = p.item_id
    WHERE p.tenant_id = v_tenant_id
      AND p.id = v_line.product_id;

    INSERT INTO public.invoice_items (
      tenant_id,
      invoice_id,
      item_ref,
      name,
      name_ar,
      quantity,
      unit_price,
      discount_pct,
      discount_amount,
      net_amount,
      tax_rate,
      tax_amount,
      line_total,
      sort_order
    )
    VALUES (
      v_tenant_id,
      v_invoice_id,
      v_line.product_id::text,
      COALESCE(v_item_name, 'دواء'),
      v_item_name_ar,
      v_line.quantity,
      ROUND(v_line.unit_price, 4),
      0,
      0,
      ROUND(v_line.line_total - v_line.tax_amount, 2),
      0,
      ROUND(v_line.tax_amount, 2),
      ROUND(v_line.line_total, 2),
      v_line_index
    );
  END LOOP;

  v_paid := public.pharmacy_apply_invoice_payments(
    v_tenant_id,
    p_branch_id,
    v_invoice_id,
    v_prescription.patient_id,
    v_user_id,
    p_payments
  );

  UPDATE public.invoices
  SET
    amount_paid = ROUND(v_paid, 2),
    status = CASE
      WHEN v_paid >= ROUND(v_total, 2) THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      ELSE 'sent'
    END,
    updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = v_invoice_id;

  UPDATE public.pharma_dispenses
  SET
    subtotal = ROUND(v_subtotal, 4),
    tax_amount = ROUND(v_tax, 4),
    total_amount = ROUND(v_total, 4),
    invoice_id = v_invoice_id,
    payment_status = CASE
      WHEN v_paid >= ROUND(v_total, 2) THEN 'paid'
      WHEN v_paid > 0 THEN 'partially_paid'
      ELSE 'pending'
    END,
    dispense_status = 'completed',
    updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = v_dispense_id;

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_dispense_prescription',
    'pharma_dispenses',
    v_dispense_id,
    jsonb_build_object(
      'prescription_id', p_prescription_id,
      'invoice_id', v_invoice_id,
      'total', ROUND(v_total, 2),
      'paid', ROUND(v_paid, 2)
    ),
    p_branch_id,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispense_id', v_dispense_id,
    'dispense_number', v_dispense_no,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_no,
    'total_amount', ROUND(v_total, 2),
    'paid_amount', ROUND(v_paid, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_dispense_prescription(uuid, uuid, jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_dispense_prescription(uuid, uuid, jsonb, jsonb, text, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: OTC sale
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_complete_otc_sale(
  p_branch_id uuid,
  p_lines jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_patient_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_allow_rx_override boolean DEFAULT false,
  p_controlled_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_line jsonb;
  v_product public.pharma_products%ROWTYPE;
  v_requested_qty numeric;
  v_dispense_id uuid;
  v_invoice_id uuid;
  v_dispense_no text;
  v_invoice_no text;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_paid numeric := 0;
  v_item_name text;
  v_item_name_ar text;
  v_alloc record;
  v_line_index integer := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لإتمام بيع OTC';
  END IF;

  IF NOT public.pharmacy_can_operate(v_tenant_id, p_branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إتمام بيع OTC لهذا الفرع';
  END IF;

  IF jsonb_typeof(COALESCE(p_lines, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'سلة بيع OTC فارغة';
  END IF;

  v_dispense_no := public.pharmacy_next_document_number('OTC', v_tenant_id, p_branch_id);

  INSERT INTO public.pharma_dispenses (
    tenant_id,
    branch_id,
    dispense_number,
    patient_id,
    cashier_id,
    pharmacist_id,
    dispense_mode,
    notes
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    v_dispense_no,
    p_patient_id,
    v_user_id,
    v_user_id,
    'otc',
    COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), NULL)
  )
  RETURNING id INTO v_dispense_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT *
      INTO v_product
    FROM public.pharma_products
    WHERE tenant_id = v_tenant_id
      AND id = NULLIF(v_line ->> 'product_id', '')::uuid;

    IF NOT FOUND OR v_product.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'أحد أصناف OTC المطلوبة غير متاح';
    END IF;

    IF v_product.requires_prescription AND NOT p_allow_rx_override THEN
      RAISE EXCEPTION 'الصنف % يتطلب وصفة طبية ولا يمكن بيعه من مسار OTC', COALESCE(v_product.brand_name, v_product.generic_name, 'دواء');
    END IF;

    IF v_product.controlled_drug AND NULLIF(btrim(COALESCE(p_controlled_note, '')), '') IS NULL THEN
      RAISE EXCEPTION 'الصنف % مادة خاضعة للرقابة ويستلزم ملاحظة تدقيق قبل البيع', COALESCE(v_product.brand_name, v_product.generic_name, 'دواء');
    END IF;

    v_requested_qty := COALESCE((v_line ->> 'quantity')::numeric, 0);
    IF v_requested_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية المطلوبة يجب أن تكون أكبر من صفر';
    END IF;

    FOR v_alloc IN
      SELECT *
      FROM public.pharmacy_allocate_fefo(
        v_tenant_id,
        p_branch_id,
        v_product.id,
        v_requested_qty,
        'otc_sale',
        v_dispense_id,
        v_user_id,
        COALESCE(NULLIF(btrim(COALESCE(p_controlled_note, '')), ''), p_notes)
      )
    LOOP
      INSERT INTO public.pharma_dispense_items (
        tenant_id,
        dispense_id,
        product_id,
        batch_id,
        quantity,
        unit_price,
        discount_amount,
        tax_amount,
        line_total
      )
      VALUES (
        v_tenant_id,
        v_dispense_id,
        v_product.id,
        v_alloc.batch_id,
        v_alloc.allocated_qty,
        v_alloc.unit_price,
        0,
        v_alloc.tax_amount,
        v_alloc.line_total
      );

      v_subtotal := v_subtotal + (v_alloc.allocated_qty * v_alloc.unit_price);
      v_tax := v_tax + v_alloc.tax_amount;
      v_total := v_total + v_alloc.line_total;
    END LOOP;

    PERFORM public.pharmacy_upsert_med_history(
      v_tenant_id,
      p_patient_id,
      v_product.id,
      v_requested_qty,
      p_notes
    );
  END LOOP;

  v_invoice_no := public.pharmacy_next_document_number('PHINV', v_tenant_id, p_branch_id);

  INSERT INTO public.invoices (
    tenant_id,
    branch_id,
    invoice_no,
    invoice_type,
    status,
    contact_id,
    issue_date,
    subtotal,
    discount_amount,
    taxable_amount,
    tax_amount,
    total,
    amount_paid,
    currency,
    notes,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    v_invoice_no,
    'sale',
    'sent',
    p_patient_id,
    CURRENT_DATE,
    ROUND(v_subtotal, 2),
    0,
    ROUND(v_subtotal, 2),
    ROUND(v_tax, 2),
    ROUND(v_total, 2),
    0,
    'AED',
    COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), 'فاتورة OTC'),
    v_user_id
  )
  RETURNING id INTO v_invoice_id;

  FOR v_line IN
    SELECT
      di.product_id,
      SUM(di.quantity) AS quantity,
      MIN(di.unit_price) AS unit_price,
      SUM(di.tax_amount) AS tax_amount,
      SUM(di.line_total) AS line_total
    FROM public.pharma_dispense_items di
    WHERE di.tenant_id = v_tenant_id
      AND di.dispense_id = v_dispense_id
    GROUP BY di.product_id
  LOOP
    v_line_index := v_line_index + 1;

    SELECT i.name, i.name_ar
      INTO v_item_name, v_item_name_ar
    FROM public.pharma_products p
    JOIN public.items i
      ON i.tenant_id = p.tenant_id
     AND i.id = p.item_id
    WHERE p.tenant_id = v_tenant_id
      AND p.id = v_line.product_id;

    INSERT INTO public.invoice_items (
      tenant_id,
      invoice_id,
      item_ref,
      name,
      name_ar,
      quantity,
      unit_price,
      discount_pct,
      discount_amount,
      net_amount,
      tax_rate,
      tax_amount,
      line_total,
      sort_order
    )
    VALUES (
      v_tenant_id,
      v_invoice_id,
      v_line.product_id::text,
      COALESCE(v_item_name, 'دواء'),
      v_item_name_ar,
      v_line.quantity,
      ROUND(v_line.unit_price, 4),
      0,
      0,
      ROUND(v_line.line_total - v_line.tax_amount, 2),
      0,
      ROUND(v_line.tax_amount, 2),
      ROUND(v_line.line_total, 2),
      v_line_index
    );
  END LOOP;

  v_paid := public.pharmacy_apply_invoice_payments(
    v_tenant_id,
    p_branch_id,
    v_invoice_id,
    p_patient_id,
    v_user_id,
    p_payments
  );

  UPDATE public.invoices
  SET
    amount_paid = ROUND(v_paid, 2),
    status = CASE
      WHEN v_paid >= ROUND(v_total, 2) THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      ELSE 'sent'
    END,
    updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = v_invoice_id;

  UPDATE public.pharma_dispenses
  SET
    subtotal = ROUND(v_subtotal, 4),
    tax_amount = ROUND(v_tax, 4),
    total_amount = ROUND(v_total, 4),
    invoice_id = v_invoice_id,
    payment_status = CASE
      WHEN v_paid >= ROUND(v_total, 2) THEN 'paid'
      WHEN v_paid > 0 THEN 'partially_paid'
      ELSE 'pending'
    END,
    dispense_status = 'completed',
    updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = v_dispense_id;

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_complete_otc_sale',
    'pharma_dispenses',
    v_dispense_id,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'total', ROUND(v_total, 2),
      'paid', ROUND(v_paid, 2)
    ),
    p_branch_id,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispense_id', v_dispense_id,
    'dispense_number', v_dispense_no,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_no,
    'total_amount', ROUND(v_total, 2),
    'paid_amount', ROUND(v_paid, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_complete_otc_sale(uuid, jsonb, jsonb, uuid, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_complete_otc_sale(uuid, jsonb, jsonb, uuid, text, boolean, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: Supplier return / expiry / adjustment / insurance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_return_to_supplier(
  p_branch_id uuid,
  p_supplier_id uuid,
  p_lines jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_return_id uuid;
  v_return_no text;
  v_line jsonb;
  v_batch public.pharma_batches%ROWTYPE;
  v_qty numeric;
  v_total numeric := 0;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لإنشاء مرتجع مورد';
  END IF;

  IF NOT public.pharmacy_can_manage_inventory(v_tenant_id, p_branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إنشاء مرتجع مورد لهذا الفرع';
  END IF;

  IF jsonb_typeof(COALESCE(p_lines, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'يجب إرسال بنود مرتجع المورد';
  END IF;

  v_return_no := public.pharmacy_next_document_number('PHSR', v_tenant_id, p_branch_id);

  INSERT INTO public.pharma_supplier_returns (
    tenant_id,
    branch_id,
    supplier_id,
    return_number,
    status,
    reason,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    p_supplier_id,
    v_return_no,
    'completed',
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    v_user_id
  )
  RETURNING id INTO v_return_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT *
      INTO v_batch
    FROM public.pharma_batches
    WHERE tenant_id = v_tenant_id
      AND id = NULLIF(v_line ->> 'batch_id', '')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'إحدى الدفعات المراد إرجاعها غير موجودة';
    END IF;

    IF v_batch.branch_id <> p_branch_id THEN
      RAISE EXCEPTION 'لا يمكن إرجاع دفعة من فرع مختلف';
    END IF;

    v_qty := COALESCE((v_line ->> 'quantity')::numeric, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'كمية المرتجع يجب أن تكون أكبر من صفر';
    END IF;

    IF v_qty > GREATEST(v_batch.qty_on_hand - v_batch.qty_reserved, 0) THEN
      RAISE EXCEPTION 'كمية المرتجع تتجاوز المتاح في الدفعة %', v_batch.batch_number;
    END IF;

    UPDATE public.pharma_batches
    SET
      qty_on_hand = qty_on_hand - v_qty,
      updated_at = now(),
      is_active = CASE
        WHEN (qty_on_hand - v_qty) > 0 THEN is_active
        ELSE false
      END
    WHERE tenant_id = v_tenant_id
      AND id = v_batch.id;

    INSERT INTO public.pharma_supplier_return_items (
      tenant_id,
      return_id,
      batch_id,
      quantity,
      unit_cost,
      line_total,
      reason
    )
    VALUES (
      v_tenant_id,
      v_return_id,
      v_batch.id,
      v_qty,
      v_batch.purchase_cost,
      ROUND(v_qty * v_batch.purchase_cost, 4),
      COALESCE(NULLIF(btrim(COALESCE(v_line ->> 'reason', '')), ''), p_reason)
    );

    INSERT INTO public.pharma_stock_movements (
      tenant_id,
      branch_id,
      product_id,
      batch_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      note,
      created_by
    )
    VALUES (
      v_tenant_id,
      p_branch_id,
      v_batch.product_id,
      v_batch.id,
      'return_supplier',
      -v_qty,
      'supplier_return',
      v_return_id,
      COALESCE(NULLIF(btrim(COALESCE(v_line ->> 'reason', '')), ''), p_reason, 'مرتجع مورد'),
      v_user_id
    );

    v_total := v_total + ROUND(v_qty * v_batch.purchase_cost, 4);
  END LOOP;

  UPDATE public.pharma_supplier_returns
  SET
    total_amount = ROUND(v_total, 4),
    updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = v_return_id;

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_return_to_supplier',
    'pharma_supplier_returns',
    v_return_id,
    jsonb_build_object('total_amount', ROUND(v_total, 4), 'line_count', jsonb_array_length(p_lines)),
    p_branch_id,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_no,
    'total_amount', ROUND(v_total, 4)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_return_to_supplier(uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_return_to_supplier(uuid, uuid, jsonb, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_mark_batch_expired(
  p_batch_id uuid,
  p_quantity numeric DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_batch public.pharma_batches%ROWTYPE;
  v_qty numeric;
BEGIN
  SELECT *
    INTO v_batch
  FROM public.pharma_batches
  WHERE tenant_id = v_tenant_id
    AND id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدفعة المطلوب تعليمها كمنتهية غير موجودة';
  END IF;

  IF NOT public.pharmacy_can_manage_inventory(v_tenant_id, v_batch.branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل صلاحية هذه الدفعة';
  END IF;

  v_qty := COALESCE(p_quantity, GREATEST(v_batch.qty_on_hand - v_batch.qty_reserved, 0));
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'لا توجد كمية صالحة للنقل إلى منتهي الصلاحية';
  END IF;

  IF v_qty > GREATEST(v_batch.qty_on_hand - v_batch.qty_reserved, 0) THEN
    RAISE EXCEPTION 'الكمية المطلوبة تتجاوز المتاح في الدفعة';
  END IF;

  UPDATE public.pharma_batches
  SET
    qty_on_hand = qty_on_hand - v_qty,
    updated_at = now(),
    is_active = CASE WHEN (qty_on_hand - v_qty) > 0 THEN is_active ELSE false END
  WHERE tenant_id = v_tenant_id
    AND id = p_batch_id;

  INSERT INTO public.pharma_stock_movements (
    tenant_id,
    branch_id,
    product_id,
    batch_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    note,
    created_by
  )
  VALUES (
    v_tenant_id,
    v_batch.branch_id,
    v_batch.product_id,
    v_batch.id,
    'expire',
    -v_qty,
    'batch_expiry',
    v_batch.id,
    COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'تعليم دفعة كمنتهية/إخراج كمية منتهية'),
    v_user_id
  );

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_mark_batch_expired',
    'pharma_batches',
    v_batch.id,
    jsonb_build_object('quantity', v_qty),
    v_batch.branch_id,
    true
  );

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch.id, 'expired_quantity', v_qty);
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_mark_batch_expired(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_mark_batch_expired(uuid, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_adjust_batch_stock(
  p_batch_id uuid,
  p_adjustment_qty numeric,
  p_movement_type text DEFAULT 'adjustment',
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_batch public.pharma_batches%ROWTYPE;
BEGIN
  SELECT *
    INTO v_batch
  FROM public.pharma_batches
  WHERE tenant_id = v_tenant_id
    AND id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدفعة المطلوب تعديلها غير موجودة';
  END IF;

  IF NOT public.pharmacy_can_manage_inventory(v_tenant_id, v_batch.branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل هذه الدفعة';
  END IF;

  IF p_movement_type NOT IN ('adjustment', 'damage', 'reserve', 'release') THEN
    RAISE EXCEPTION 'نوع الحركة غير مدعوم في تعديل المخزون: %', p_movement_type;
  END IF;

  IF p_adjustment_qty = 0 THEN
    RAISE EXCEPTION 'قيمة التعديل يجب ألا تساوي صفرًا';
  END IF;

  IF p_movement_type = 'reserve' THEN
    IF p_adjustment_qty < 0 OR p_adjustment_qty > GREATEST(v_batch.qty_on_hand - v_batch.qty_reserved, 0) THEN
      RAISE EXCEPTION 'كمية الحجز غير صالحة لهذه الدفعة';
    END IF;

    UPDATE public.pharma_batches
    SET qty_reserved = qty_reserved + p_adjustment_qty,
        updated_at = now()
    WHERE tenant_id = v_tenant_id
      AND id = p_batch_id;
  ELSIF p_movement_type = 'release' THEN
    IF p_adjustment_qty < 0 OR p_adjustment_qty > v_batch.qty_reserved THEN
      RAISE EXCEPTION 'كمية فك الحجز غير صالحة لهذه الدفعة';
    END IF;

    UPDATE public.pharma_batches
    SET qty_reserved = qty_reserved - p_adjustment_qty,
        updated_at = now()
    WHERE tenant_id = v_tenant_id
      AND id = p_batch_id;
  ELSIF p_movement_type = 'damage' THEN
    IF p_adjustment_qty < 0 OR p_adjustment_qty > GREATEST(v_batch.qty_on_hand - v_batch.qty_reserved, 0) THEN
      RAISE EXCEPTION 'كمية التلف غير صالحة لهذه الدفعة';
    END IF;

    UPDATE public.pharma_batches
    SET
      qty_on_hand = qty_on_hand - p_adjustment_qty,
      qty_damaged = qty_damaged + p_adjustment_qty,
      updated_at = now(),
      is_active = CASE WHEN (qty_on_hand - p_adjustment_qty) > 0 THEN is_active ELSE false END
    WHERE tenant_id = v_tenant_id
      AND id = p_batch_id;
  ELSE
    IF (v_batch.qty_on_hand + p_adjustment_qty) < v_batch.qty_reserved THEN
      RAISE EXCEPTION 'هذا التعديل سيجعل المخزون أقل من المحجوز';
    END IF;

    UPDATE public.pharma_batches
    SET
      qty_on_hand = qty_on_hand + p_adjustment_qty,
      updated_at = now(),
      is_active = CASE WHEN (qty_on_hand + p_adjustment_qty) > 0 THEN true ELSE false END
    WHERE tenant_id = v_tenant_id
      AND id = p_batch_id;
  END IF;

  INSERT INTO public.pharma_stock_movements (
    tenant_id,
    branch_id,
    product_id,
    batch_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    note,
    created_by
  )
  VALUES (
    v_tenant_id,
    v_batch.branch_id,
    v_batch.product_id,
    v_batch.id,
    p_movement_type,
    CASE
      WHEN p_movement_type IN ('reserve', 'damage') THEN -ABS(p_adjustment_qty)
      ELSE p_adjustment_qty
    END,
    'batch_adjustment',
    v_batch.id,
    COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'تعديل مخزون دفعة صيدلية'),
    v_user_id
  );

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_adjust_batch_stock',
    'pharma_batches',
    v_batch.id,
    jsonb_build_object('movement_type', p_movement_type, 'adjustment_qty', p_adjustment_qty),
    v_batch.branch_id,
    true
  );

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch.id, 'movement_type', p_movement_type);
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_adjust_batch_stock(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_adjust_batch_stock(uuid, numeric, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pharmacy_submit_insurance_claim(
  p_dispense_id uuid,
  p_insurer_name text,
  p_policy_number text,
  p_claimed_amount numeric,
  p_submission_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_dispense public.pharma_dispenses%ROWTYPE;
  v_claim_id uuid;
  v_claim_no text;
BEGIN
  SELECT *
    INTO v_dispense
  FROM public.pharma_dispenses
  WHERE tenant_id = v_tenant_id
    AND id = p_dispense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'عملية الصرف غير موجودة لإنشاء مطالبة التأمين';
  END IF;

  IF v_dispense.patient_id IS NULL THEN
    RAISE EXCEPTION 'لا يمكن إنشاء مطالبة تأمين لعملية صرف بلا مريض مرتبط';
  END IF;

  IF NOT public.pharmacy_can_manage_sensitive(v_tenant_id, v_dispense.branch_id) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إنشاء مطالبة تأمين لهذا الفرع';
  END IF;

  v_claim_no := public.pharmacy_next_document_number('PHCLM', v_tenant_id, v_dispense.branch_id);

  INSERT INTO public.pharma_insurance_claims (
    tenant_id,
    branch_id,
    dispense_id,
    patient_id,
    insurer_name,
    policy_number,
    claim_number,
    approved_amount,
    claimed_amount,
    status,
    submission_payload,
    response_payload
  )
  VALUES (
    v_tenant_id,
    v_dispense.branch_id,
    v_dispense.id,
    v_dispense.patient_id,
    NULLIF(btrim(COALESCE(p_insurer_name, '')), ''),
    NULLIF(btrim(COALESCE(p_policy_number, '')), ''),
    v_claim_no,
    0,
    COALESCE(p_claimed_amount, v_dispense.total_amount),
    'submitted',
    COALESCE(p_submission_payload, '{}'::jsonb),
    '{}'::jsonb
  )
  RETURNING id INTO v_claim_id;

  PERFORM public.pharmacy_safe_audit(
    v_tenant_id,
    'pharmacy_submit_insurance_claim',
    'pharma_insurance_claims',
    v_claim_id,
    jsonb_build_object('dispense_id', p_dispense_id, 'claimed_amount', COALESCE(p_claimed_amount, v_dispense.total_amount)),
    v_dispense.branch_id,
    true
  );

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id, 'claim_number', v_claim_no);
END;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_submit_insurance_claim(uuid, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_submit_insurance_claim(uuid, text, text, numeric, jsonb) TO authenticated, service_role;

COMMIT;
