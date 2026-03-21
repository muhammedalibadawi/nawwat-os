-- ============================================================
-- NawwatOS — Migration 029_create_tenant_rpc
-- Implements the missing register_new_tenant RPC required by the UI Signup
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.register_new_tenant(
    p_auth_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_tenant_name TEXT,
    p_tenant_slug TEXT,
    p_sector TEXT,
    p_country TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    -- 1. Create the new Tenant
    INSERT INTO public.tenants (
        name, 
        slug, 
        sector, 
        country, 
        is_active, 
        plan, 
        created_at, 
        updated_at
    )
    VALUES (
        p_tenant_name, 
        p_tenant_slug, 
        p_sector, 
        p_country, 
        true, 
        'starter', 
        now(), 
        now()
    )
    RETURNING id INTO v_tenant_id;

    -- 2. Create the default "Main Branch"
    INSERT INTO public.branches (
        tenant_id, 
        name, 
        country, 
        is_active, 
        is_default, 
        created_at, 
        updated_at
    )
    VALUES (
        v_tenant_id, 
        'Main Branch', 
        p_country, 
        true, 
        true, 
        now(), 
        now()
    )
    RETURNING id INTO v_branch_id;

    -- 3. Create public.users entry (Final Schema Architecture)
    -- We insert into users where auth_id maps to auth.users.id
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
        p_auth_id, 
        v_tenant_id, 
        v_branch_id, 
        p_full_name, 
        p_email, 
        true, 
        now(), 
        now()
    )
    ON CONFLICT (auth_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        default_branch = EXCLUDED.default_branch,
        full_name = EXCLUDED.full_name
    RETURNING id INTO v_user_id;

    -- 4. Create public.profiles entry (To satisfy AuthContext.tsx stub)
    INSERT INTO public.profiles (
        user_id, 
        full_name, 
        created_at, 
        updated_at
    )
    VALUES (
        v_user_id, 
        p_full_name, 
        now(), 
        now()
    )
    ON CONFLICT ON CONSTRAINT profiles_pkey DO NOTHING;

    -- 5. Create System Roles for the Tenant
    INSERT INTO public.roles (tenant_id, name, name_ar, description, is_system)
    VALUES 
        (v_tenant_id, 'owner', 'المالك', 'Full System Access', true),
        (v_tenant_id, 'branch_manager', 'مدير فرع', 'Branch Admin Access', true),
        (v_tenant_id, 'cashier', 'كاشير', 'POS Access', true)
    RETURNING (CASE WHEN name = 'owner' THEN id ELSE NULL END) INTO v_role_id;

    -- Get the actual owner role id if the returning didn't catch perfectly 
    -- (postgresql RETURNING can be tricky with multiple rows and returning single var)
    SELECT id INTO v_role_id FROM public.roles WHERE tenant_id = v_tenant_id AND name = 'owner' LIMIT 1;

    -- 6. Link User to Role
    INSERT INTO public.user_roles (tenant_id, user_id, role_id, branch_id)
    VALUES (v_tenant_id, v_user_id, v_role_id, v_branch_id);

    -- 7. IMPORTANT: Update auth.users JWT claims with owner role
    -- This ensures route guards in App.tsx give access
    UPDATE auth.users
    SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'user_role', 'owner',
            'tenant_id', v_tenant_id,
            'default_branch_id', v_branch_id
        )
    WHERE id = p_auth_id;

    -- Return payload
    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', v_tenant_id,
        'user_id', v_user_id,
        'branch_id', v_branch_id,
        'role', 'owner'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMIT;
