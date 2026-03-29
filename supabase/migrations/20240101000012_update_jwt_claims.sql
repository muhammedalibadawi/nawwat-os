DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'supabase_auth_admin'
  ) THEN
    EXECUTE $sql$
      SELECT supabase_auth_admin.update_user(
        u.auth_id,
        jsonb_build_object(
          'app_metadata', jsonb_build_object(
            'tenant_id', u.tenant_id,
            'user_role', r.name,
            'default_branch_id', u.default_branch
          )
        )
      )
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE u.auth_id IS NOT NULL
    $sql$;
  END IF;
END;
$$;
