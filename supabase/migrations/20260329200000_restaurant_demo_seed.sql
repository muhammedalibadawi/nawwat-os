-- Minimal demo data for F&B (Restaurant POS / KDS / Menu) — one tenant with no existing fb_tables.
-- Safe to run once per database; skips automatically if fb_tables already has rows for the chosen tenant.

BEGIN;

DO $$
DECLARE
  v_tenant uuid;
  v_branch uuid;
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid();
  i1 uuid := gen_random_uuid();
  i2 uuid := gen_random_uuid();
  i3 uuid := gen_random_uuid();
  i4 uuid := gen_random_uuid();
  i5 uuid := gen_random_uuid();
  i6 uuid := gen_random_uuid();
  i7 uuid := gen_random_uuid();
  i8 uuid := gen_random_uuid();
  mi1 uuid := gen_random_uuid();
  mi2 uuid := gen_random_uuid();
  mi3 uuid := gen_random_uuid();
  mi4 uuid := gen_random_uuid();
  mi5 uuid := gen_random_uuid();
  mi6 uuid := gen_random_uuid();
  mi7 uuid := gen_random_uuid();
  mi8 uuid := gen_random_uuid();
  g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
  mod1 uuid := gen_random_uuid();
  mod2 uuid := gen_random_uuid();
  mod3 uuid := gen_random_uuid();
  mod4 uuid := gen_random_uuid();
