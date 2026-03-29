BEGIN;

-- =============================================================================
-- Same-tenant hardening
-- -----------------------------------------------------------------------------
-- Goals:
--   1) Prevent cross-tenant parent/child corruption with composite FKs wherever
--      the schema permits it.
--   2) Add trigger-based validation for polymorphic references with clearer
--      error messages.
--   3) Replace legacy RLS predicates that trust public.users(auth_id) lookups
--      directly, and ensure INSERT/UPDATE paths use WITH CHECK consistently.
--
-- Notes:
--   - New composite FKs are added NOT VALID so legacy dirty rows do not block
--     the migration, while all new writes are still enforced.
--   - Some sector-specific tables requested by product are not present in this
--     repository yet; conditional hooks are included so environments that do
--     already have them can be hardened safely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identity / role helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_claim_text(p_claim text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> p_claim, '');
$$;

CREATE OR REPLACE FUNCTION public.current_claim_uuid(p_claim text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> p_claim, '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_jwt_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_has_users_role_column boolean;
  v_result boolean := false;
BEGIN
  IF public.current_claim_text('user_role') = 'master_admin' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  )
  INTO v_has_users_role_column;

  IF v_has_users_role_column THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.auth_id = auth.uid()
          AND COALESCE(u.role, '') = 'master_admin'
      )
    $sql$
    INTO v_result;

    IF v_result THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL
     AND to_regclass('public.users') IS NOT NULL
     AND to_regclass('public.roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.users u
        ON u.id = ur.user_id
      JOIN public.roles r
        ON r.tenant_id = ur.tenant_id
       AND r.id = ur.role_id
      WHERE u.auth_id = auth.uid()
        AND (ur.expires_at IS NULL OR ur.expires_at > now())
        AND r.name = 'master_admin'
    )
    INTO v_result;

    IF v_result THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_role text;
