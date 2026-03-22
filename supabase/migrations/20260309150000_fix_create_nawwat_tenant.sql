-- =============================================================================
-- NawwatOS — fix create_nawwat_tenant
-- Aligns RPC with schema from:
--   - nawwat_schema_v5_1_FINAL.sql (tenants, branches, users, roles, user_roles,
--     chart_of_accounts, taxes)
--   - 20250321140000_nawwat_v32_gulf.sql (tenant finance columns)
--   - 20240101000008_local_auth_stub.sql (minimal users/profiles if used)
--
-- Notes:
--   - No table "tax_configurations" in repo; default VAT setup uses public.taxes
--     via seed_taxes() when present on the database.
--   - roles: UNIQUE (tenant_id, name) → ON CONFLICT (tenant_id, name) DO NOTHING
--   - user_roles: UNIQUE (tenant_id, user_id, role_id, branch_id); NULL branch_id
--     breaks uniqueness for ON CONFLICT — use DELETE-then-INSERT for owner row.
--   - profiles: AuthContext يطابق profiles.id مع auth.uid(); الإدراج هنا (id, full_name).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_nawwat_tenant(
  p_display_name text,
  p_country_code text,
  p_industry text,
  p_vat_registered text,
  p_vat_number text,
  p_employee_count text,
  p_branch_count text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_tenant_id uuid;
  v_branch_id uuid;
  v_user_id uuid;
  v_role_id uuid;
  v_slug text;
  v_sector text;
  v_country text;
  v_currency text;
  v_tax numeric(5,2);
  v_cc text;
  v_trn text;
  v_has_seed_roles boolean;
  v_has_seed_taxes boolean;
  v_has_seed_coa boolean;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول أولاً';
  END IF;

  SELECT u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
  INTO v_email, v_full_name
  FROM auth.users u WHERE u.id = v_auth;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'مستخدم غير موجود';
  END IF;

  v_sector := CASE lower(coalesce(p_industry, ''))
    WHEN 'restaurant' THEN 'fnb'
    WHEN 'retail' THEN 'retail'
    WHEN 'services' THEN 'general'
    WHEN 'construction' THEN 'general'
    WHEN 'manufacturing' THEN 'manufacturing'
    WHEN 'healthcare' THEN 'clinic'
    WHEN 'education' THEN 'school'
    WHEN 'other' THEN 'general'
    ELSE 'general'
  END;

  v_cc := upper(trim(coalesce(p_country_code, 'UAE')));
  IF v_cc = 'OTHER' THEN v_cc := 'UAE'; END IF;

  v_country := CASE v_cc
    WHEN 'UAE' THEN 'AE'
    WHEN 'KSA' THEN 'SA'
    WHEN 'BHR' THEN 'BH'
    WHEN 'OMN' THEN 'OM'
    WHEN 'KWT' THEN 'KW'
    WHEN 'QAT' THEN 'QA'
    WHEN 'EGY' THEN 'EG'
    ELSE 'AE'
  END;

  v_currency := CASE v_cc
    WHEN 'UAE' THEN 'AED'
    WHEN 'KSA' THEN 'SAR'
    WHEN 'BHR' THEN 'BHD'
    WHEN 'OMN' THEN 'OMR'
    WHEN 'KWT' THEN 'KWD'
    WHEN 'QAT' THEN 'QAR'
    WHEN 'EGY' THEN 'EGP'
    ELSE 'AED'
  END;

  v_tax := CASE v_cc
    WHEN 'UAE' THEN 5
    WHEN 'KSA' THEN 15
    WHEN 'BHR' THEN 10
    WHEN 'OMN' THEN 5
    WHEN 'KWT' THEN 0
    WHEN 'QAT' THEN 0
    WHEN 'EGY' THEN 14
    ELSE 5
  END;

  IF lower(trim(coalesce(p_vat_registered, ''))) = 'yes' THEN
    v_trn := nullif(trim(coalesce(p_vat_number, '')), '');
  ELSE
    v_trn := NULL;
  END IF;

  v_slug := lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g'));
  IF v_slug = '' OR length(v_slug) < 2 THEN
    v_slug := 'tenant';
  END IF;
  v_slug := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  -- tenants (v5.1 + v3.2 Gulf columns)
  INSERT INTO public.tenants (
    name,
    name_ar,
    slug,
    country,
    currency,
    sector,
    plan,
    is_active,
    tax_registration_no,
    country_code,
    default_currency,
    default_tax_rate,
    vat_rate,
    vat_no,
    onboarded_at,
    created_at,
    updated_at
  )
  VALUES (
    trim(p_display_name),
    trim(p_display_name),
    v_slug,
    v_country,
    v_currency,
    v_sector,
    'starter',
    true,
    v_trn,
    v_cc,
    v_currency,
    v_tax,
    v_tax,
    v_trn,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_tenant_id;

  -- branches: UNIQUE (tenant_id, code) — set code = 'HQ'
  INSERT INTO public.branches (
    tenant_id,
    name,
    name_ar,
    code,
    country,
    is_active,
    is_default,
    created_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    'الفرع الرئيسي',
    'الفرع الرئيسي',
    'HQ',
    v_country,
    true,
    true,
    now(),
    now()
  )
  RETURNING id INTO v_branch_id;

  -- users: UNIQUE (auth_id); composite FK (tenant_id, default_branch) → branches
  INSERT INTO public.users (
    auth_id,
    tenant_id,
    default_branch,
    full_name,
    email,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    v_auth,
    v_tenant_id,
    v_branch_id,
    v_full_name,
    v_email,
    true,
    now(),
    now()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    default_branch = EXCLUDED.default_branch,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.users WHERE auth_id = v_auth LIMIT 1;
  END IF;

  -- profiles: AuthContext يقرأ profiles.id = auth.uid() (انظر AuthContext.tsx)
  INSERT INTO public.profiles (id, full_name, created_at, updated_at)
  VALUES (v_auth, v_full_name, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    updated_at = now();

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_roles'
  ) INTO v_has_seed_roles;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_taxes'
  ) INTO v_has_seed_taxes;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_chart_of_accounts'
  ) INTO v_has_seed_coa;

  IF v_has_seed_roles THEN
    PERFORM public.seed_roles(v_tenant_id);
  ELSE
    INSERT INTO public.roles (tenant_id, name, name_ar, description, is_system)
    VALUES
      (v_tenant_id, 'owner', 'المالك', 'Full System Access', true),
      (v_tenant_id, 'branch_manager', 'مدير فرع', 'Branch Admin Access', true),
      (v_tenant_id, 'cashier', 'كاشير', 'POS Access', true)
    ON CONFLICT (tenant_id, name) DO NOTHING;
  END IF;

  IF v_has_seed_taxes THEN
    PERFORM public.seed_taxes(v_tenant_id, v_country);
  ELSE
    INSERT INTO public.taxes (tenant_id, name, name_ar, code, tax_type, rate, is_default)
    VALUES
      (v_tenant_id, 'VAT', 'ضريبة القيمة المضافة', 'VAT_STD', 'vat', v_tax, true)
    ON CONFLICT (tenant_id, code) DO NOTHING;
  END IF;

  IF v_has_seed_coa THEN
    PERFORM public.seed_chart_of_accounts(v_tenant_id);
  END IF;

  SELECT id INTO v_role_id
  FROM public.roles
  WHERE tenant_id = v_tenant_id AND name = 'owner'
  LIMIT 1;

  IF v_role_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles ur
    WHERE ur.tenant_id = v_tenant_id
      AND ur.user_id = v_user_id
      AND ur.role_id = v_role_id;

    INSERT INTO public.user_roles (tenant_id, user_id, role_id, branch_id, granted_at, created_at)
    VALUES (v_tenant_id, v_user_id, v_role_id, v_branch_id, now(), now());
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'user_role', 'owner',
      'tenant_id', v_tenant_id,
      'default_branch_id', v_branch_id
    )
  WHERE id = v_auth;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'branch_id', v_branch_id,
    'user_id', v_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_nawwat_tenant(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_nawwat_tenant(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_nawwat_tenant(text, text, text, text, text, text, text) TO service_role;

COMMIT;
