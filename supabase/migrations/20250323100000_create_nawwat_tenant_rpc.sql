-- RPC: create workspace after registration wizard (auth required)
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

  v_slug := lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g'));
  IF v_slug = '' OR length(v_slug) < 2 THEN
    v_slug := 'tenant';
  END IF;
  v_slug := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  INSERT INTO public.tenants (
    name,
    name_ar,
    slug,
    country,
    currency,
    sector,
    plan,
    is_active,
    country_code,
    default_currency,
    default_tax_rate,
    vat_rate,
    tax_registration_no,
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
    v_cc,
    v_currency,
    v_tax,
    v_tax,
    CASE WHEN lower(coalesce(p_vat_registered, '')) = 'yes' THEN trim(coalesce(p_vat_number, '')) ELSE NULL END,
    CASE WHEN lower(coalesce(p_vat_registered, '')) = 'yes' THEN trim(coalesce(p_vat_number, '')) ELSE NULL END,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.branches (tenant_id, name, name_ar, country, is_active, is_default, created_at, updated_at)
  VALUES (v_tenant_id, 'الفرع الرئيسي', 'الفرع الرئيسي', v_country, true, true, now(), now())
  RETURNING id INTO v_branch_id;

  INSERT INTO public.users (auth_id, tenant_id, default_branch, full_name, email, is_active, created_at, updated_at)
  VALUES (v_auth, v_tenant_id, v_branch_id, v_full_name, v_email, true, now(), now())
  ON CONFLICT (auth_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    default_branch = EXCLUDED.default_branch,
    full_name = EXCLUDED.full_name,
    updated_at = now()
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.users WHERE auth_id = v_auth LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, created_at, updated_at)
  VALUES (v_auth, v_full_name, now(), now())
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = now();

  INSERT INTO public.roles (tenant_id, name, name_ar, description, is_system)
  VALUES
    (v_tenant_id, 'owner', 'المالك', 'Full System Access', true),
    (v_tenant_id, 'branch_manager', 'مدير فرع', 'Branch Admin Access', true),
    (v_tenant_id, 'cashier', 'كاشير', 'POS Access', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_role_id FROM public.roles WHERE tenant_id = v_tenant_id AND name = 'owner' LIMIT 1;

  IF v_role_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (tenant_id, user_id, role_id, branch_id)
    VALUES (v_tenant_id, v_user_id, v_role_id, v_branch_id)
    ON CONFLICT DO NOTHING;
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
