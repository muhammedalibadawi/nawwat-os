-- Restaurant F&B — sanity checks for manual readiness.
-- Use Supabase Dashboard → SQL Editor (or psql).
--
-- HOW TO RUN
-- 1) Copy the block in section D, paste into SQL Editor.
-- 2) Replace the placeholder UUID with your tenant_id (JWT / profiles / branches table).
-- 3) Run section B separately (no tenant needed) to verify views and functions exist.

-- ═══════════════════════════════════════════════════════════════════════════
-- B) Core objects (no tenant filter)
-- ═══════════════════════════════════════════════════════════════════════════

-- Views used by the frontend (restaurantService.ts)
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('fb_menu_catalog_v', 'fb_orders_live_v')
ORDER BY table_name;

-- Restaurant RPCs expected by the app
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'restaurant_send_order_to_kitchen',
    'restaurant_complete_payment',
    'restaurant_cancel_order',
    'restaurant_update_kds_ticket_status',
    'restaurant_station_code',
    'apply_rounding_mode'
  )
ORDER BY p.proname;

-- Called from inside restaurant RPCs (required on DBs where F&B migrations ran)
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_effective_branch_settings'
ORDER BY p.proname;

-- ═══════════════════════════════════════════════════════════════════════════
-- D) Per-tenant snapshot — edit UUID then run this whole block
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tid uuid := '00000000-0000-0000-0000-000000000000';  -- <<< REPLACE with your tenant_id
BEGIN
  RAISE NOTICE '--- tenant % ---', tid;
  RAISE NOTICE 'branches (active): %',
    (SELECT COUNT(*)::text FROM public.branches WHERE tenant_id = tid AND is_active = true);
  RAISE NOTICE 'fb_tables: %',
    (SELECT COUNT(*)::text FROM public.fb_tables WHERE tenant_id = tid);
  RAISE NOTICE 'fb_menu_catalog_v rows: %',
    (SELECT COUNT(*)::text FROM public.fb_menu_catalog_v WHERE tenant_id = tid);
  RAISE NOTICE 'fb_menu_items: %',
    (SELECT COUNT(*)::text FROM public.fb_menu_items WHERE tenant_id = tid);
  RAISE NOTICE 'categories (type=menu, active): %',
    (SELECT COUNT(*)::text FROM public.categories WHERE tenant_id = tid AND type = 'menu' AND is_active = true);
  RAISE NOTICE 'fb_modifier_groups: %',
    (SELECT COUNT(*)::text FROM public.fb_modifier_groups WHERE tenant_id = tid);
  RAISE NOTICE 'fb_modifiers: %',
    (SELECT COUNT(*)::text FROM public.fb_modifiers WHERE tenant_id = tid);
  RAISE NOTICE 'fb_menu_item_modifier_groups: %',
    (SELECT COUNT(*)::text FROM public.fb_menu_item_modifier_groups WHERE tenant_id = tid);
  RAISE NOTICE 'fb_kds_tickets (all time): %',
    (SELECT COUNT(*)::text FROM public.fb_kds_tickets WHERE tenant_id = tid);
  RAISE NOTICE 'fb_orders_live_v rows: %',
    (SELECT COUNT(*)::text FROM public.fb_orders_live_v WHERE tenant_id = tid);
END $$;

-- Optional: list KDS tickets by status for this tenant (same UUID as above)
/*
SELECT status, COUNT(*) AS n
FROM public.fb_kds_tickets
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
GROUP BY status
ORDER BY status;
*/
