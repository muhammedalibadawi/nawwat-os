-- ============================================================
-- NawwatOS — Fix Orphaned Users Script
-- Run this in the Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
    r RECORD;
    v_slug TEXT;
    v_count INT := 0;
BEGIN
    -- Loop through all users in auth.users that do not exist in public.users
    FOR r IN
        SELECT 
            id, 
            email, 
            COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) as full_name
        FROM auth.users
        WHERE id NOT IN (SELECT auth_id FROM public.users WHERE auth_id IS NOT NULL)
    LOOP
        -- Generate a unique slug to prevent unique constraint violations on public.tenants
        v_slug := 'my-company-' || substr(md5(random()::text), 1, 8);
        
        -- Call the existing RPC to handle the entire chain of insertions
        -- (Tenant -> Branch -> User -> Profiles -> Roles -> User_Roles -> JWT updates)
        PERFORM public.register_new_tenant(
            r.id,                 -- p_auth_id
            r.email,              -- p_email
            r.full_name,          -- p_full_name
            'My Company',         -- p_tenant_name
            v_slug,               -- p_tenant_slug
            'retail',             -- p_sector
            'AE'                  -- p_country
        );
        
        v_count := v_count + 1;
        RAISE NOTICE 'Fixed orphaned user: % (ID: %)', r.email, r.id;
    END LOOP;

    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Completed fixing % orphaned users.', v_count;
    RAISE NOTICE '=================================================';
END;
$$ LANGUAGE plpgsql;