BEGIN
  IF public.is_master_admin() THEN
    RETURN 'master_admin';
  END IF;

  v_tenant_id := public.current_tenant_id();

  IF v_tenant_id IS NULL THEN
    RETURN COALESCE(public.current_claim_text('user_role'), '');
  END IF;

  v_role := public.user_tenant_role(v_tenant_id);
  RETURN COALESCE(v_role, COALESCE(public.current_claim_text('user_role'), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_customer_contact_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT c.id
  FROM public.contacts c
  WHERE c.auth_id = auth.uid()
    AND c.tenant_id = public.current_tenant_id()
    AND c.type = 'customer'
    AND c.is_active IS TRUE
    AND c.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_customer_contact_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_customer_contact_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.customer_can_access_invoice(
  p_tenant_id uuid,
  p_invoice_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.id = p_invoice_id
      AND p_tenant_id = public.current_tenant_id()
      AND i.contact_id = public.current_customer_contact_id()
  );
$$;

REVOKE ALL ON FUNCTION public.customer_can_access_invoice(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_can_access_invoice(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_employee_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.tenant_id = public.current_tenant_id()
    AND u.is_active IS TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_employee_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_user_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_employee_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_employee_id uuid;
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT e.id
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.tenant_id = public.current_tenant_id()
      LIMIT 1
    $sql$
    INTO v_employee_id;
  END IF;

  RETURN v_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_employee_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_profile_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_tenant_staff(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE(public.user_tenant_role(target_tenant_id), '') = ANY (
    ARRAY['master_admin', 'tenant_owner', 'tenant_admin', 'employee']
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_staff(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE(public.user_tenant_role(target_tenant_id), '') = ANY (
    ARRAY['master_admin', 'tenant_owner', 'tenant_admin']
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_tenant_customer(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE(public.user_tenant_role(target_tenant_id), '') = 'customer';
$$;

REVOKE ALL ON FUNCTION public.is_tenant_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_customer(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Same-tenant integrity helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_tenant_scoped_unique_id(p_table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table regclass := to_regclass(p_table_name);
  v_schema_name text;
  v_table_name_only text;
  v_tenant_attnum smallint;
  v_id_attnum smallint;
  v_constraint_name text;
BEGIN
  IF v_table IS NULL THEN
    RETURN;
  END IF;

  SELECT n.nspname, c.relname
  INTO v_schema_name, v_table_name_only
  FROM pg_class c
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE c.oid = v_table;

  SELECT a.attnum
  INTO v_tenant_attnum
  FROM pg_attribute a
  WHERE a.attrelid = v_table
    AND a.attname = 'tenant_id'
    AND NOT a.attisdropped;

  SELECT a.attnum
  INTO v_id_attnum
  FROM pg_attribute a
  WHERE a.attrelid = v_table
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF v_tenant_attnum IS NULL OR v_id_attnum IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = v_table
      AND con.contype IN ('p', 'u')
      AND con.conkey = ARRAY[v_tenant_attnum, v_id_attnum]
  ) THEN
    RETURN;
  END IF;

  v_constraint_name := left(v_table_name_only || '_tenant_id_id_key', 63);

  EXECUTE format(
    'ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (tenant_id, id)',
    v_schema_name,
    v_table_name_only,
    v_constraint_name
  );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_tenant_scoped_fk(
  p_child_table_name text,
  p_constraint_name text,
  p_child_id_column text,
  p_parent_table_name text,
  p_on_delete text DEFAULT 'NO ACTION'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_child_table regclass := to_regclass(p_child_table_name);
  v_parent_table regclass := to_regclass(p_parent_table_name);
  v_child_schema text;
  v_child_name text;
BEGIN
  IF v_child_table IS NULL OR v_parent_table IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = split_part(p_child_table_name, '.', 1)
      AND table_name = split_part(p_child_table_name, '.', 2)
      AND column_name = 'tenant_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = split_part(p_child_table_name, '.', 1)
      AND table_name = split_part(p_child_table_name, '.', 2)
      AND column_name = p_child_id_column
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = split_part(p_parent_table_name, '.', 1)
      AND table_name = split_part(p_parent_table_name, '.', 2)
      AND column_name = 'tenant_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = split_part(p_parent_table_name, '.', 1)
      AND table_name = split_part(p_parent_table_name, '.', 2)
      AND column_name = 'id'
  ) THEN
    RETURN;
  END IF;

  PERFORM public.ensure_tenant_scoped_unique_id(p_parent_table_name);

  SELECT n.nspname, c.relname
  INTO v_child_schema, v_child_name
  FROM pg_class c
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE c.oid = v_child_table;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = v_child_table
      AND con.conname = p_constraint_name
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I.%I ADD CONSTRAINT %I
       FOREIGN KEY (tenant_id, %I)
       REFERENCES %s (tenant_id, id)
       ON DELETE %s
       NOT VALID',
    v_child_schema,
    v_child_name,
    p_constraint_name,
    p_child_id_column,
    v_parent_table,
    p_on_delete
  );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_same_tenant_reference(
  p_parent_table_name text,
  p_parent_id uuid,
  p_expected_tenant_id uuid,
  p_relation_label text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_parent_table regclass := to_regclass(p_parent_table_name);
  v_parent_tenant uuid;
  v_label text := COALESCE(NULLIF(p_relation_label, ''), p_parent_table_name);
BEGIN
  IF p_parent_id IS NULL OR p_expected_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF v_parent_table IS NULL THEN
    RAISE EXCEPTION 'Same-tenant integrity misconfiguration: parent table % does not exist.', p_parent_table_name
      USING ERRCODE = '42P01';
  END IF;

  EXECUTE format(
    'SELECT tenant_id FROM %s WHERE id = $1',
    v_parent_table
  )
  INTO v_parent_tenant
  USING p_parent_id;

  IF v_parent_tenant IS NULL THEN
    RAISE EXCEPTION 'Referenced % row % does not exist.', v_label, p_parent_id
      USING ERRCODE = '23503';
  END IF;

  IF v_parent_tenant <> p_expected_tenant_id THEN
    RAISE EXCEPTION
      'Tenant mismatch: % row % belongs to tenant %, but this row belongs to tenant %.',
      v_label,
      p_parent_id,
      v_parent_tenant,
      p_expected_tenant_id
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_same_tenant_reference(text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_same_tenant_reference(text, uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_same_tenant_refs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload jsonb := to_jsonb(NEW);
  v_column_name text;
  v_parent_table_name text;
  v_label text;
  v_parent_id uuid;
  v_index integer := 0;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  WHILE v_index + 2 < TG_NARGS LOOP
    v_column_name := TG_ARGV[v_index];
    v_parent_table_name := TG_ARGV[v_index + 1];
    v_label := TG_ARGV[v_index + 2];

    IF v_payload ? v_column_name THEN
      v_parent_id := NULLIF(v_payload ->> v_column_name, '')::uuid;
      PERFORM public.assert_same_tenant_reference(
        v_parent_table_name,
        v_parent_id,
        NEW.tenant_id,
        COALESCE(NULLIF(v_label, ''), TG_TABLE_NAME || '.' || v_column_name)
      );
    END IF;

    v_index := v_index + 3;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_payments_reference_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_table_name text;
BEGIN
  IF NEW.reference_id IS NULL THEN
    RAISE EXCEPTION 'payments.reference_id is required when reference_type is %.', NEW.reference_type
      USING ERRCODE = '23502';
  END IF;

  CASE NEW.reference_type
    WHEN 'order' THEN
      v_parent_table_name := 'public.orders';
    WHEN 'invoice' THEN
      v_parent_table_name := 'public.invoices';
    WHEN 'payment_link' THEN
      v_parent_table_name := 'public.payment_links';
    ELSE
      RAISE EXCEPTION 'Unsupported payments.reference_type "%".', NEW.reference_type
        USING ERRCODE = '23514';
  END CASE;

  PERFORM public.assert_same_tenant_reference(
    v_parent_table_name,
    NEW.reference_id,
    NEW.tenant_id,
    'payments.' || NEW.reference_type
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.drop_policies_for_table(p_table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table regclass := to_regclass(p_table_name);
  v_schema_name text;
  v_table_name_only text;
  v_policy record;
BEGIN
  IF v_table IS NULL THEN
    RETURN;
  END IF;

  SELECT n.nspname, c.relname
  INTO v_schema_name, v_table_name_only
  FROM pg_class c
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE c.oid = v_table;

  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = v_schema_name
      AND tablename = v_table_name_only
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_schema_name,
      v_table_name_only
    );
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Parent unique keys needed for composite FKs
-- -----------------------------------------------------------------------------
SELECT public.ensure_tenant_scoped_unique_id('public.bank_accounts');
SELECT public.ensure_tenant_scoped_unique_id('public.loyalty_points');

-- -----------------------------------------------------------------------------
-- Current schema: composite FKs for same-tenant parent/child integrity
-- -----------------------------------------------------------------------------
SELECT public.ensure_tenant_scoped_fk('public.chart_of_accounts', 'fk_coa_parent_tenant', 'parent_id', 'public.chart_of_accounts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.categories', 'fk_categories_parent_tenant', 'parent_id', 'public.categories', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.journal_entries', 'fk_je_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.journal_entries', 'fk_je_posted_by_tenant', 'posted_by', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.journal_entries', 'fk_je_reversed_by_tenant', 'reversed_by_id', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.journal_lines', 'fk_jl_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.invoices', 'fk_invoices_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.invoices', 'fk_invoices_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.invoices', 'fk_invoices_journal_entry_tenant', 'journal_entry_id', 'public.journal_entries', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.invoices', 'fk_invoices_created_by_tenant', 'created_by', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.invoices', 'fk_invoices_approved_by_tenant', 'approved_by', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.payment_links', 'fk_payment_links_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.payment_links', 'fk_payment_links_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.payment_links', 'fk_payment_links_invoice_tenant', 'invoice_id', 'public.invoices', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.payment_links', 'fk_payment_links_created_by_tenant', 'created_by', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.shipments', 'fk_shipments_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.shipments', 'fk_shipments_supplier_tenant', 'supplier_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.shipments', 'fk_shipments_created_by_tenant', 'created_by', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.shipment_items', 'fk_shipment_items_item_tenant', 'item_id', 'public.items', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.orders', 'fk_orders_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.orders', 'fk_orders_cashier_tenant', 'cashier_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.orders', 'fk_orders_waiter_tenant', 'waiter_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.order_items', 'fk_order_items_item_tenant', 'item_id', 'public.items', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.payments', 'fk_payments_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.payments', 'fk_payments_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.recipes', 'fk_recipes_portion_unit_tenant', 'portion_unit_id', 'public.units', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.recipe_ingredients', 'fk_recipe_ingredients_unit_tenant', 'unit_id', 'public.units', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.food_cost_snapshots', 'fk_food_cost_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_patient_tenant', 'patient_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_provider_tenant', 'provider_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_service_item_tenant', 'service_item_id', 'public.items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_invoice_tenant', 'invoice_id', 'public.invoices', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_payment_link_tenant', 'payment_link_id', 'public.payment_links', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.appointments', 'fk_appointments_created_by_tenant', 'created_by', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.patient_records', 'fk_patient_records_appointment_tenant', 'appointment_id', 'public.appointments', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.patient_records', 'fk_patient_records_doctor_tenant', 'doctor_id', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.prescriptions', 'fk_prescriptions_doctor_tenant', 'doctor_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.prescriptions', 'fk_prescriptions_record_tenant', 'record_id', 'public.patient_records', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.prescriptions', 'fk_prescriptions_dispensed_by_tenant', 'dispensed_by', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.classes', 'fk_classes_teacher_tenant', 'teacher_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.enrollments', 'fk_enrollments_fee_invoice_tenant', 'fee_invoice_id', 'public.invoices', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.properties', 'fk_properties_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.production_orders', 'fk_production_orders_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.production_orders', 'fk_production_orders_warehouse_tenant', 'warehouse_id', 'public.warehouses', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.production_orders', 'fk_production_orders_created_by_tenant', 'created_by', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.notifications', 'fk_notifications_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.notifications', 'fk_notifications_user_tenant', 'user_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.audit_log', 'fk_audit_log_user_tenant', 'user_id', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.loyalty_points', 'fk_loyalty_points_customer_tenant', 'customer_id', 'public.contacts', 'CASCADE');
SELECT public.ensure_tenant_scoped_fk('public.loyalty_transactions', 'fk_loyalty_tx_loyalty_tenant', 'loyalty_id', 'public.loyalty_points', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.loyalty_transactions', 'fk_loyalty_tx_customer_tenant', 'customer_id', 'public.contacts', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.loyalty_transactions', 'fk_loyalty_tx_invoice_tenant', 'invoice_id', 'public.invoices', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.bank_transactions', 'fk_bank_transactions_account_tenant', 'bank_account_id', 'public.bank_accounts', 'CASCADE');
SELECT public.ensure_tenant_scoped_fk('public.cheques', 'fk_cheques_contact_tenant', 'contact_id', 'public.contacts', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.inventory_writeoffs', 'fk_inventory_writeoffs_item_tenant', 'item_id', 'public.items', 'NO ACTION');
SELECT public.ensure_tenant_scoped_fk('public.inventory_writeoffs', 'fk_inventory_writeoffs_warehouse_tenant', 'warehouse_id', 'public.warehouses', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.inventory_writeoffs', 'fk_inventory_writeoffs_approved_by_tenant', 'approved_by', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.inventory_writeoffs', 'fk_inventory_writeoffs_created_by_tenant', 'created_by', 'public.users', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.employee_pins', 'fk_employee_pins_user_tenant', 'user_id', 'public.users', 'CASCADE');

SELECT public.ensure_tenant_scoped_fk('public.market_price_snapshots', 'fk_market_price_snapshots_item_tenant', 'item_id', 'public.items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.market_price_snapshots', 'fk_market_price_snapshots_queried_by_tenant', 'queried_by', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.market_price_alerts', 'fk_market_price_alerts_item_tenant', 'item_id', 'public.items', 'CASCADE');
SELECT public.ensure_tenant_scoped_fk('public.market_price_alerts', 'fk_market_price_alerts_created_by_tenant', 'created_by', 'public.users', 'SET NULL');

-- -----------------------------------------------------------------------------
-- Future sector tables requested by product: apply conditionally if they exist
-- -----------------------------------------------------------------------------
SELECT public.ensure_tenant_scoped_fk('public.fb_order_items', 'fk_fb_order_items_order_tenant', 'order_id', 'public.orders', 'CASCADE');
SELECT public.ensure_tenant_scoped_fk('public.fb_order_items', 'fk_fb_order_items_item_tenant', 'item_id', 'public.items', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.fb_kds_tickets', 'fk_fb_kds_tickets_order_tenant', 'order_id', 'public.orders', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.fb_kds_tickets', 'fk_fb_kds_tickets_order_item_tenant', 'order_item_id', 'public.order_items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.fb_kds_tickets', 'fk_fb_kds_tickets_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.retail_inventory', 'fk_retail_inventory_item_tenant', 'item_id', 'public.items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.retail_inventory', 'fk_retail_inventory_warehouse_tenant', 'warehouse_id', 'public.warehouses', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.retail_inventory', 'fk_retail_inventory_branch_tenant', 'branch_id', 'public.branches', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.retail_transfer_items', 'fk_retail_transfer_items_item_tenant', 'item_id', 'public.items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.retail_transfer_items', 'fk_retail_transfer_items_from_wh_tenant', 'from_warehouse_id', 'public.warehouses', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.retail_transfer_items', 'fk_retail_transfer_items_to_wh_tenant', 'to_warehouse_id', 'public.warehouses', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.retail_sale_items', 'fk_retail_sale_items_item_tenant', 'item_id', 'public.items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.retail_sale_items', 'fk_retail_sale_items_invoice_tenant', 'invoice_id', 'public.invoices', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.retail_return_items', 'fk_retail_return_items_item_tenant', 'item_id', 'public.items', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.retail_return_items', 'fk_retail_return_items_invoice_tenant', 'invoice_id', 'public.invoices', 'SET NULL');

SELECT public.ensure_tenant_scoped_fk('public.psa_tasks', 'fk_psa_tasks_assigned_user_tenant', 'assigned_user_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.psa_project_members', 'fk_psa_project_members_user_tenant', 'user_id', 'public.users', 'CASCADE');
SELECT public.ensure_tenant_scoped_fk('public.psa_timesheets', 'fk_psa_timesheets_user_tenant', 'user_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.psa_expenses', 'fk_psa_expenses_user_tenant', 'user_id', 'public.users', 'SET NULL');
SELECT public.ensure_tenant_scoped_fk('public.psa_billable_items', 'fk_psa_billable_items_invoice_tenant', 'invoice_id', 'public.invoices', 'SET NULL');

-- -----------------------------------------------------------------------------
-- Trigger-based validation with clearer error messages where FK cannot model the
-- full rule cleanly
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_payments_same_tenant_reference ON public.payments;
CREATE TRIGGER trg_payments_same_tenant_reference
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_payments_reference_tenant();

DROP TRIGGER IF EXISTS trg_shipments_same_tenant_refs ON public.shipments;
CREATE TRIGGER trg_shipments_same_tenant_refs
BEFORE INSERT OR UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_same_tenant_refs(
  'supplier_id', 'public.contacts', 'shipments.supplier_id',
  'branch_id', 'public.branches', 'shipments.branch_id',
  'created_by', 'public.users', 'shipments.created_by'
);

DROP TRIGGER IF EXISTS trg_orders_same_tenant_refs ON public.orders;
CREATE TRIGGER trg_orders_same_tenant_refs
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_same_tenant_refs(
  'contact_id', 'public.contacts', 'orders.contact_id',
  'cashier_id', 'public.users', 'orders.cashier_id',
  'waiter_id', 'public.users', 'orders.waiter_id'
);

DROP TRIGGER IF EXISTS trg_appointments_same_tenant_refs ON public.appointments;
CREATE TRIGGER trg_appointments_same_tenant_refs
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_same_tenant_refs(
  'patient_id', 'public.contacts', 'appointments.patient_id',
  'provider_id', 'public.users', 'appointments.provider_id',
  'service_item_id', 'public.items', 'appointments.service_item_id',
  'invoice_id', 'public.invoices', 'appointments.invoice_id',
  'payment_link_id', 'public.payment_links', 'appointments.payment_link_id'
);

-- -----------------------------------------------------------------------------
-- RLS rebuild: remove legacy public.users(auth_id) tenant lookups
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.branches',
    'public.contacts',
    'public.categories',
    'public.units',
    'public.items',
    'public.warehouses',
    'public.stock_levels',
    'public.shipments',
    'public.shipment_items',
    'public.orders',
    'public.order_items',
    'public.payments',
    'public.invoices',
    'public.invoice_items',
    'public.payment_links',
    'public.recipes',
    'public.recipe_ingredients',
    'public.food_cost_snapshots',
    'public.appointments',
    'public.patient_records',
    'public.prescriptions',
    'public.academic_years',
    'public.classes',
    'public.enrollments',
    'public.properties',
    'public.leases',
    'public.bill_of_materials',
    'public.bom_components',
    'public.production_orders',
    'public.notifications',
    'public.loyalty_points',
    'public.loyalty_transactions'
  ]
  LOOP
    PERFORM public.drop_policies_for_table(t);
    EXECUTE format(
      'CREATE POLICY %I ON %s
         FOR ALL
         TO authenticated
         USING (public.is_tenant_staff(tenant_id))
         WITH CHECK (public.is_tenant_staff(tenant_id))',
      replace(split_part(t, '.', 2), '"', '') || ': staff isolation',
      t
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'public.roles',
    'public.role_permissions',
    'public.user_roles',
    'public.taxes',
    'public.chart_of_accounts',
    'public.journal_entries',
    'public.journal_lines',
    'public.portal_sessions',
    'public.portal_settings',
    'public.assets',
    'public.bank_accounts',
    'public.bank_transactions',
    'public.fx_rates',
    'public.cheques',
    'public.inventory_writeoffs',
    'public.employee_pins',
    'public.market_price_snapshots',
    'public.market_price_alerts'
  ]
  LOOP
    PERFORM public.drop_policies_for_table(t);
    EXECUTE format(
      'CREATE POLICY %I ON %s
         FOR ALL
         TO authenticated
         USING (public.is_tenant_admin(tenant_id))
         WITH CHECK (public.is_tenant_admin(tenant_id))',
      replace(split_part(t, '.', 2), '"', '') || ': admin isolation',
      t
    );
  END LOOP;
END;
$$;

SELECT public.drop_policies_for_table('public.price_history');
CREATE POLICY "price_history: staff select" ON public.price_history
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_staff(tenant_id));
CREATE POLICY "price_history: staff insert" ON public.price_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_staff(tenant_id));

SELECT public.drop_policies_for_table('public.inventory_movements');
CREATE POLICY "inventory_movements: staff select" ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_staff(tenant_id));
CREATE POLICY "inventory_movements: staff insert" ON public.inventory_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_staff(tenant_id));

SELECT public.drop_policies_for_table('public.audit_log');
CREATE POLICY "audit_log: admin select" ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin(tenant_id));
CREATE POLICY "audit_log: staff insert" ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_staff(tenant_id));

SELECT public.drop_policies_for_table('public.users');
CREATE POLICY "users: staff select" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_staff(tenant_id)
    OR auth_id = auth.uid()
  );
CREATE POLICY "users: admin insert" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "users: self update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (
    auth_id = auth.uid()
    AND public.user_has_tenant_access(tenant_id)
  );
CREATE POLICY "users: admin update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE POLICY "users: admin delete" ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_tenant_admin(tenant_id));

SELECT public.drop_policies_for_table('public.tenants');
CREATE POLICY "tenants: staff read own" ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_staff(id));
CREATE POLICY "tenants: customer read related" ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_customer(id)
    AND public.current_customer_contact_id() IS NOT NULL
  );
CREATE POLICY "tenants: tenant admin update own" ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (public.is_tenant_admin(id))
  WITH CHECK (public.is_tenant_admin(id));
CREATE POLICY "tenants: master admin full access" ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- Recreate customer portal policies after staff policies were reset.
CREATE POLICY "contacts: customer read own" ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_customer(tenant_id)
    AND auth_id = auth.uid()
    AND type = 'customer'
    AND is_active IS TRUE
    AND deleted_at IS NULL
  );

CREATE POLICY "invoices: customer read own" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_customer(tenant_id)
    AND contact_id = public.current_customer_contact_id()
  );

CREATE POLICY "invoice_items: customer read own" ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_customer(tenant_id)
    AND public.customer_can_access_invoice(tenant_id, invoice_id)
  );

DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "employees: employee read own profile" ON public.employees';
    EXECUTE $policy$
      CREATE POLICY "employees: employee read own profile" ON public.employees
        FOR SELECT
        TO authenticated
        USING (
          public.current_app_role() = 'employee'
          AND tenant_id = public.current_tenant_id()
          AND auth_id = auth.uid()
        )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.salary_structures') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "salary_structures: employee read own" ON public.salary_structures';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'salary_structures'
        AND column_name = 'user_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "salary_structures: employee read own" ON public.salary_structures
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_tenant_id()
            AND user_id = public.current_employee_user_id()
          )
      $policy$;
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'salary_structures'
        AND column_name = 'employee_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "salary_structures: employee read own" ON public.salary_structures
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_tenant_id()
            AND employee_id = public.current_employee_profile_id()
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.payslips') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "payslips: employee read own" ON public.payslips';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'user_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "payslips: employee read own" ON public.payslips
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_tenant_id()
            AND user_id = public.current_employee_user_id()
          )
      $policy$;
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'employee_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "payslips: employee read own" ON public.payslips
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_tenant_id()
            AND employee_id = public.current_employee_profile_id()
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

DO $$
DECLARE
  v_payslips_has_user_id boolean;
  v_payslips_has_employee_id boolean;
BEGIN
  IF to_regclass('public.payroll_runs') IS NOT NULL
     AND to_regclass('public.payslips') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'user_id'
    )
    INTO v_payslips_has_user_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'employee_id'
    )
    INTO v_payslips_has_employee_id;

    EXECUTE 'DROP POLICY IF EXISTS "payroll_runs: employee read own" ON public.payroll_runs';

    IF v_payslips_has_user_id THEN
      EXECUTE $policy$
        CREATE POLICY "payroll_runs: employee read own" ON public.payroll_runs
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_tenant_id()
            AND EXISTS (
              SELECT 1
              FROM public.payslips p
              WHERE p.tenant_id = payroll_runs.tenant_id
                AND p.payroll_run_id = payroll_runs.id
                AND p.user_id = public.current_employee_user_id()
            )
          )
      $policy$;
    ELSIF v_payslips_has_employee_id THEN
      EXECUTE $policy$
        CREATE POLICY "payroll_runs: employee read own" ON public.payroll_runs
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_tenant_id()
            AND EXISTS (
              SELECT 1
              FROM public.payslips p
              WHERE p.tenant_id = payroll_runs.tenant_id
                AND p.payroll_run_id = payroll_runs.id
                AND p.employee_id = public.current_employee_profile_id()
            )
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.market_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.market_price_alerts ENABLE ROW LEVEL SECURITY;

-- Employee self-scoped policies stay in place on their own tables, but the
-- helpers they depend on are now tenant-membership validated above.

COMMIT;
