-- ============================================================
-- NawwatOS — Migration 20240101000011_upgrade_ahmed
-- Grants master_admin privileges to ahmed@gmail.com
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_auth_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'ahmed@gmail.com' LIMIT 1;
  
  IF FOUND THEN
      -- Get some active tenant to map the user to if needed
      SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
      
      -- Update JWT Claims so App.tsx recognizes them as master_admin
      UPDATE auth.users
      SET raw_app_meta_data = 
          COALESCE(raw_app_meta_data, '{}'::jsonb) || 
          jsonb_build_object(
              'user_role', 'master_admin',
              'tenant_id', v_tenant_id
          )
      WHERE id = v_auth_id;
  END IF;
END;
$$;

COMMIT;
