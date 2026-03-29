BEGIN;

-- =============================================================================
-- NawwatOS F&B Sector
-- -----------------------------------------------------------------------------
-- Restaurant-specific operational layer built on top of:
--   - shared foundation (document numbering / tenant settings / audit events)
--   - core ERP tables (items / recipes / orders / invoices / payments)
--
-- Key principles:
--   - secure write paths for kitchen send / payment / KDS state changes
--   - tenant-safe composite foreign keys
--   - RLS for reads, SECURITY DEFINER RPC for sensitive flows
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restaurant_station_code(p_station text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(lower(p_station), 'main')
    WHEN 'cold' THEN 'CLD'
    WHEN 'bar' THEN 'BAR'
    WHEN 'grill' THEN 'GRL'
    WHEN 'dessert' THEN 'DST'
    ELSE 'MAN'
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_rounding_mode(p_amount numeric, p_mode text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_amount numeric := COALESCE(p_amount, 0);
BEGIN
  CASE COALESCE(p_mode, 'nearest_0.01')
    WHEN 'nearest_0.05' THEN RETURN round(v_amount / 0.05) * 0.05;
    WHEN 'nearest_0.10' THEN RETURN round(v_amount / 0.10) * 0.10;
    WHEN 'down_0.01' THEN RETURN trunc(v_amount, 2);
    WHEN 'up_0.01' THEN RETURN ceil(v_amount * 100) / 100;
    ELSE RETURN round(v_amount, 2);
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.restaurant_station_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_station_code(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_rounding_mode(numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_rounding_mode(numeric, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Core F&B tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fb_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  label text NOT NULL,
  code text,
  area_name text,
  seats smallint NOT NULL DEFAULT 2 CHECK (seats > 0),
  sort_order integer NOT NULL DEFAULT 0,
  shape text NOT NULL DEFAULT 'square'
    CHECK (shape IN ('square', 'round', 'booth', 'bar')),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'inactive')),
  active_order_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, branch_id, label),
  CONSTRAINT fk_fb_tables_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.fb_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid,
  item_id uuid NOT NULL,
  category_id uuid,
  display_name text NOT NULL,
  display_name_ar text,
  description text,
  image_url text,
  prep_station text NOT NULL DEFAULT 'main'
    CHECK (prep_station IN ('main', 'cold', 'bar', 'grill', 'dessert')),
  prep_time_minutes integer NOT NULL DEFAULT 10 CHECK (prep_time_minutes >= 0),
  price_override numeric(15,2),
  cost_alert_threshold_pct numeric(5,2) NOT NULL DEFAULT 30 CHECK (cost_alert_threshold_pct > 0 AND cost_alert_threshold_pct <= 100),
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_fb_menu_items_item
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_menu_items_category
    FOREIGN KEY (tenant_id, category_id)
    REFERENCES public.categories(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_fb_menu_items_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.fb_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  description text,
  min_select smallint NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select smallint NOT NULL DEFAULT 1 CHECK (max_select >= 0),
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.fb_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL,
  name text NOT NULL,
  name_ar text,
  price_delta numeric(15,2) NOT NULL DEFAULT 0,
  cost_delta numeric(15,4) NOT NULL DEFAULT 0,
  prep_station text
    CHECK (prep_station IN ('main', 'cold', 'bar', 'grill', 'dessert')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_fb_modifiers_group
    FOREIGN KEY (tenant_id, modifier_group_id)
    REFERENCES public.fb_modifier_groups(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.fb_menu_item_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL,
  modifier_group_id uuid NOT NULL,
  required_override boolean,
  min_select_override smallint CHECK (min_select_override IS NULL OR min_select_override >= 0),
  max_select_override smallint CHECK (max_select_override IS NULL OR max_select_override >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, menu_item_id, modifier_group_id),
  CONSTRAINT fk_fb_menu_item_modifier_groups_item
    FOREIGN KEY (tenant_id, menu_item_id)
    REFERENCES public.fb_menu_items(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_menu_item_modifier_groups_group
    FOREIGN KEY (tenant_id, modifier_group_id)
    REFERENCES public.fb_modifier_groups(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.fb_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  table_id uuid,
  contact_id uuid,
  core_order_id uuid,
  invoice_id uuid,
  order_no text NOT NULL,
  service_type text NOT NULL DEFAULT 'dine_in'
    CHECK (service_type IN ('dine_in', 'takeaway', 'delivery')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'sent', 'preparing', 'ready', 'paid', 'cancelled')),
  covers smallint NOT NULL DEFAULT 1 CHECK (covers > 0),
  notes text,
  cancel_reason text,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  service_amount numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  sent_to_kitchen_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_no),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_fb_orders_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_orders_table
    FOREIGN KEY (tenant_id, table_id)
    REFERENCES public.fb_tables(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_fb_orders_contact
    FOREIGN KEY (tenant_id, contact_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_fb_orders_core_order
    FOREIGN KEY (tenant_id, core_order_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_fb_orders_invoice
    FOREIGN KEY (tenant_id, invoice_id)
    REFERENCES public.invoices(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_fb_orders_created_by
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_fb_orders_updated_by
    FOREIGN KEY (tenant_id, updated_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.fb_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  core_order_item_id uuid,
  station text NOT NULL DEFAULT 'main'
    CHECK (station IN ('main', 'cold', 'bar', 'grill', 'dessert')),
  item_name text NOT NULL,
  item_name_ar text,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  base_unit_price numeric(15,2) NOT NULL DEFAULT 0,
  modifiers_total numeric(15,2) NOT NULL DEFAULT 0,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  line_subtotal numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  line_total numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'preparing', 'ready', 'served', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_fb_order_items_order
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.fb_orders(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_order_items_menu_item
    FOREIGN KEY (tenant_id, menu_item_id)
    REFERENCES public.fb_menu_items(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_fb_order_items_core_order_item
    FOREIGN KEY (tenant_id, core_order_item_id)
    REFERENCES public.order_items(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.fb_kds_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  order_id uuid NOT NULL,
  table_id uuid,
  station text NOT NULL
    CHECK (station IN ('main', 'cold', 'bar', 'grill', 'dessert')),
  ticket_no text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready', 'dismissed')),
  items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ready_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, ticket_no),
  CONSTRAINT fk_fb_kds_tickets_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_kds_tickets_order
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.fb_orders(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_fb_kds_tickets_table
    FOREIGN KEY (tenant_id, table_id)
    REFERENCES public.fb_tables(tenant_id, id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- Legacy schema reconciliation
-- -----------------------------------------------------------------------------
ALTER TABLE public.fb_tables
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS area_name text,
  ADD COLUMN IF NOT EXISTS seats smallint,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS shape text,
  ADD COLUMN IF NOT EXISTS active_order_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_tables AS t
SET label = COALESCE(t.label, t.name, t.table_number, 'Table ' || left(t.id::text, 8)),
    code = COALESCE(t.code, t.table_number, left(t.id::text, 8)),
    area_name = COALESCE(t.area_name, t.zone, t.floor),
    seats = COALESCE(t.seats, t.capacity, 2),
    sort_order = COALESCE(t.sort_order, 0),
    shape = COALESCE(t.shape, 'square'),
    metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object(
        'legacy_floor', t.floor,
        'legacy_zone', t.zone,
        'legacy_x_position', t.x_position,
        'legacy_y_position', t.y_position
      )
    ),
    updated_at = COALESCE(t.updated_at, t.created_at, now())
WHERE t.label IS NULL
   OR t.code IS NULL
   OR t.area_name IS NULL
   OR t.seats IS NULL
   OR t.sort_order IS NULL
   OR t.shape IS NULL
   OR t.metadata IS NULL
   OR t.updated_at IS NULL;

ALTER TABLE public.fb_menu_items
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS display_name_ar text,
  ADD COLUMN IF NOT EXISTS prep_station text,
  ADD COLUMN IF NOT EXISTS price_override numeric(15,2),
  ADD COLUMN IF NOT EXISTS cost_alert_threshold_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_featured boolean,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_menu_items AS mi
SET display_name = COALESCE(mi.display_name, mi.name, 'Menu Item'),
    display_name_ar = COALESCE(mi.display_name_ar, mi.name_ar),
    prep_station = COALESCE(mi.prep_station, mi.kitchen_station, 'main'),
    price_override = COALESCE(mi.price_override, mi.price, 0),
    cost_alert_threshold_pct = COALESCE(mi.cost_alert_threshold_pct, 30),
    is_featured = COALESCE(mi.is_featured, false),
    updated_at = COALESCE(mi.updated_at, mi.created_at, now())
WHERE mi.display_name IS NULL
   OR mi.prep_station IS NULL
   OR mi.price_override IS NULL
   OR mi.cost_alert_threshold_pct IS NULL
   OR mi.is_featured IS NULL
   OR mi.updated_at IS NULL;

INSERT INTO public.items (
  id,
  tenant_id,
  category_id,
  sku,
  name,
  name_ar,
  description,
  item_type,
  cost_price,
  selling_price,
  track_stock,
  reorder_point,
  reorder_qty,
  is_active,
  is_sellable,
  is_purchasable,
  created_at,
  updated_at
)
SELECT
  COALESCE(mi.item_id, mi.id) AS id,
  mi.tenant_id,
  mi.category_id,
  NULL,
  COALESCE(mi.display_name, mi.name, 'Menu Item'),
  COALESCE(mi.display_name_ar, mi.name_ar),
  mi.description,
  'menu_item',
  COALESCE(mi.cost_price, 0),
  COALESCE(mi.price_override, mi.price, 0),
  false,
  0,
  0,
  COALESCE(mi.is_active, true),
  true,
  false,
  COALESCE(mi.created_at, now()),
  COALESCE(mi.updated_at, mi.created_at, now())
FROM public.fb_menu_items AS mi
LEFT JOIN public.items AS it
  ON it.id = COALESCE(mi.item_id, mi.id)
WHERE it.id IS NULL;

UPDATE public.fb_menu_items
SET item_id = COALESCE(item_id, id)
WHERE item_id IS NULL;

ALTER TABLE public.fb_modifier_groups
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_modifier_groups AS g
SET description = COALESCE(g.description, NULL),
    is_active = COALESCE(g.is_active, true),
    sort_order = COALESCE(g.sort_order, 0),
    updated_at = COALESCE(g.updated_at, g.created_at, now())
WHERE g.is_active IS NULL
   OR g.sort_order IS NULL
   OR g.updated_at IS NULL;

ALTER TABLE public.fb_modifiers
  ADD COLUMN IF NOT EXISTS modifier_group_id uuid,
  ADD COLUMN IF NOT EXISTS price_delta numeric(15,2),
  ADD COLUMN IF NOT EXISTS cost_delta numeric(15,4),
  ADD COLUMN IF NOT EXISTS prep_station text,
  ADD COLUMN IF NOT EXISTS is_default boolean,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_modifiers AS m
SET modifier_group_id = COALESCE(m.modifier_group_id, m.group_id),
    price_delta = COALESCE(m.price_delta, m.extra_price, 0),
    cost_delta = COALESCE(m.cost_delta, 0),
    prep_station = COALESCE(m.prep_station, NULL),
    is_default = COALESCE(m.is_default, false),
    updated_at = COALESCE(m.updated_at, now())
WHERE m.modifier_group_id IS NULL
   OR m.price_delta IS NULL
   OR m.cost_delta IS NULL
   OR m.is_default IS NULL
   OR m.updated_at IS NULL;

ALTER TABLE public.fb_menu_item_modifier_groups
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS required_override boolean,
  ADD COLUMN IF NOT EXISTS min_select_override smallint,
  ADD COLUMN IF NOT EXISTS max_select_override smallint,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.fb_menu_item_modifier_groups
SET id = COALESCE(id, gen_random_uuid()),
    sort_order = COALESCE(sort_order, 0),
    created_at = COALESCE(created_at, now())
WHERE id IS NULL
   OR sort_order IS NULL
   OR created_at IS NULL;

UPDATE public.fb_menu_item_modifier_groups AS link
SET tenant_id = mi.tenant_id
FROM public.fb_menu_items AS mi
WHERE mi.id = link.menu_item_id
  AND link.tenant_id IS NULL;

UPDATE public.fb_menu_item_modifier_groups AS link
SET tenant_id = mg.tenant_id
FROM public.fb_modifier_groups AS mg
WHERE mg.id = link.modifier_group_id
  AND link.tenant_id IS NULL;

ALTER TABLE public.fb_orders
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS core_order_id uuid,
  ADD COLUMN IF NOT EXISTS order_no text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS covers smallint,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS service_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS total numeric(15,2),
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_orders AS o
SET contact_id = COALESCE(o.contact_id, o.customer_id),
    order_no = COALESCE(o.order_no, o.order_number, 'FB-' || left(o.id::text, 8)),
    service_type = COALESCE(
      o.service_type,
      CASE lower(COALESCE(o.order_type, ''))
        WHEN 'delivery' THEN 'delivery'
        WHEN 'takeaway' THEN 'takeaway'
        WHEN 'pickup' THEN 'takeaway'
        ELSE 'dine_in'
      END
    ),
    covers = COALESCE(o.covers, 1),
    service_amount = COALESCE(o.service_amount, o.service_charge, 0),
    total = COALESCE(
      o.total,
      o.total_amount,
      COALESCE(o.subtotal, 0) + COALESCE(o.tax_amount, 0) + COALESCE(o.service_charge, 0),
      0
    ),
    created_by = COALESCE(o.created_by, o.waiter_id, o.cashier_id),
    updated_by = COALESCE(o.updated_by, o.cashier_id, o.waiter_id),
    updated_at = COALESCE(o.updated_at, o.paid_at, o.sent_to_kitchen_at, o.created_at, now())
WHERE o.contact_id IS NULL
   OR o.order_no IS NULL
   OR o.service_type IS NULL
   OR o.covers IS NULL
   OR o.service_amount IS NULL
   OR o.total IS NULL
   OR o.updated_at IS NULL;

ALTER TABLE public.fb_order_items
  ADD COLUMN IF NOT EXISTS core_order_item_id uuid,
  ADD COLUMN IF NOT EXISTS station text,
  ADD COLUMN IF NOT EXISTS item_name text,
  ADD COLUMN IF NOT EXISTS item_name_ar text,
  ADD COLUMN IF NOT EXISTS base_unit_price numeric(15,2),
  ADD COLUMN IF NOT EXISTS modifiers_total numeric(15,2),
  ADD COLUMN IF NOT EXISTS line_subtotal numeric(15,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS modifiers jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_order_items AS oi
SET station = COALESCE(oi.station, oi.kitchen_station, mi.prep_station, 'main'),
    item_name = COALESCE(oi.item_name, mi.display_name, mi.name, 'Item'),
    item_name_ar = COALESCE(oi.item_name_ar, mi.display_name_ar, mi.name_ar),
    base_unit_price = COALESCE(oi.base_unit_price, oi.unit_price - COALESCE(oi.modifiers_price, 0), oi.unit_price, 0),
    modifiers_total = COALESCE(oi.modifiers_total, oi.modifiers_price, 0),
    line_subtotal = COALESCE(oi.line_subtotal, oi.line_total, 0),
    tax_amount = COALESCE(oi.tax_amount, 0),
    modifiers = COALESCE(oi.modifiers, oi.modifiers_selected, '[]'::jsonb),
    updated_at = COALESCE(oi.updated_at, oi.sent_at, oi.created_at, now())
FROM public.fb_menu_items AS mi
WHERE mi.tenant_id = oi.tenant_id
  AND mi.id = oi.menu_item_id
  AND (
    oi.station IS NULL
    OR oi.item_name IS NULL
    OR oi.base_unit_price IS NULL
    OR oi.modifiers_total IS NULL
    OR oi.line_subtotal IS NULL
    OR oi.tax_amount IS NULL
    OR oi.modifiers IS NULL
    OR oi.updated_at IS NULL
  );

UPDATE public.fb_order_items AS oi
SET station = COALESCE(oi.station, oi.kitchen_station, 'main'),
    item_name = COALESCE(oi.item_name, 'Item'),
    base_unit_price = COALESCE(oi.base_unit_price, oi.unit_price, 0),
    modifiers_total = COALESCE(oi.modifiers_total, oi.modifiers_price, 0),
    line_subtotal = COALESCE(oi.line_subtotal, oi.line_total, 0),
    tax_amount = COALESCE(oi.tax_amount, 0),
    modifiers = COALESCE(oi.modifiers, oi.modifiers_selected, '[]'::jsonb),
    updated_at = COALESCE(oi.updated_at, oi.sent_at, oi.created_at, now())
WHERE oi.station IS NULL
   OR oi.item_name IS NULL
   OR oi.base_unit_price IS NULL
   OR oi.modifiers_total IS NULL
   OR oi.line_subtotal IS NULL
   OR oi.tax_amount IS NULL
   OR oi.modifiers IS NULL
   OR oi.updated_at IS NULL;

ALTER TABLE public.fb_kds_tickets
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS table_id uuid,
  ADD COLUMN IF NOT EXISTS ticket_no text,
  ADD COLUMN IF NOT EXISTS items_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.fb_kds_tickets AS t
SET branch_id = COALESCE(t.branch_id, o.branch_id),
    table_id = COALESCE(t.table_id, o.table_id),
    notes = COALESCE(t.notes, o.notes),
    queued_at = COALESCE(t.queued_at, t.created_at, t.started_at, now()),
    ready_at = COALESCE(t.ready_at, t.completed_at),
    dismissed_at = COALESCE(t.dismissed_at, t.served_at),
    updated_at = COALESCE(t.updated_at, t.served_at, t.completed_at, t.started_at, t.created_at, now())
FROM public.fb_orders AS o
WHERE o.tenant_id = t.tenant_id
  AND o.id = t.order_id
  AND (
    t.branch_id IS NULL
    OR t.table_id IS NULL
    OR t.notes IS NULL
    OR t.queued_at IS NULL
    OR t.ready_at IS NULL
    OR t.dismissed_at IS NULL
    OR t.updated_at IS NULL
  );

UPDATE public.fb_kds_tickets AS t
SET ticket_no = COALESCE(
      t.ticket_no,
      COALESCE(o.order_no, 'FB-' || left(t.order_id::text, 8))
      || '-'
      || public.restaurant_station_code(t.station)
      || '-'
      || left(t.id::text, 4)
    )
FROM public.fb_orders AS o
WHERE o.tenant_id = t.tenant_id
  AND o.id = t.order_id
  AND t.ticket_no IS NULL;

UPDATE public.fb_kds_tickets AS t
SET ticket_no = COALESCE(
      t.ticket_no,
      'KDS-' || left(t.id::text, 8)
    ),
    queued_at = COALESCE(t.queued_at, t.created_at, now()),
    updated_at = COALESCE(t.updated_at, t.created_at, now())
WHERE t.ticket_no IS NULL
   OR t.queued_at IS NULL
   OR t.updated_at IS NULL;

UPDATE public.fb_kds_tickets AS t
SET items_snapshot = payload.items_snapshot
FROM (
  SELECT
    oi.tenant_id,
    oi.id AS order_item_id,
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', oi.id,
        'item_name', oi.item_name,
        'item_name_ar', oi.item_name_ar,
        'quantity', oi.quantity,
        'notes', oi.notes,
        'modifiers', COALESCE(oi.modifiers, '[]'::jsonb)
      )
    ) AS items_snapshot
  FROM public.fb_order_items AS oi
) AS payload
WHERE t.tenant_id = payload.tenant_id
  AND t.order_item_id = payload.order_item_id
  AND (t.items_snapshot IS NULL OR COALESCE(jsonb_array_length(t.items_snapshot), 0) = 0);

UPDATE public.fb_kds_tickets AS t
SET items_snapshot = payload.items_snapshot
FROM (
  SELECT
    oi.tenant_id,
    oi.order_id,
    oi.station,
    jsonb_agg(
      jsonb_build_object(
        'order_item_id', oi.id,
        'item_name', oi.item_name,
        'item_name_ar', oi.item_name_ar,
        'quantity', oi.quantity,
        'notes', oi.notes,
        'modifiers', COALESCE(oi.modifiers, '[]'::jsonb)
      )
      ORDER BY oi.created_at, oi.id
    ) AS items_snapshot
  FROM public.fb_order_items AS oi
  GROUP BY oi.tenant_id, oi.order_id, oi.station
) AS payload
WHERE t.tenant_id = payload.tenant_id
  AND t.order_id = payload.order_id
  AND t.station = payload.station
  AND (t.items_snapshot IS NULL OR COALESCE(jsonb_array_length(t.items_snapshot), 0) = 0);

WITH latest_active_orders AS (
  SELECT DISTINCT ON (o.tenant_id, o.table_id)
    o.tenant_id,
    o.table_id,
    o.id AS order_id
  FROM public.fb_orders AS o
  WHERE o.table_id IS NOT NULL
    AND o.status IN ('open', 'sent', 'preparing', 'ready')
  ORDER BY o.tenant_id, o.table_id, COALESCE(o.sent_to_kitchen_at, o.created_at) DESC, o.id DESC
)
UPDATE public.fb_tables AS t
SET active_order_id = COALESCE(t.active_order_id, lao.order_id),
    status = CASE
      WHEN t.status IS NULL OR t.status = 'available' THEN 'occupied'
      ELSE t.status
    END
FROM latest_active_orders AS lao
WHERE lao.tenant_id = t.tenant_id
  AND lao.table_id = t.id
  AND t.active_order_id IS NULL;

DO $$
BEGIN
  PERFORM public.ensure_tenant_scoped_unique_id('fb_tables');
  PERFORM public.ensure_tenant_scoped_unique_id('fb_menu_items');
  PERFORM public.ensure_tenant_scoped_unique_id('fb_modifier_groups');
  PERFORM public.ensure_tenant_scoped_unique_id('fb_modifiers');
  PERFORM public.ensure_tenant_scoped_unique_id('fb_orders');
  PERFORM public.ensure_tenant_scoped_unique_id('fb_order_items');
  PERFORM public.ensure_tenant_scoped_unique_id('fb_kds_tickets');
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_fb_tables_active_order'
      AND conrelid = 'public.fb_tables'::regclass
  ) THEN
    ALTER TABLE public.fb_tables
      ADD CONSTRAINT fk_fb_tables_active_order
      FOREIGN KEY (tenant_id, active_order_id)
      REFERENCES public.fb_orders(tenant_id, id) ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.fb_orders
    WHERE table_id IS NOT NULL
      AND status IN ('open', 'sent', 'preparing', 'ready')
    GROUP BY tenant_id, table_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fb_orders_active_table
      ON public.fb_orders(tenant_id, table_id)
      WHERE table_id IS NOT NULL
        AND status IN ('open', 'sent', 'preparing', 'ready');
  ELSE
    CREATE INDEX IF NOT EXISTS idx_fb_orders_active_table_lookup
      ON public.fb_orders(tenant_id, table_id, status)
      WHERE table_id IS NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_fb_tables_branch_status
  ON public.fb_tables(tenant_id, branch_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_fb_menu_items_branch_sort
  ON public.fb_menu_items(tenant_id, branch_id, category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_fb_modifier_groups_sort
  ON public.fb_modifier_groups(tenant_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_fb_modifiers_group_sort
  ON public.fb_modifiers(tenant_id, modifier_group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_fb_orders_branch_status
  ON public.fb_orders(tenant_id, branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fb_order_items_order
  ON public.fb_order_items(tenant_id, order_id, station, status);
CREATE INDEX IF NOT EXISTS idx_fb_kds_tickets_board
  ON public.fb_kds_tickets(tenant_id, branch_id, station, status, queued_at);

DROP TRIGGER IF EXISTS trg_fb_tables_upd ON public.fb_tables;
CREATE TRIGGER trg_fb_tables_upd
BEFORE UPDATE ON public.fb_tables
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fb_menu_items_upd ON public.fb_menu_items;
CREATE TRIGGER trg_fb_menu_items_upd
BEFORE UPDATE ON public.fb_menu_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fb_modifier_groups_upd ON public.fb_modifier_groups;
CREATE TRIGGER trg_fb_modifier_groups_upd
BEFORE UPDATE ON public.fb_modifier_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fb_modifiers_upd ON public.fb_modifiers;
CREATE TRIGGER trg_fb_modifiers_upd
BEFORE UPDATE ON public.fb_modifiers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fb_orders_upd ON public.fb_orders;
CREATE TRIGGER trg_fb_orders_upd
BEFORE UPDATE ON public.fb_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fb_order_items_upd ON public.fb_order_items;
CREATE TRIGGER trg_fb_order_items_upd
BEFORE UPDATE ON public.fb_order_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fb_kds_tickets_upd ON public.fb_kds_tickets;
CREATE TRIGGER trg_fb_kds_tickets_upd
BEFORE UPDATE ON public.fb_kds_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Derived views
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.fb_menu_catalog_v AS
WITH recipe_costs AS (
  SELECT
    r.tenant_id,
    r.item_id,
    COALESCE(
      SUM(
        ri.quantity
        * COALESCE(NULLIF(ri.cost_snapshot, 0), ing.cost_price, 0)
        * (1 + (COALESCE(ri.waste_pct, 0) / 100))
      ),
      0
    )::numeric(15,4) AS recipe_cost,
    COUNT(ri.id)::int AS ingredient_count
  FROM public.recipes r
  LEFT JOIN public.recipe_ingredients ri
    ON ri.tenant_id = r.tenant_id
   AND ri.recipe_id = r.id
  LEFT JOIN public.items ing
    ON ing.tenant_id = ri.tenant_id
   AND ing.id = ri.ingredient_id
  GROUP BY r.tenant_id, r.item_id
)
SELECT
  mi.id,
  mi.tenant_id,
  mi.branch_id,
  mi.item_id,
  mi.category_id,
  mi.display_name,
  mi.display_name_ar,
  mi.description,
  mi.image_url,
  mi.prep_station,
  mi.prep_time_minutes,
  mi.cost_alert_threshold_pct,
  mi.is_available,
  mi.is_featured,
  mi.sort_order,
  it.sku,
  it.barcode,
  COALESCE(mi.price_override, it.selling_price, 0)::numeric(15,2) AS price,
  COALESCE(rc.recipe_cost, it.cost_price, 0)::numeric(15,4) AS cost,
  rc.ingredient_count,
  cat.name AS category_name,
  cat.name_ar AS category_name_ar,
  CASE
    WHEN COALESCE(mi.price_override, it.selling_price, 0) > 0 THEN
      ROUND(
        (
          (COALESCE(mi.price_override, it.selling_price, 0) - COALESCE(rc.recipe_cost, it.cost_price, 0))
          / COALESCE(mi.price_override, it.selling_price, 0)
        ) * 100,
        2
      )
    ELSE NULL
  END AS margin_pct,
  CASE
    WHEN COALESCE(mi.price_override, it.selling_price, 0) > 0 THEN
      ROUND((COALESCE(rc.recipe_cost, it.cost_price, 0) / COALESCE(mi.price_override, it.selling_price, 0)) * 100, 2)
    ELSE NULL
  END AS food_cost_pct,
  ROUND(COALESCE(rc.recipe_cost, it.cost_price, 0) / 0.30, 2) AS suggested_price
FROM public.fb_menu_items mi
JOIN public.items it
  ON it.tenant_id = mi.tenant_id
 AND it.id = mi.item_id
LEFT JOIN public.categories cat
  ON cat.tenant_id = mi.tenant_id
 AND cat.id = mi.category_id
LEFT JOIN recipe_costs rc
  ON rc.tenant_id = mi.tenant_id
 AND rc.item_id = mi.item_id;

CREATE OR REPLACE VIEW public.fb_orders_live_v AS
SELECT
  o.id,
  o.tenant_id,
  o.branch_id,
  o.table_id,
  o.order_no,
  o.service_type,
  o.status,
  o.covers,
  o.notes,
  o.subtotal,
  o.tax_amount,
  o.service_amount,
  o.total,
  o.sent_to_kitchen_at,
  o.paid_at,
  o.created_at,
  t.label AS table_label,
  t.area_name,
  b.name AS branch_name,
  b.name_ar AS branch_name_ar
FROM public.fb_orders o
LEFT JOIN public.fb_tables t
  ON t.tenant_id = o.tenant_id
 AND t.id = o.table_id
LEFT JOIN public.branches b
  ON b.tenant_id = o.tenant_id
 AND b.id = o.branch_id;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.fb_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_kds_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb_tables read staff" ON public.fb_tables;
CREATE POLICY "fb_tables read staff"
ON public.fb_tables
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_tables manage admin" ON public.fb_tables;
CREATE POLICY "fb_tables manage admin"
ON public.fb_tables
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_menu_items read staff" ON public.fb_menu_items;
CREATE POLICY "fb_menu_items read staff"
ON public.fb_menu_items
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_menu_items manage admin" ON public.fb_menu_items;
CREATE POLICY "fb_menu_items manage admin"
ON public.fb_menu_items
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_modifier_groups read staff" ON public.fb_modifier_groups;
CREATE POLICY "fb_modifier_groups read staff"
ON public.fb_modifier_groups
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_modifier_groups manage admin" ON public.fb_modifier_groups;
CREATE POLICY "fb_modifier_groups manage admin"
ON public.fb_modifier_groups
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_modifiers read staff" ON public.fb_modifiers;
CREATE POLICY "fb_modifiers read staff"
ON public.fb_modifiers
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_modifiers manage admin" ON public.fb_modifiers;
CREATE POLICY "fb_modifiers manage admin"
ON public.fb_modifiers
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_menu_item_modifier_groups read staff" ON public.fb_menu_item_modifier_groups;
CREATE POLICY "fb_menu_item_modifier_groups read staff"
ON public.fb_menu_item_modifier_groups
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_menu_item_modifier_groups manage admin" ON public.fb_menu_item_modifier_groups;
CREATE POLICY "fb_menu_item_modifier_groups manage admin"
ON public.fb_menu_item_modifier_groups
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_orders read staff" ON public.fb_orders;
CREATE POLICY "fb_orders read staff"
ON public.fb_orders
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_orders manage admin only" ON public.fb_orders;
CREATE POLICY "fb_orders manage admin only"
ON public.fb_orders
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_order_items read staff" ON public.fb_order_items;
CREATE POLICY "fb_order_items read staff"
ON public.fb_order_items
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_order_items manage admin only" ON public.fb_order_items;
CREATE POLICY "fb_order_items manage admin only"
ON public.fb_order_items
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "fb_kds_tickets read staff" ON public.fb_kds_tickets;
CREATE POLICY "fb_kds_tickets read staff"
ON public.fb_kds_tickets
FOR SELECT
TO authenticated
USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "fb_kds_tickets manage admin only" ON public.fb_kds_tickets;
CREATE POLICY "fb_kds_tickets manage admin only"
ON public.fb_kds_tickets
FOR ALL
TO authenticated
USING (public.is_tenant_admin(tenant_id))
WITH CHECK (public.is_tenant_admin(tenant_id));

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restaurant_send_order_to_kitchen(
  p_branch_id uuid,
  p_table_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_table_row public.fb_tables%ROWTYPE;
  v_settings record;
  v_order_id uuid;
  v_core_order_id uuid;
  v_order_no text;
  v_subtotal numeric(15,2) := 0;
  v_tax_amount numeric(15,2) := 0;
  v_service_amount numeric(15,2) := 0;
  v_total numeric(15,2) := 0;
  v_notes text := NULLIF(trim(COALESCE(p_payload->>'notes', '')), '');
  v_covers smallint := GREATEST(COALESCE((p_payload->>'covers')::smallint, 1), 1);
  v_contact_id uuid := NULLIF(p_payload->>'contact_id', '')::uuid;
  v_items jsonb := COALESCE(p_payload->'items', '[]'::jsonb);
  v_line record;
  v_menu record;
  v_modifier_total numeric(15,2);
  v_unit_price numeric(15,2);
  v_line_subtotal numeric(15,2);
  v_core_order_item_id uuid;
  v_ticket_id uuid;
  v_ticket_payload record;
  v_ticket_ids text[] := ARRAY[]::text[];
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لإرسال الطلب';
  END IF;

  IF NOT public.is_tenant_staff(v_tenant_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإرسال الطلب إلى المطبخ';
  END IF;

  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'لا يمكن إرسال طلب فارغ إلى المطبخ';
  END IF;

  SELECT *
  INTO v_table_row
  FROM public.fb_tables t
  WHERE t.tenant_id = v_tenant_id
    AND t.branch_id = p_branch_id
    AND t.id = p_table_id
    AND t.is_active IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطاولة المحددة غير موجودة أو غير متاحة في هذا الفرع';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fb_orders o
    WHERE o.tenant_id = v_tenant_id
      AND o.table_id = p_table_id
      AND o.status IN ('open', 'sent', 'preparing', 'ready')
  ) THEN
    RAISE EXCEPTION 'يوجد طلب مفتوح بالفعل على هذه الطاولة';
  END IF;

  SELECT *
  INTO v_settings
  FROM public.get_effective_branch_settings(v_tenant_id, p_branch_id)
  LIMIT 1;

  v_order_no := public.next_document_number(
    'order_number',
    v_tenant_id,
    p_branch_id,
    CURRENT_DATE,
    5
  );

  INSERT INTO public.orders (
    tenant_id,
    branch_id,
    order_no,
    order_type,
    status,
    contact_id,
    table_no,
    covers,
    notes,
    cashier_id
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    v_order_no,
    'dine_in',
    'in_progress',
    v_contact_id,
    v_table_row.label,
    v_covers,
    v_notes,
    v_user_id
  )
  RETURNING id INTO v_core_order_id;

  INSERT INTO public.fb_orders (
    tenant_id,
    branch_id,
    table_id,
    contact_id,
    core_order_id,
    order_no,
    service_type,
    status,
    covers,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    v_tenant_id,
    p_branch_id,
    p_table_id,
    v_contact_id,
    v_core_order_id,
    v_order_no,
    'dine_in',
    'sent',
    v_covers,
    v_notes,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT
      NULLIF(trim(line_item->>'menu_item_id'), '')::uuid AS menu_item_id,
      GREATEST(COALESCE((line_item->>'quantity')::numeric, 1), 1) AS quantity,
      NULLIF(trim(COALESCE(line_item->>'notes', '')), '') AS notes,
      COALESCE(line_item->'modifiers', '[]'::jsonb) AS modifiers
    FROM jsonb_array_elements(v_items) AS line_item
  LOOP
    IF v_line.menu_item_id IS NULL THEN
      RAISE EXCEPTION 'كل عنصر في الطلب يجب أن يحتوي على menu_item_id صالح';
    END IF;

    SELECT
      mi.id AS menu_item_id,
      mi.item_id AS base_item_id,
      mi.display_name,
      mi.display_name_ar,
      mi.prep_station,
      COALESCE(mi.price_override, it.selling_price, 0)::numeric(15,2) AS base_price
    INTO v_menu
    FROM public.fb_menu_items mi
    JOIN public.items it
      ON it.tenant_id = mi.tenant_id
     AND it.id = mi.item_id
    WHERE mi.tenant_id = v_tenant_id
      AND mi.id = v_line.menu_item_id
      AND mi.is_available IS TRUE
      AND (mi.branch_id IS NULL OR mi.branch_id = p_branch_id)
    ORDER BY CASE WHEN mi.branch_id = p_branch_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'تعذر العثور على الصنف المطلوب أو أنه غير متاح';
    END IF;

    v_modifier_total := COALESCE(
      (
        SELECT SUM(COALESCE((modifier_row->>'price_delta')::numeric, 0))
        FROM jsonb_array_elements(v_line.modifiers) AS modifier_row
      ),
      0
    )::numeric(15,2);

    v_unit_price := ROUND(v_menu.base_price + v_modifier_total, 2);
    v_line_subtotal := ROUND(v_unit_price * v_line.quantity, 2);
    v_subtotal := ROUND(v_subtotal + v_line_subtotal, 2);

    INSERT INTO public.order_items (
      tenant_id,
      order_id,
      item_id,
      name,
      name_ar,
      quantity,
      unit_price,
      line_total,
      kds_station,
      kds_status,
      kds_sent_at,
      modifiers,
      notes
    )
    VALUES (
      v_tenant_id,
      v_core_order_id,
      v_menu.base_item_id,
      v_menu.display_name,
      v_menu.display_name_ar,
      v_line.quantity,
      v_unit_price,
      v_line_subtotal,
      v_menu.prep_station,
      'pending',
      now(),
      v_line.modifiers,
      v_line.notes
    )
    RETURNING id INTO v_core_order_item_id;

    INSERT INTO public.fb_order_items (
      tenant_id,
      order_id,
      menu_item_id,
      core_order_item_id,
      station,
      item_name,
      item_name_ar,
      quantity,
      base_unit_price,
      modifiers_total,
      unit_price,
      line_subtotal,
      notes,
      modifiers,
      status
    )
    VALUES (
      v_tenant_id,
      v_order_id,
      v_menu.menu_item_id,
      v_core_order_item_id,
      v_menu.prep_station,
      v_menu.display_name,
      v_menu.display_name_ar,
      v_line.quantity,
      v_menu.base_price,
      v_modifier_total,
      v_unit_price,
      v_line_subtotal,
      v_line.notes,
      v_line.modifiers,
      'sent'
    );
  END LOOP;

  v_tax_amount := public.apply_rounding_mode(
    v_subtotal * (COALESCE(v_settings.vat_rate, 0) / 100),
    COALESCE(v_settings.rounding_mode, 'nearest_0.01')
  )::numeric(15,2);

  v_service_amount := CASE
    WHEN COALESCE(v_settings.service_charge_enabled, false) THEN
      public.apply_rounding_mode(
        v_subtotal * (COALESCE(v_settings.service_charge_rate, 0) / 100),
        COALESCE(v_settings.rounding_mode, 'nearest_0.01')
      )::numeric(15,2)
    ELSE 0
  END;

  v_total := public.apply_rounding_mode(
    v_subtotal + v_tax_amount + v_service_amount,
    COALESCE(v_settings.rounding_mode, 'nearest_0.01')
  )::numeric(15,2);

  UPDATE public.fb_orders
     SET subtotal = v_subtotal,
         tax_amount = v_tax_amount,
         service_amount = v_service_amount,
         total = v_total,
         status = 'sent',
         sent_to_kitchen_at = now(),
         updated_by = v_user_id
   WHERE tenant_id = v_tenant_id
     AND id = v_order_id;

  UPDATE public.orders
     SET subtotal = v_subtotal,
         taxable_amount = v_subtotal + v_service_amount,
         tax_amount = v_tax_amount,
         total = v_total,
         notes = v_notes,
         table_no = v_table_row.label,
         covers = v_covers,
         status = 'in_progress'
   WHERE tenant_id = v_tenant_id
     AND id = v_core_order_id;

  FOR v_ticket_payload IN
    SELECT
      grouped.station,
      grouped.items
    FROM (
      SELECT
        oi.station,
        jsonb_agg(
          jsonb_build_object(
            'order_item_id', oi.id,
            'item_name', oi.item_name,
            'item_name_ar', oi.item_name_ar,
            'quantity', oi.quantity,
            'notes', oi.notes,
            'modifiers', oi.modifiers
          )
          ORDER BY oi.created_at, oi.id
        ) AS items
      FROM public.fb_order_items oi
      WHERE oi.tenant_id = v_tenant_id
        AND oi.order_id = v_order_id
      GROUP BY oi.station
    ) AS grouped
  LOOP
    INSERT INTO public.fb_kds_tickets (
      tenant_id,
      branch_id,
      order_id,
      table_id,
      station,
      ticket_no,
      status,
      items_snapshot,
      notes
    )
    VALUES (
      v_tenant_id,
      p_branch_id,
      v_order_id,
      p_table_id,
      COALESCE(v_ticket_payload.station, 'main'),
      v_order_no || '-' || public.restaurant_station_code(v_ticket_payload.station),
      'pending',
      COALESCE(v_ticket_payload.items, '[]'::jsonb),
      v_notes
    )
    RETURNING id INTO v_ticket_id;

    v_ticket_ids := array_append(v_ticket_ids, v_ticket_id::text);
  END LOOP;

  UPDATE public.fb_tables
     SET status = 'occupied',
         active_order_id = v_order_id
   WHERE tenant_id = v_tenant_id
     AND id = p_table_id;

  PERFORM public.log_audit_event(
    v_tenant_id,
    'restaurant.order.sent_to_kitchen',
    'fb_order',
    v_order_id,
    jsonb_build_object(
      'table_id', p_table_id,
      'branch_id', p_branch_id,
      'order_no', v_order_no,
      'items_count', jsonb_array_length(v_items),
      'total', v_total
    ),
    true,
    p_branch_id
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'core_order_id', v_core_order_id,
    'order_no', v_order_no,
    'subtotal', v_subtotal,
    'tax_amount', v_tax_amount,
    'service_amount', v_service_amount,
    'total', v_total,
    'table_status', 'occupied',
    'ticket_ids', to_jsonb(v_ticket_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_complete_payment(
  p_order_id uuid,
  p_payments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.current_employee_user_id();
  v_order public.fb_orders%ROWTYPE;
  v_settings record;
  v_invoice_id uuid;
  v_invoice_no text;
  v_payment_row record;
  v_total_paid numeric(15,2) := 0;
  v_method text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لإتمام الدفع';
  END IF;

  IF NOT public.is_tenant_staff(v_tenant_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإتمام الدفع';
  END IF;

  IF jsonb_typeof(COALESCE(p_payments, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_payments, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'يلزم تمرير وسيلة دفع واحدة على الأقل';
  END IF;

  SELECT *
  INTO v_order
  FROM public.fb_orders
  WHERE tenant_id = v_tenant_id
    AND id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تعذر العثور على طلب المطعم المطلوب';
  END IF;

  IF v_order.status = 'paid' THEN
    RAISE EXCEPTION 'تم سداد هذا الطلب مسبقًا';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'لا يمكن سداد طلب ملغي';
  END IF;

  SELECT *
  INTO v_settings
  FROM public.get_effective_branch_settings(v_tenant_id, v_order.branch_id)
  LIMIT 1;

  FOR v_payment_row IN
    SELECT
      lower(trim(COALESCE(payment_line->>'method', 'cash'))) AS method,
      COALESCE((payment_line->>'amount')::numeric, 0)::numeric(15,2) AS amount
    FROM jsonb_array_elements(p_payments) AS payment_line
  LOOP
    IF v_payment_row.amount <= 0 THEN
      RAISE EXCEPTION 'كل دفعة يجب أن تكون أكبر من صفر';
    END IF;

    v_total_paid := ROUND(v_total_paid + v_payment_row.amount, 2);
  END LOOP;

  IF ABS(v_total_paid - v_order.total) > 0.05 THEN
    RAISE EXCEPTION 'إجمالي المدفوعات (%) لا يطابق إجمالي الطلب (%)', v_total_paid, v_order.total;
  END IF;

  v_invoice_no := public.next_document_number(
    'invoice_number',
    v_tenant_id,
    NULL,
    CURRENT_DATE,
    5
  );

  INSERT INTO public.invoices (
    tenant_id,
    branch_id,
    invoice_no,
    invoice_type,
    status,
    contact_id,
    order_id,
    issue_date,
    subtotal,
    taxable_amount,
    tax_amount,
    total,
    amount_paid,
    currency,
    exchange_rate,
    notes,
    created_by
  )
  VALUES (
    v_tenant_id,
    v_order.branch_id,
    v_invoice_no,
    'sale',
    'paid',
    v_order.contact_id,
    v_order.core_order_id,
    CURRENT_DATE,
    v_order.subtotal,
    v_order.subtotal + v_order.service_amount,
    v_order.tax_amount,
    v_order.total,
    v_total_paid,
    COALESCE(v_settings.default_currency, 'AED'),
    1,
    COALESCE(v_order.notes, 'Restaurant POS'),
    v_user_id
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (
    tenant_id,
    invoice_id,
    item_ref,
    name,
    name_ar,
    quantity,
    unit_price,
    net_amount,
    tax_rate,
    tax_amount,
    line_total,
    sort_order
  )
  SELECT
    oi.tenant_id,
    v_invoice_id,
    oi.menu_item_id::text,
    oi.item_name,
    oi.item_name_ar,
    oi.quantity,
    oi.unit_price,
    oi.line_subtotal,
    COALESCE(v_settings.vat_rate, 0),
    oi.tax_amount,
    oi.line_total,
    ROW_NUMBER() OVER (ORDER BY oi.created_at, oi.id)::smallint
  FROM public.fb_order_items oi
  WHERE oi.tenant_id = v_tenant_id
    AND oi.order_id = p_order_id;

  FOR v_payment_row IN
    SELECT
      lower(trim(COALESCE(payment_line->>'method', 'cash'))) AS method,
      COALESCE((payment_line->>'amount')::numeric, 0)::numeric(15,2) AS amount,
      NULLIF(trim(COALESCE(payment_line->>'transaction_ref', '')), '') AS transaction_ref,
      NULLIF(trim(COALESCE(payment_line->>'card_last4', '')), '') AS card_last4,
      NULLIF(trim(COALESCE(payment_line->>'notes', '')), '') AS notes
    FROM jsonb_array_elements(p_payments) AS payment_line
  LOOP
    v_method := CASE v_payment_row.method
      WHEN 'transfer' THEN 'bank_transfer'
      ELSE v_payment_row.method
    END;

    IF v_method NOT IN ('cash', 'card', 'bank_transfer') THEN
      RAISE EXCEPTION 'وسيلة الدفع غير مدعومة: %', v_payment_row.method;
    END IF;

    INSERT INTO public.payments (
      tenant_id,
      branch_id,
      reference_type,
      reference_id,
      contact_id,
      amount,
      currency,
      method,
      status,
      transaction_ref,
      card_last4,
      notes,
      received_by
    )
    VALUES (
      v_tenant_id,
      v_order.branch_id,
      'invoice',
      v_invoice_id,
      v_order.contact_id,
      v_payment_row.amount,
      COALESCE(v_settings.default_currency, 'AED'),
      v_method,
      'completed',
      v_payment_row.transaction_ref,
      v_payment_row.card_last4,
      v_payment_row.notes,
      v_user_id
    );
  END LOOP;

  UPDATE public.fb_orders
     SET status = 'paid',
         invoice_id = v_invoice_id,
         paid_at = now(),
         updated_by = v_user_id
   WHERE tenant_id = v_tenant_id
     AND id = p_order_id;

  UPDATE public.orders
     SET status = 'completed',
         completed_at = now()
   WHERE tenant_id = v_tenant_id
     AND id = v_order.core_order_id;

  UPDATE public.fb_order_items
     SET status = 'served'
   WHERE tenant_id = v_tenant_id
     AND order_id = p_order_id;

  UPDATE public.fb_tables
     SET status = 'available',
         active_order_id = NULL
   WHERE tenant_id = v_tenant_id
     AND id = v_order.table_id;

  PERFORM public.log_audit_event(
    v_tenant_id,
    'restaurant.order.paid',
    'fb_order',
    p_order_id,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'invoice_no', v_invoice_no,
      'total', v_order.total,
      'payments', p_payments
    ),
    true,
    v_order.branch_id
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'invoice_id', v_invoice_id,
    'invoice_no', v_invoice_no,
    'paid_total', v_total_paid,
    'currency', COALESCE(v_settings.default_currency, 'AED'),
    'paid_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_cancel_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_order public.fb_orders%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لإلغاء الطلب';
  END IF;

  IF NOT public.is_tenant_staff(v_tenant_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بإلغاء الطلب';
  END IF;

  SELECT *
  INTO v_order
  FROM public.fb_orders
  WHERE tenant_id = v_tenant_id
    AND id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_order.status = 'paid' THEN
    RAISE EXCEPTION 'لا يمكن إلغاء طلب تم سداده';
  END IF;

  UPDATE public.fb_orders
     SET status = 'cancelled',
         cancel_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
         updated_by = public.current_employee_user_id()
   WHERE tenant_id = v_tenant_id
     AND id = p_order_id;

  UPDATE public.orders
     SET status = 'cancelled',
         notes = CONCAT_WS(E'\n', NULLIF(notes, ''), 'Cancelled: ' || COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'No reason'))
   WHERE tenant_id = v_tenant_id
     AND id = v_order.core_order_id;

  UPDATE public.fb_order_items
     SET status = 'cancelled'
   WHERE tenant_id = v_tenant_id
     AND order_id = p_order_id;

  UPDATE public.fb_kds_tickets
     SET status = 'dismissed',
         dismissed_at = now()
   WHERE tenant_id = v_tenant_id
     AND order_id = p_order_id
     AND status <> 'dismissed';

  UPDATE public.fb_tables
     SET status = 'available',
         active_order_id = NULL
   WHERE tenant_id = v_tenant_id
     AND id = v_order.table_id;

  PERFORM public.log_audit_event(
    v_tenant_id,
    'restaurant.order.cancelled',
    'fb_order',
    p_order_id,
    jsonb_build_object('reason', p_reason),
    true,
    v_order.branch_id
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'status', 'cancelled'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_update_kds_ticket_status(
  p_ticket_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_ticket public.fb_kds_tickets%ROWTYPE;
  v_target_status text := lower(trim(COALESCE(p_status, '')));
  v_order_status text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'تعذر تحديد المستأجر الحالي لتحديث التذكرة';
  END IF;

  IF NOT public.is_tenant_staff(v_tenant_id) THEN
    RAISE EXCEPTION 'غير مصرح لك بتحديث حالة التذكرة';
  END IF;

  IF v_target_status NOT IN ('pending', 'preparing', 'ready', 'dismissed') THEN
    RAISE EXCEPTION 'حالة التذكرة غير مدعومة: %', p_status;
  END IF;

  SELECT *
  INTO v_ticket
  FROM public.fb_kds_tickets
  WHERE tenant_id = v_tenant_id
    AND id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'تذكرة المطبخ غير موجودة';
  END IF;

  UPDATE public.fb_kds_tickets
     SET status = v_target_status,
         started_at = CASE
           WHEN v_target_status = 'preparing' AND started_at IS NULL THEN now()
           ELSE started_at
         END,
         ready_at = CASE
           WHEN v_target_status = 'ready' THEN now()
           ELSE ready_at
         END,
         dismissed_at = CASE
           WHEN v_target_status = 'dismissed' THEN now()
           ELSE dismissed_at
         END
   WHERE tenant_id = v_tenant_id
     AND id = p_ticket_id;

  UPDATE public.fb_order_items
     SET status = CASE v_target_status
       WHEN 'pending' THEN 'sent'
       WHEN 'preparing' THEN 'preparing'
       WHEN 'ready' THEN 'ready'
       WHEN 'dismissed' THEN 'served'
       ELSE status
     END
   WHERE tenant_id = v_tenant_id
     AND order_id = v_ticket.order_id
     AND station = v_ticket.station;

  v_order_status := CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.fb_kds_tickets t
      WHERE t.tenant_id = v_tenant_id
        AND t.order_id = v_ticket.order_id
        AND t.status = 'preparing'
    ) THEN 'preparing'
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.fb_kds_tickets t
      WHERE t.tenant_id = v_tenant_id
        AND t.order_id = v_ticket.order_id
        AND t.status IN ('pending', 'preparing')
    ) THEN 'ready'
    ELSE 'sent'
  END;

  UPDATE public.fb_orders
     SET status = v_order_status
   WHERE tenant_id = v_tenant_id
     AND id = v_ticket.order_id
     AND status <> 'paid';

  PERFORM public.log_audit_event(
    v_tenant_id,
    'restaurant.kds.ticket_updated',
    'fb_kds_ticket',
    p_ticket_id,
    jsonb_build_object(
      'order_id', v_ticket.order_id,
      'station', v_ticket.station,
      'status', v_target_status
    ),
    true,
    v_ticket.branch_id
  );

  RETURN jsonb_build_object(
    'ticket_id', p_ticket_id,
    'status', v_target_status,
    'order_status', v_order_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restaurant_send_order_to_kitchen(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_send_order_to_kitchen(uuid, uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restaurant_complete_payment(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_complete_payment(uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restaurant_cancel_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_cancel_order(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restaurant_update_kds_ticket_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_update_kds_ticket_status(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel rel
      JOIN pg_class c ON c.oid = rel.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE rel.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND n.nspname = 'public'
        AND c.relname = 'fb_kds_tickets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.fb_kds_tickets;
    END IF;
  END IF;
END;
$$;

COMMIT;
