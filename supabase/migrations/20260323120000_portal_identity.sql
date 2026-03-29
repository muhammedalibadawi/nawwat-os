BEGIN;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_contacts_auth_tenant
  ON public.contacts(auth_id, tenant_id)
  WHERE auth_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'user_role', '');
$$;

CREATE OR REPLACE FUNCTION public.current_jwt_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_customer_contact_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT c.id
  FROM public.contacts c
  WHERE c.auth_id = auth.uid()
    AND c.tenant_id = public.current_jwt_tenant_id()
    AND c.type = 'customer'
    AND c.is_active IS TRUE
    AND c.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_customer_contact_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_customer_contact_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.customer_can_access_invoice(
  p_tenant_id UUID,
  p_invoice_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.id = p_invoice_id
      AND p_tenant_id = public.current_jwt_tenant_id()
      AND i.contact_id = public.current_customer_contact_id()
  );
$$;

REVOKE ALL ON FUNCTION public.customer_can_access_invoice(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_can_access_invoice(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims_for_user(
  p_user_id UUID,
  p_fallback_auth_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id UUID := p_fallback_auth_id;
  v_tenant_id UUID;
  v_default_branch UUID;
  v_role_name TEXT;
BEGIN
  SELECT u.auth_id, u.tenant_id, u.default_branch
  INTO v_auth_id, v_tenant_id, v_default_branch
  FROM public.users u
  WHERE u.id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    IF v_auth_id IS NULL THEN
      RETURN;
    END IF;

    SELECT r.name
    INTO v_role_name
    FROM public.user_roles ur
    JOIN public.roles r
      ON r.tenant_id = ur.tenant_id
     AND r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND ur.tenant_id = v_tenant_id
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
    ORDER BY ur.created_at DESC NULLS LAST, ur.granted_at DESC NULLS LAST
    LIMIT 1;

    UPDATE auth.users
    SET raw_app_meta_data =
      (COALESCE(raw_app_meta_data, '{}'::jsonb) - 'tenant_id' - 'user_role' - 'default_branch_id')
      || jsonb_strip_nulls(
        jsonb_build_object(
          'tenant_id', v_tenant_id,
          'user_role', v_role_name,
          'default_branch_id', v_default_branch
        )
      )
    WHERE id = v_auth_id;

    RETURN;
  END IF;

  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) - 'tenant_id' - 'user_role' - 'default_branch_id'
    WHERE id = v_auth_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_jwt_claims_for_user(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_user_jwt_claims_for_user(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_sync_user_jwt_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF TG_OP = 'UPDATE' AND OLD.auth_id IS DISTINCT FROM NEW.auth_id AND OLD.auth_id IS NOT NULL THEN
      PERFORM public.sync_user_jwt_claims_for_user(OLD.id, OLD.auth_id);
    END IF;

    PERFORM public.sync_user_jwt_claims_for_user(
      COALESCE(NEW.id, OLD.id),
      COALESCE(NEW.auth_id, OLD.auth_id)
    );
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'user_roles' THEN
    PERFORM public.sync_user_jwt_claims_for_user(COALESCE(NEW.user_id, OLD.user_id), NULL);
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_user_jwt_claims ON public.users;
CREATE TRIGGER sync_user_jwt_claims
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_sync_user_jwt_claims();

DROP TRIGGER IF EXISTS sync_user_jwt_claims ON public.user_roles;
CREATE TRIGGER sync_user_jwt_claims
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.handle_sync_user_jwt_claims();

SELECT public.sync_user_jwt_claims_for_user(u.id, u.auth_id)
FROM public.users u
WHERE u.auth_id IS NOT NULL;

DROP POLICY IF EXISTS "contacts: customer read own" ON public.contacts;
CREATE POLICY "contacts: customer read own" ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'customer'
    AND tenant_id = public.current_jwt_tenant_id()
    AND auth_id = auth.uid()
    AND type = 'customer'
    AND is_active IS TRUE
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "invoices: customer read own" ON public.invoices;
CREATE POLICY "invoices: customer read own" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'customer'
    AND tenant_id = public.current_jwt_tenant_id()
    AND contact_id = public.current_customer_contact_id()
  );

DROP POLICY IF EXISTS "invoice_items: customer read own" ON public.invoice_items;
CREATE POLICY "invoice_items: customer read own" ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'customer'
    AND tenant_id = public.current_jwt_tenant_id()
    AND public.customer_can_access_invoice(tenant_id, invoice_id)
  );

DROP POLICY IF EXISTS "tenants: customer read related" ON public.tenants;
CREATE POLICY "tenants: customer read related" ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() = 'customer'
    AND id = public.current_jwt_tenant_id()
    AND public.current_customer_contact_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "tenants: master admin full access" ON public.tenants;
CREATE POLICY "tenants: master admin full access" ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.current_app_role() = 'master_admin')
  WITH CHECK (public.current_app_role() = 'master_admin');

COMMIT;