BEGIN
  SELECT b.tenant_id, b.id
    INTO v_tenant, v_branch
  FROM public.branches b
  WHERE b.is_active = true
  ORDER BY b.is_default DESC NULLS LAST, b.created_at ASC
  LIMIT 1;

  IF v_tenant IS NULL OR v_branch IS NULL THEN
    RAISE NOTICE 'restaurant_demo_seed: no active branch — skip';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.fb_tables WHERE tenant_id = v_tenant LIMIT 1) THEN
    RAISE NOTICE 'restaurant_demo_seed: fb_tables already present for tenant % — skip', v_tenant;
    RETURN;
  END IF;

  INSERT INTO public.categories (id, tenant_id, name, name_ar, type, sort_order, is_active)
  VALUES
    (c1, v_tenant, 'مشروبات', 'مشروبات', 'menu', 1, true),
    (c2, v_tenant, 'مقبلات', 'مقبلات', 'menu', 2, true),
    (c3, v_tenant, 'أطباق رئيسية', 'أطباق رئيسية', 'menu', 3, true),
    (c4, v_tenant, 'حلويات', 'حلويات', 'menu', 4, true);

  INSERT INTO public.items (
    id, tenant_id, category_id, sku, name, name_ar, item_type,
    cost_price, selling_price, track_stock, reorder_point, reorder_qty,
    is_active, is_sellable, is_purchasable
  ) VALUES
    (i1, v_tenant, c1, 'FB-DEMO-001', 'قهوة عربية', 'قهوة عربية', 'menu_item', 2.5, 12.0, false, 0, 0, true, true, false),
    (i2, v_tenant, c1, 'FB-DEMO-002', 'شاي كرك', 'شاي كرك', 'menu_item', 1.5, 8.0, false, 0, 0, true, true, false),
    (i3, v_tenant, c2, 'FB-DEMO-003', 'سلطة خضراء', 'سلطة خضراء', 'menu_item', 4.0, 18.0, false, 0, 0, true, true, false),
    (i4, v_tenant, c2, 'FB-DEMO-004', 'حمص', 'حمص', 'menu_item', 3.0, 14.0, false, 0, 0, true, true, false),
    (i5, v_tenant, c3, 'FB-DEMO-005', 'دجاج مشوي', 'دجاج مشوي', 'menu_item', 12.0, 42.0, false, 0, 0, true, true, false),
    (i6, v_tenant, c3, 'FB-DEMO-006', 'برغر لحم', 'برغر لحم', 'menu_item', 10.0, 35.0, false, 0, 0, true, true, false),
    (i7, v_tenant, c4, 'FB-DEMO-007', 'كنافة', 'كنافة', 'menu_item', 6.0, 22.0, false, 0, 0, true, true, false),
    (i8, v_tenant, c1, 'FB-DEMO-008', 'ماء معدني', 'ماء معدني', 'menu_item', 0.5, 4.0, false, 0, 0, true, true, false);

  -- Some DBs retain legacy "name" column on fb_menu_items (NOT NULL); set name = display_name.
  INSERT INTO public.fb_menu_items (
    id, tenant_id, branch_id, item_id, category_id,
    name, name_ar,
    display_name, display_name_ar, prep_station, prep_time_minutes,
    cost_alert_threshold_pct, is_available, is_featured, sort_order
  ) VALUES
    (mi1, v_tenant, NULL, i1, c1, 'قهوة عربية', 'قهوة عربية', 'قهوة عربية', 'قهوة عربية', 'main', 5, 30, true, true, 1),
    (mi2, v_tenant, NULL, i2, c1, 'شاي كرك', 'شاي كرك', 'شاي كرك', 'شاي كرك', 'cold', 4, 30, true, false, 2),
    (mi3, v_tenant, NULL, i3, c2, 'سلطة خضراء', 'سلطة خضراء', 'سلطة خضراء', 'سلطة خضراء', 'main', 8, 30, true, false, 3),
    (mi4, v_tenant, NULL, i4, c2, 'حمص', 'حمص', 'حمص', 'حمص', 'main', 6, 30, true, false, 4),
    (mi5, v_tenant, NULL, i5, c3, 'دجاج مشوي', 'دجاج مشوي', 'دجاج مشوي', 'دجاج مشوي', 'grill', 20, 30, true, true, 5),
    (mi6, v_tenant, NULL, i6, c3, 'برغر لحم', 'برغر لحم', 'برغر لحم', 'برغر لحم', 'main', 15, 30, true, true, 6),
    (mi7, v_tenant, NULL, i7, c4, 'كنافة', 'كنافة', 'كنافة', 'كنافة', 'dessert', 10, 30, true, false, 7),
    (mi8, v_tenant, NULL, i8, c1, 'ماء معدني', 'ماء معدني', 'ماء معدني', 'ماء معدني', 'cold', 1, 30, true, false, 8);

  INSERT INTO public.fb_tables (
    tenant_id, branch_id, label, code, area_name, seats, sort_order, shape, status, is_active, table_number
  ) VALUES
    (v_tenant, v_branch, 'طاولة 1', 'T1', 'الصالة', 4, 1, 'square', 'available', true, 1),
    (v_tenant, v_branch, 'طاولة 2', 'T2', 'الصالة', 4, 2, 'square', 'available', true, 2),
    (v_tenant, v_branch, 'طاولة 3', 'T3', 'التراس', 2, 3, 'round', 'available', true, 3);

  INSERT INTO public.fb_modifier_groups (
    id, tenant_id, name, name_ar, description, min_select, max_select, is_required, is_active, sort_order
  ) VALUES
    (g1, v_tenant, 'الحجم', 'الحجم', 'حجم المشروب', 0, 1, false, true, 1),
    (g2, v_tenant, 'إضافات', 'إضافات', 'إضافات البرغر', 0, 2, false, true, 2);

  INSERT INTO public.fb_modifiers (
    id, tenant_id, modifier_group_id, name, name_ar, price_delta, cost_delta, prep_station, is_default, is_active, sort_order
  ) VALUES
    (mod1, v_tenant, g1, 'كبير', 'كبير', 3.0, 0, NULL, false, true, 1),
    (mod2, v_tenant, g1, 'صغير', 'صغير', 0, 0, NULL, true, true, 2),
    (mod3, v_tenant, g2, 'جبن إضافي', 'جبن إضافي', 2.0, 0, 'main', false, true, 1),
    (mod4, v_tenant, g2, 'بدون بصل', 'بدون بصل', 0, 0, 'main', false, true, 2);

  INSERT INTO public.fb_menu_item_modifier_groups (
    tenant_id, menu_item_id, modifier_group_id, sort_order
  ) VALUES
    (v_tenant, mi1, g1, 1),
    (v_tenant, mi6, g2, 1);

  RAISE NOTICE 'restaurant_demo_seed: inserted demo menu + 3 tables for tenant % branch %', v_tenant, v_branch;
END;
$$ LANGUAGE plpgsql;

COMMIT;
