import { supabase } from '@/lib/supabase';

export const RESTAURANT_STATIONS = ['main', 'cold', 'bar', 'grill', 'dessert'] as const;
export type RestaurantStation = (typeof RESTAURANT_STATIONS)[number];

export const RESTAURANT_PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const;
export type RestaurantPaymentMethod = (typeof RESTAURANT_PAYMENT_METHODS)[number];

export type RestaurantTableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'inactive';
export type RestaurantOrderStatus = 'open' | 'sent' | 'preparing' | 'ready' | 'paid' | 'cancelled';
export type RestaurantKdsStatus = 'pending' | 'preparing' | 'ready' | 'dismissed';

export interface RestaurantBranch {
    id: string;
    name: string;
    name_ar: string | null;
}

export interface RestaurantSettings {
    tenant_id: string;
    branch_id: string | null;
    default_currency: string;
    vat_rate: number;
    service_charge_enabled: boolean;
    service_charge_rate: number;
    rounding_mode: string;
}

export interface RestaurantTable {
    id: string;
    branch_id: string;
    label: string;
    code: string | null;
    area_name: string | null;
    seats: number;
    sort_order: number;
    shape: string;
    status: RestaurantTableStatus;
    is_active: boolean;
    active_order_id: string | null;
    active_order_no?: string | null;
    active_total?: number | null;
    active_order_status?: RestaurantOrderStatus | null;
}

export interface RestaurantModifier {
    id: string;
    modifier_group_id: string;
    name: string;
    name_ar: string | null;
    price_delta: number;
    cost_delta: number;
    prep_station: RestaurantStation | null;
    is_default: boolean;
    is_active: boolean;
    sort_order: number;
}

export interface RestaurantModifierGroup {
    id: string;
    name: string;
    name_ar: string | null;
    description: string | null;
    min_select: number;
    max_select: number;
    is_required: boolean;
    is_active: boolean;
    sort_order: number;
    modifiers: RestaurantModifier[];
}

export interface RestaurantMenuModifierGroupLink {
    id: string;
    modifier_group_id: string;
    sort_order: number;
    required_override: boolean | null;
    min_select_override: number | null;
    max_select_override: number | null;
}

export interface RestaurantMenuItem {
    id: string;
    tenant_id: string;
    branch_id: string | null;
    item_id: string;
    category_id: string | null;
    display_name: string;
    display_name_ar: string | null;
    description: string | null;
    image_url: string | null;
    prep_station: RestaurantStation;
    prep_time_minutes: number;
    cost_alert_threshold_pct: number;
    is_available: boolean;
    is_featured: boolean;
    sort_order: number;
    category_name: string | null;
    category_name_ar: string | null;
    price: number;
    cost: number;
    margin_pct: number | null;
    food_cost_pct: number | null;
    suggested_price: number | null;
    ingredient_count: number;
    modifier_groups: Array<RestaurantModifierGroup & {
        required_override: boolean | null;
        min_select_override: number | null;
        max_select_override: number | null;
    }>;
}

export interface RestaurantCategory {
    id: string;
    name: string;
    name_ar: string | null;
    color: string | null;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
}

export interface RestaurantRecipeIngredient {
    id: string;
    recipe_id: string;
    ingredient_id: string;
    ingredient_name: string;
    ingredient_name_ar: string | null;
    quantity: number;
    cost_snapshot: number;
    waste_pct: number;
    sort_order: number;
}

export interface RestaurantRecipeSummary {
    recipe_id: string;
    item_id: string;
    recipe_name: string;
    cost: number;
    selling_price: number;
    food_cost_pct: number | null;
    ingredient_count: number;
    suggested_price: number | null;
    over_threshold: boolean;
}

export interface RestaurantModifierGroupForm {
    id?: string;
    name: string;
    name_ar?: string;
    description?: string;
    min_select: number;
    max_select: number;
    is_required: boolean;
    is_active: boolean;
    sort_order: number;
    modifiers: Array<{
        id?: string;
        name: string;
        name_ar?: string;
        price_delta: number;
        cost_delta: number;
        prep_station?: RestaurantStation | null;
        is_default: boolean;
        is_active: boolean;
        sort_order: number;
    }>;
}

export interface RestaurantMenuItemForm {
    id?: string;
    item_id?: string;
    branch_id?: string | null;
    category_id?: string | null;
    display_name: string;
    display_name_ar?: string;
    description?: string;
    image_url?: string;
    prep_station: RestaurantStation;
    prep_time_minutes: number;
    price: number;
    cost_alert_threshold_pct: number;
    is_available: boolean;
    is_featured: boolean;
    sort_order: number;
    sku?: string;
    modifier_groups: Array<{
        modifier_group_id: string;
        required_override?: boolean | null;
        min_select_override?: number | null;
        max_select_override?: number | null;
        sort_order: number;
    }>;
    recipe_lines: Array<{
        ingredient_id: string;
        quantity: number;
        cost_snapshot?: number;
        waste_pct?: number;
        sort_order: number;
    }>;
}

export interface RestaurantSelectedModifier {
    id: string;
    modifier_group_id: string;
    name: string;
    name_ar?: string | null;
    price_delta: number;
}

export interface RestaurantDraftLine {
    menu_item_id: string;
    item_id: string;
    name: string;
    name_ar?: string | null;
    image_url?: string | null;
    prep_station: RestaurantStation;
    category_name?: string | null;
    unit_price: number;
    quantity: number;
    notes: string;
    modifiers: RestaurantSelectedModifier[];
}

export interface RestaurantOrderLine {
    id: string;
    menu_item_id: string;
    item_name: string;
    item_name_ar: string | null;
    station: RestaurantStation;
    quantity: number;
    base_unit_price: number;
    modifiers_total: number;
    unit_price: number;
    line_subtotal: number;
    tax_amount: number;
    line_total: number;
    notes: string | null;
    modifiers: RestaurantSelectedModifier[];
    status: string;
}

export interface RestaurantLiveOrder {
    id: string;
    order_no: string;
    branch_id: string;
    table_id: string | null;
    table_label: string | null;
    status: RestaurantOrderStatus;
    covers: number;
    notes: string | null;
    subtotal: number;
    tax_amount: number;
    service_amount: number;
    total: number;
    sent_to_kitchen_at: string | null;
    paid_at: string | null;
    items: RestaurantOrderLine[];
}

export interface RestaurantKdsTicket {
    id: string;
    order_id: string;
    branch_id: string;
    table_id: string | null;
    station: RestaurantStation;
    ticket_no: string;
    status: RestaurantKdsStatus;
    items_snapshot: Array<{
        order_item_id: string;
        item_name: string;
        item_name_ar?: string | null;
        quantity: number;
        notes?: string | null;
        modifiers?: RestaurantSelectedModifier[];
    }>;
    notes: string | null;
    queued_at: string;
    started_at: string | null;
    ready_at: string | null;
    dismissed_at: string | null;
}

export interface RestaurantPaymentSplit {
    method: RestaurantPaymentMethod;
    amount: number;
    transaction_ref?: string;
    card_last4?: string;
    notes?: string;
}

export interface RestaurantOrderSummary {
    subtotal: number;
    tax: number;
    service: number;
    total: number;
}

export interface RestaurantPosSnapshot {
    settings: RestaurantSettings;
    branches: RestaurantBranch[];
    tables: RestaurantTable[];
    categories: RestaurantCategory[];
    menuItems: RestaurantMenuItem[];
}

export interface RestaurantIngredientOption {
    id: string;
    name: string;
    name_ar: string | null;
    cost_price: number;
}

type MenuCatalogRow = Record<string, unknown>;
type SupabaseRow = Record<string, unknown>;

const ACTIVE_ORDER_STATUSES: RestaurantOrderStatus[] = ['open', 'sent', 'preparing', 'ready'];

function num(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
    const raw = typeof value === 'string' ? value.trim() : '';
    return raw ? raw : null;
}

function normalizeError(error: unknown, fallback: string): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string' && error.trim()) return new Error(error);
    if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return new Error((error as { message: string }).message);
    }
    return new Error(fallback);
}

/** يجمع نص PostgREST/Supabase من message وdetails وhint وسلسلة cause. */
function restaurantErrorRawMessage(error: unknown): string {
    const parts: string[] = [];
    const add = (v: unknown) => {
        if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    };
    const walk = (err: unknown, depth: number): void => {
        if (err == null || depth > 5) return;
        if (typeof err === 'string') {
            add(err);
            return;
        }
        if (err instanceof Error) {
            add(err.message);
            walk((err as Error & { cause?: unknown }).cause, depth + 1);
            return;
        }
        if (typeof err === 'object') {
            const o = err as Record<string, unknown>;
            add(o.message);
            add(o.details);
            add(o.hint);
            add(o.code);
            if (o.error != null) walk(o.error, depth + 1);
        }
    };
    walk(error, 0);
    return parts.join(' — ');
}

function normalizeSettingsRow(row: Record<string, unknown>, tenantId: string, branchId: string | null): RestaurantSettings {
    return {
        tenant_id: tenantId,
        branch_id: branchId,
        default_currency: str(row.default_currency, 'AED'),
        vat_rate: num(row.vat_rate, 5),
        service_charge_enabled: Boolean(row.service_charge_enabled),
        service_charge_rate: num(row.service_charge_rate, 0),
        rounding_mode: str(row.rounding_mode, 'nearest_0.01'),
    };
}

function roundWithMode(amount: number, mode: string): number {
    switch (mode) {
        case 'nearest_0.05':
            return Math.round(amount / 0.05) * 0.05;
        case 'nearest_0.10':
            return Math.round(amount / 0.1) * 0.1;
        case 'down_0.01':
            return Math.floor(amount * 100) / 100;
        case 'up_0.01':
            return Math.ceil(amount * 100) / 100;
        default:
            return Math.round(amount * 100) / 100;
    }
}

export function calculateDraftSummary(lines: RestaurantDraftLine[], settings: RestaurantSettings): RestaurantOrderSummary {
    const subtotal = lines.reduce((sum, line) => {
        const modifiersTotal = line.modifiers.reduce((mods, modifier) => mods + num(modifier.price_delta), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity;
    }, 0);
    const tax = roundWithMode(subtotal * (settings.vat_rate / 100), settings.rounding_mode);
    const service = settings.service_charge_enabled
        ? roundWithMode(subtotal * (settings.service_charge_rate / 100), settings.rounding_mode)
        : 0;
    const total = roundWithMode(subtotal + tax + service, settings.rounding_mode);
    return {
        subtotal: roundWithMode(subtotal, settings.rounding_mode),
        tax,
        service,
        total,
    };
}

export function formatRestaurantMoney(value: number, currency = 'AED') {
    return `${currency} ${value.toLocaleString('ar-AE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

async function fetchMenuModifierGroups(tenantId: string) {
    const [{ data: groups, error: groupsError }, { data: modifiers, error: modifiersError }] = await Promise.all([
        supabase.from('fb_modifier_groups').select('*').eq('tenant_id', tenantId).order('sort_order'),
        supabase.from('fb_modifiers').select('*').eq('tenant_id', tenantId).order('sort_order'),
    ]);

    if (groupsError) throw groupsError;
    if (modifiersError) throw modifiersError;

    const modifierMap = new Map<string, RestaurantModifier[]>();
    (modifiers ?? []).forEach((row: SupabaseRow) => {
        const modifier: RestaurantModifier = {
            id: str(row.id),
            modifier_group_id: str(row.modifier_group_id),
            name: str(row.name),
            name_ar: nullableString(row.name_ar),
            price_delta: num(row.price_delta),
            cost_delta: num(row.cost_delta),
            prep_station: nullableString(row.prep_station) as RestaurantStation | null,
            is_default: Boolean(row.is_default),
            is_active: Boolean(row.is_active),
            sort_order: num(row.sort_order),
        };
        const bucket = modifierMap.get(modifier.modifier_group_id) ?? [];
        bucket.push(modifier);
        modifierMap.set(modifier.modifier_group_id, bucket);
    });

    return (groups ?? []).map((row: SupabaseRow): RestaurantModifierGroup => ({
        id: str(row.id),
        name: str(row.name),
        name_ar: nullableString(row.name_ar),
        description: nullableString(row.description),
        min_select: num(row.min_select),
        max_select: num(row.max_select, 1),
        is_required: Boolean(row.is_required),
        is_active: Boolean(row.is_active),
        sort_order: num(row.sort_order),
        modifiers: modifierMap.get(str(row.id)) ?? [],
    }));
}

export async function loadRestaurantModifierGroups(tenantId: string) {
    return fetchMenuModifierGroups(tenantId);
}

export async function loadRestaurantBranches(tenantId: string): Promise<RestaurantBranch[]> {
    const { data, error } = await supabase
        .from('branches')
        .select('id, name, name_ar')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: SupabaseRow) => ({
        id: str(row.id),
        name: str(row.name),
        name_ar: nullableString(row.name_ar),
    }));
}

function normalizeBranchIdForRpc(branchId: string | null | undefined): string | null {
    if (branchId == null) return null;
    const trimmed = String(branchId).trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function loadRestaurantSettings(tenantId: string, branchId: string | null): Promise<RestaurantSettings> {
    const branchForRpc = normalizeBranchIdForRpc(branchId);
    const { data, error } = await supabase.rpc('get_effective_branch_settings', {
        p_tenant_id: tenantId,
        p_branch_id: branchForRpc,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === 'object') {
        return normalizeSettingsRow(row as Record<string, unknown>, tenantId, branchForRpc);
    }

    return {
        tenant_id: tenantId,
        branch_id: branchForRpc,
        default_currency: 'AED',
        vat_rate: 5,
        service_charge_enabled: false,
        service_charge_rate: 0,
        rounding_mode: 'nearest_0.01',
    };
}

export async function loadRestaurantCategories(tenantId: string): Promise<RestaurantCategory[]> {
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_ar, color, icon, sort_order, is_active')
        .eq('tenant_id', tenantId)
        .eq('type', 'menu')
        .order('sort_order');

    if (error) throw error;

    return (data ?? []).map((row: SupabaseRow) => ({
        id: str(row.id),
        name: str(row.name),
        name_ar: nullableString(row.name_ar),
        color: nullableString(row.color),
        icon: nullableString(row.icon),
        sort_order: num(row.sort_order),
        is_active: Boolean(row.is_active),
    }));
}

export async function loadRestaurantTables(tenantId: string, branchId: string): Promise<RestaurantTable[]> {
    const branchKey = normalizeBranchIdForRpc(branchId);
    if (!branchKey) {
        return [];
    }

    const [{ data: tables, error: tablesError }, { data: activeOrders, error: ordersError }] = await Promise.all([
        supabase
            .from('fb_tables')
            .select('id, branch_id, label, code, area_name, seats, sort_order, shape, status, is_active, active_order_id')
            .eq('tenant_id', tenantId)
            .eq('branch_id', branchKey)
            .order('sort_order')
            .order('label'),
        supabase
            .from('fb_orders_live_v')
            .select('id, table_id, order_no, total, status')
            .eq('tenant_id', tenantId)
            .eq('branch_id', branchKey)
            .in('status', ACTIVE_ORDER_STATUSES),
    ]);

    if (tablesError) throw tablesError;
    if (ordersError) throw ordersError;

    const orderMap = new Map<string, SupabaseRow>();
    (activeOrders ?? []).forEach((row: SupabaseRow) => {
        const tableId = str(row.table_id);
        if (tableId) orderMap.set(tableId, row);
    });

    return (tables ?? []).map((row: SupabaseRow): RestaurantTable => {
        const order = orderMap.get(str(row.id));
        return {
            id: str(row.id),
            branch_id: str(row.branch_id),
            label: str(row.label),
            code: nullableString(row.code),
            area_name: nullableString(row.area_name),
            seats: num(row.seats, 2),
            sort_order: num(row.sort_order),
            shape: str(row.shape, 'square'),
            status: str(row.status, 'available') as RestaurantTableStatus,
            is_active: Boolean(row.is_active),
            active_order_id: nullableString(row.active_order_id),
            active_order_no: order ? nullableString(order.order_no) : null,
            active_total: order ? num(order.total) : null,
            active_order_status: order ? (str(order.status) as RestaurantOrderStatus) : null,
        };
    });
}

export async function loadRestaurantMenu(tenantId: string, branchId: string): Promise<RestaurantMenuItem[]> {
    const [catalogResponse, linksResponse, modifierGroups] = await Promise.all([
        supabase.from('fb_menu_catalog_v').select('*').eq('tenant_id', tenantId),
        supabase.from('fb_menu_item_modifier_groups').select('*').eq('tenant_id', tenantId).order('sort_order'),
        fetchMenuModifierGroups(tenantId),
    ]);

    if (catalogResponse.error) throw catalogResponse.error;
    if (linksResponse.error) throw linksResponse.error;

    const groupsMap = new Map<string, RestaurantModifierGroup>();
    modifierGroups.forEach((group) => groupsMap.set(group.id, group));

    const linksByItem = new Map<string, RestaurantMenuModifierGroupLink[]>();
    (linksResponse.data ?? []).forEach((row: SupabaseRow) => {
        const itemId = str(row.menu_item_id);
        const bucket = linksByItem.get(itemId) ?? [];
        bucket.push({
            id: str(row.id),
            modifier_group_id: str(row.modifier_group_id),
            sort_order: num(row.sort_order),
            required_override: typeof row.required_override === 'boolean' ? row.required_override : null,
            min_select_override: row.min_select_override == null ? null : num(row.min_select_override),
            max_select_override: row.max_select_override == null ? null : num(row.max_select_override),
        });
        linksByItem.set(itemId, bucket);
    });

    const rows = (catalogResponse.data ?? []) as MenuCatalogRow[];
    return rows
        .filter((row) => !row.branch_id || row.branch_id === branchId)
        .sort((a, b) => num(a.sort_order) - num(b.sort_order) || str(a.display_name).localeCompare(str(b.display_name), 'ar'))
        .map((row): RestaurantMenuItem => {
            const linkGroups = (linksByItem.get(str(row.id)) ?? [])
                .map((link) => {
                    const group = groupsMap.get(link.modifier_group_id);
                    if (!group) return null;
                    return {
                        ...group,
                        required_override: link.required_override,
                        min_select_override: link.min_select_override,
                        max_select_override: link.max_select_override,
                    };
                })
                .filter(Boolean) as RestaurantMenuItem['modifier_groups'];

            return {
                id: str(row.id),
                tenant_id: str(row.tenant_id),
                branch_id: nullableString(row.branch_id),
                item_id: str(row.item_id),
                category_id: nullableString(row.category_id),
                display_name: str(row.display_name),
                display_name_ar: nullableString(row.display_name_ar),
                description: nullableString(row.description),
                image_url: nullableString(row.image_url),
                prep_station: str(row.prep_station, 'main') as RestaurantStation,
                prep_time_minutes: num(row.prep_time_minutes, 10),
                cost_alert_threshold_pct: num(row.cost_alert_threshold_pct, 30),
                is_available: Boolean(row.is_available),
                is_featured: Boolean(row.is_featured),
                sort_order: num(row.sort_order),
                category_name: nullableString(row.category_name),
                category_name_ar: nullableString(row.category_name_ar),
                price: num(row.price),
                cost: num(row.cost),
                margin_pct: row.margin_pct == null ? null : num(row.margin_pct),
                food_cost_pct: row.food_cost_pct == null ? null : num(row.food_cost_pct),
                suggested_price: row.suggested_price == null ? null : num(row.suggested_price),
                ingredient_count: num(row.ingredient_count),
                modifier_groups: linkGroups,
            };
        });
}

export async function loadRestaurantLiveOrderByTable(tenantId: string, tableId: string): Promise<RestaurantLiveOrder | null> {
    const { data: orders, error: orderError } = await supabase
        .from('fb_orders_live_v')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('table_id', tableId)
        .in('status', ACTIVE_ORDER_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1);

    if (orderError) throw orderError;
    const order = (orders ?? [])[0] as SupabaseRow | undefined;
    if (!order) return null;

    const { data: items, error: itemsError } = await supabase
        .from('fb_order_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('order_id', str(order.id))
        .order('created_at');

    if (itemsError) throw itemsError;

    return {
        id: str(order.id),
        order_no: str(order.order_no),
        branch_id: str(order.branch_id),
        table_id: nullableString(order.table_id),
        table_label: nullableString(order.table_label),
        status: str(order.status) as RestaurantOrderStatus,
        covers: num(order.covers, 1),
        notes: nullableString(order.notes),
        subtotal: num(order.subtotal),
        tax_amount: num(order.tax_amount),
        service_amount: num(order.service_amount),
        total: num(order.total),
        sent_to_kitchen_at: nullableString(order.sent_to_kitchen_at),
        paid_at: nullableString(order.paid_at),
        items: (items ?? []).map((row: SupabaseRow): RestaurantOrderLine => ({
            id: str(row.id),
            menu_item_id: str(row.menu_item_id),
            item_name: str(row.item_name),
            item_name_ar: nullableString(row.item_name_ar),
            station: str(row.station, 'main') as RestaurantStation,
            quantity: num(row.quantity, 1),
            base_unit_price: num(row.base_unit_price),
            modifiers_total: num(row.modifiers_total),
            unit_price: num(row.unit_price),
            line_subtotal: num(row.line_subtotal),
            tax_amount: num(row.tax_amount),
            line_total: num(row.line_total),
            notes: nullableString(row.notes),
            modifiers: Array.isArray(row.modifiers) ? (row.modifiers as RestaurantSelectedModifier[]) : [],
            status: str(row.status, 'sent'),
        })),
    };
}

export async function loadRestaurantPosSnapshot(tenantId: string, branchId?: string | null): Promise<RestaurantPosSnapshot> {
    const branchForQuery = normalizeBranchIdForRpc(branchId) ?? '';
    const [settings, branches, tables, categories, menuItems] = await Promise.all([
        loadRestaurantSettings(tenantId, branchForQuery || null),
        loadRestaurantBranches(tenantId),
        loadRestaurantTables(tenantId, branchForQuery),
        loadRestaurantCategories(tenantId),
        loadRestaurantMenu(tenantId, branchForQuery),
    ]);

    return {
        settings,
        branches,
        tables,
        categories,
        menuItems,
    };
}

export async function sendRestaurantOrderToKitchen(branchId: string, tableId: string, payload: {
    covers: number;
    notes?: string;
    contact_id?: string | null;
    items: RestaurantDraftLine[];
}) {
    const rpcPayload = {
        covers: payload.covers,
        notes: payload.notes ?? '',
        contact_id: payload.contact_id ?? null,
        items: payload.items.map((line) => ({
            menu_item_id: line.menu_item_id,
            quantity: line.quantity,
            notes: line.notes,
            modifiers: line.modifiers.map((modifier) => ({
                id: modifier.id,
                modifier_group_id: modifier.modifier_group_id,
                name: modifier.name,
                price_delta: modifier.price_delta,
            })),
        })),
    };

    const { data, error } = await supabase.rpc('restaurant_send_order_to_kitchen', {
        p_branch_id: branchId,
        p_table_id: tableId,
        p_payload: rpcPayload,
    });

    if (error) throw error;
    return data as Record<string, unknown>;
}

export async function completeRestaurantPayment(orderId: string, payments: RestaurantPaymentSplit[]) {
    const { data, error } = await supabase.rpc('restaurant_complete_payment', {
        p_order_id: orderId,
        p_payments: payments,
    });

    if (error) throw error;
    return data as Record<string, unknown>;
}

export async function cancelRestaurantOrder(orderId: string, reason?: string) {
    const { data, error } = await supabase.rpc('restaurant_cancel_order', {
        p_order_id: orderId,
        p_reason: reason ?? null,
    });

    if (error) throw error;
    return data as Record<string, unknown>;
}

export async function loadKdsTickets(tenantId: string, branchId: string, station: RestaurantStation | 'all' = 'all') {
    let query = supabase
        .from('fb_kds_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('branch_id', branchId)
        .order('queued_at');

    if (station !== 'all') {
        query = query.eq('station', station);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: SupabaseRow): RestaurantKdsTicket => ({
        id: str(row.id),
        order_id: str(row.order_id),
        branch_id: str(row.branch_id),
        table_id: nullableString(row.table_id),
        station: str(row.station, 'main') as RestaurantStation,
        ticket_no: str(row.ticket_no),
        status: str(row.status, 'pending') as RestaurantKdsStatus,
        items_snapshot: Array.isArray(row.items_snapshot) ? (row.items_snapshot as RestaurantKdsTicket['items_snapshot']) : [],
        notes: nullableString(row.notes),
        queued_at: str(row.queued_at),
        started_at: nullableString(row.started_at),
        ready_at: nullableString(row.ready_at),
        dismissed_at: nullableString(row.dismissed_at),
    }));
}

export async function updateKdsTicketStatus(ticketId: string, status: RestaurantKdsStatus) {
    const { data, error } = await supabase.rpc('restaurant_update_kds_ticket_status', {
        p_ticket_id: ticketId,
        p_status: status,
    });

    if (error) throw error;
    return data as Record<string, unknown>;
}

export function subscribeToKdsTickets(branchId: string, onChange: (eventType?: string) => void) {
    const channel = supabase
        .channel(`restaurant-kds-${branchId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'fb_kds_tickets',
            filter: `branch_id=eq.${branchId}`,
        }, (payload) => onChange(payload.eventType))
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

export function toDraftLine(menuItem: RestaurantMenuItem, modifiers: RestaurantSelectedModifier[] = []): RestaurantDraftLine {
    return {
        menu_item_id: menuItem.id,
        item_id: menuItem.item_id,
        name: menuItem.display_name,
        name_ar: menuItem.display_name_ar,
        image_url: menuItem.image_url,
        prep_station: menuItem.prep_station,
        category_name: menuItem.category_name_ar || menuItem.category_name,
        unit_price: menuItem.price,
        quantity: 1,
        notes: '',
        modifiers,
    };
}

export function safeRestaurantErrorMessage(error: unknown, fallback = 'تعذر تنفيذ العملية المطلوبة') {
    const raw = restaurantErrorRawMessage(error) || normalizeError(error, fallback).message;
    if (!raw.trim()) return fallback;
    const lower = raw.toLowerCase();
    if (/permission denied|row-level security|\brls\b|jwt expired|invalid jwt|violates foreign key|duplicate key|null value in column/i.test(raw)) {
        return 'تعذر إكمال العملية. تحقق من الصلاحيات أو البيانات المطلوبة.';
    }
    if (/schema cache|could not find a relationship|pgrst\d+/i.test(lower)) {
        return 'تعذر تحميل بيانات المطعم من الخادم. حدّث الصفحة أو راجع مسؤول النظام.';
    }
    if (/relation .+ does not exist|function .+ does not exist/i.test(raw)) {
        return 'إعداد المطعم غير مكتمل على الخادم. راجع مسؤول النظام.';
    }
    if (raw.length > 220) {
        return fallback;
    }
    return raw;
}

export async function loadRestaurantRecipeData(tenantId: string, menuItems: RestaurantMenuItem[]) {
    const itemIds = Array.from(new Set(menuItems.map((item) => item.item_id)));
    if (itemIds.length === 0) {
        return {
            summaries: [] as RestaurantRecipeSummary[],
            ingredientsByItemId: {} as Record<string, RestaurantRecipeIngredient[]>,
        };
    }

    const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('id, item_id, name')
        .eq('tenant_id', tenantId)
        .in('item_id', itemIds);

    if (recipesError) throw recipesError;

    const recipeRows = (recipes ?? []) as SupabaseRow[];
    if (recipeRows.length === 0) {
        return {
            summaries: [] as RestaurantRecipeSummary[],
            ingredientsByItemId: {} as Record<string, RestaurantRecipeIngredient[]>,
        };
    }

    const recipeIds = recipeRows.map((recipe) => str(recipe.id));
    const { data: ingredientRows, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('id, recipe_id, ingredient_id, quantity, cost_snapshot, waste_pct, sort_order')
        .eq('tenant_id', tenantId)
        .in('recipe_id', recipeIds)
        .order('sort_order');

    if (ingredientsError) throw ingredientsError;

    const ingredientIds = Array.from(new Set((ingredientRows ?? []).map((row: SupabaseRow) => str(row.ingredient_id))));
    const { data: ingredientItems, error: ingredientItemsError } = ingredientIds.length > 0
        ? await supabase.from('items').select('id, name, name_ar, cost_price').eq('tenant_id', tenantId).in('id', ingredientIds)
        : { data: [], error: null };

    if (ingredientItemsError) throw ingredientItemsError;

    const ingredientMap = new Map<string, SupabaseRow>();
    (ingredientItems ?? []).forEach((row: SupabaseRow) => ingredientMap.set(str(row.id), row));

    const ingredientsByRecipeId = new Map<string, RestaurantRecipeIngredient[]>();
    (ingredientRows ?? []).forEach((row: SupabaseRow) => {
        const ingredientItem = ingredientMap.get(str(row.ingredient_id));
        const ingredient: RestaurantRecipeIngredient = {
            id: str(row.id),
            recipe_id: str(row.recipe_id),
            ingredient_id: str(row.ingredient_id),
            ingredient_name: ingredientItem ? str(ingredientItem.name) : 'مكوّن',
            ingredient_name_ar: ingredientItem ? nullableString(ingredientItem.name_ar) : null,
            quantity: num(row.quantity),
            cost_snapshot: num(row.cost_snapshot, ingredientItem ? num(ingredientItem.cost_price) : 0),
            waste_pct: num(row.waste_pct),
            sort_order: num(row.sort_order),
        };
        const bucket = ingredientsByRecipeId.get(ingredient.recipe_id) ?? [];
        bucket.push(ingredient);
        ingredientsByRecipeId.set(ingredient.recipe_id, bucket);
    });

    const menuMap = new Map<string, RestaurantMenuItem>(menuItems.map((item) => [item.item_id, item]));
    const ingredientsByItemId: Record<string, RestaurantRecipeIngredient[]> = {};
    const summaries: RestaurantRecipeSummary[] = recipeRows.map((recipeRow) => {
        const recipeId = str(recipeRow.id);
        const itemId = str(recipeRow.item_id);
        const ingredients = ingredientsByRecipeId.get(recipeId) ?? [];
        const totalCost = ingredients.reduce((sum, ingredient) => {
            return sum + ingredient.quantity * ingredient.cost_snapshot * (1 + ingredient.waste_pct / 100);
        }, 0);
        const menuItem = menuMap.get(itemId);
        const sellingPrice = menuItem?.price ?? 0;
        const foodCostPct = sellingPrice > 0 ? Number(((totalCost / sellingPrice) * 100).toFixed(2)) : null;
        ingredientsByItemId[itemId] = ingredients;
        return {
            recipe_id: recipeId,
            item_id: itemId,
            recipe_name: str(recipeRow.name, menuItem?.display_name || 'وصفة'),
            cost: Number(totalCost.toFixed(2)),
            selling_price: sellingPrice,
            food_cost_pct: foodCostPct,
            ingredient_count: ingredients.length,
            suggested_price: Number((totalCost / 0.30).toFixed(2)),
            over_threshold: foodCostPct != null && foodCostPct > 30,
        };
    });

    return { summaries, ingredientsByItemId };
}

export async function loadRestaurantIngredientOptions(tenantId: string): Promise<RestaurantIngredientOption[]> {
    const { data, error } = await supabase
        .from('items')
        .select('id, name, name_ar, cost_price')
        .eq('tenant_id', tenantId)
        .in('item_type', ['ingredient', 'product'])
        .eq('is_active', true)
        .order('name');

    if (error) throw error;

    return (data ?? []).map((row: SupabaseRow) => ({
        id: str(row.id),
        name: str(row.name),
        name_ar: nullableString(row.name_ar),
        cost_price: num(row.cost_price),
    }));
}

export async function saveRestaurantCategory(tenantId: string, category: Partial<RestaurantCategory> & { name: string }) {
    const payload = {
        id: category.id,
        tenant_id: tenantId,
        name: category.name.trim(),
        name_ar: category.name_ar?.trim() || null,
        color: category.color?.trim() || null,
        icon: category.icon?.trim() || null,
        sort_order: category.sort_order ?? 0,
        is_active: category.is_active ?? true,
        type: 'menu',
    };

    const query = category.id
        ? supabase.from('categories').update(payload).eq('tenant_id', tenantId).eq('id', category.id).select('*').single()
        : supabase.from('categories').insert(payload).select('*').single();

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function deleteRestaurantCategory(tenantId: string, categoryId: string) {
    const { error } = await supabase.from('categories').delete().eq('tenant_id', tenantId).eq('id', categoryId);
    if (error) throw error;
}

export async function saveRestaurantModifierGroup(tenantId: string, payload: RestaurantModifierGroupForm) {
    const groupPayload = {
        id: payload.id,
        tenant_id: tenantId,
        name: payload.name.trim(),
        name_ar: payload.name_ar?.trim() || null,
        description: payload.description?.trim() || null,
        min_select: payload.min_select,
        max_select: payload.max_select,
        is_required: payload.is_required,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
    };

    const groupQuery = payload.id
        ? supabase.from('fb_modifier_groups').update(groupPayload).eq('tenant_id', tenantId).eq('id', payload.id).select('*').single()
        : supabase.from('fb_modifier_groups').insert(groupPayload).select('*').single();

    const { data: savedGroup, error: groupError } = await groupQuery;
    if (groupError) throw groupError;

    const groupId = str(savedGroup.id);
    const { data: existingModifiers, error: existingError } = await supabase
        .from('fb_modifiers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('modifier_group_id', groupId);

    if (existingError) throw existingError;

    const currentIds = new Set(payload.modifiers.map((modifier) => modifier.id).filter(Boolean) as string[]);
    const toDelete = (existingModifiers ?? [])
        .map((row: SupabaseRow) => str(row.id))
        .filter((id) => !currentIds.has(id));

    if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
            .from('fb_modifiers')
            .delete()
            .eq('tenant_id', tenantId)
            .in('id', toDelete);
        if (deleteError) throw deleteError;
    }

    for (const modifier of payload.modifiers) {
        const modifierPayload = {
            id: modifier.id,
            tenant_id: tenantId,
            modifier_group_id: groupId,
            name: modifier.name.trim(),
            name_ar: modifier.name_ar?.trim() || null,
            price_delta: modifier.price_delta,
            cost_delta: modifier.cost_delta,
            prep_station: modifier.prep_station || null,
            is_default: modifier.is_default,
            is_active: modifier.is_active,
            sort_order: modifier.sort_order,
        };

        const modifierQuery = modifier.id
            ? supabase.from('fb_modifiers').update(modifierPayload).eq('tenant_id', tenantId).eq('id', modifier.id)
            : supabase.from('fb_modifiers').insert(modifierPayload);

        const { error: modifierError } = await modifierQuery;
        if (modifierError) throw modifierError;
    }

    return savedGroup;
}

export async function deleteRestaurantModifierGroup(tenantId: string, groupId: string) {
    const { error } = await supabase.from('fb_modifier_groups').delete().eq('tenant_id', tenantId).eq('id', groupId);
    if (error) throw error;
}

export async function saveRestaurantMenuItem(tenantId: string, payload: RestaurantMenuItemForm) {
    const ingredientIds = Array.from(new Set(payload.recipe_lines.map((line) => line.ingredient_id)));
    const ingredientCosts = new Map<string, number>();

    if (ingredientIds.length > 0) {
        const { data: ingredientRows, error: ingredientError } = await supabase
            .from('items')
            .select('id, cost_price')
            .eq('tenant_id', tenantId)
            .in('id', ingredientIds);

        if (ingredientError) throw ingredientError;
        (ingredientRows ?? []).forEach((row: SupabaseRow) => ingredientCosts.set(str(row.id), num(row.cost_price)));
    }

    const derivedCost = payload.recipe_lines.reduce((sum, line) => {
        const unitCost = line.cost_snapshot ?? ingredientCosts.get(line.ingredient_id) ?? 0;
        return sum + line.quantity * unitCost * (1 + (line.waste_pct ?? 0) / 100);
    }, 0);

    const itemPayload = {
        id: payload.item_id,
        tenant_id: tenantId,
        category_id: payload.category_id || null,
        sku: payload.sku?.trim() || null,
        name: payload.display_name.trim(),
        name_ar: payload.display_name_ar?.trim() || null,
        description: payload.description?.trim() || null,
        item_type: 'menu_item',
        cost_price: Number(derivedCost.toFixed(4)),
        selling_price: payload.price,
        track_stock: false,
        reorder_point: 0,
        reorder_qty: 0,
        is_active: true,
        is_sellable: true,
        is_purchasable: false,
    };

    const itemQuery = payload.item_id
        ? supabase.from('items').update(itemPayload).eq('tenant_id', tenantId).eq('id', payload.item_id).select('id').single()
        : supabase.from('items').insert(itemPayload).select('id').single();

    const { data: savedItem, error: itemError } = await itemQuery;
    if (itemError) throw itemError;

    const itemId = str(savedItem.id);

    const menuPayload = {
        id: payload.id,
        tenant_id: tenantId,
        branch_id: payload.branch_id || null,
        item_id: itemId,
        category_id: payload.category_id || null,
        display_name: payload.display_name.trim(),
        display_name_ar: payload.display_name_ar?.trim() || null,
        description: payload.description?.trim() || null,
        image_url: payload.image_url?.trim() || null,
        prep_station: payload.prep_station,
        prep_time_minutes: payload.prep_time_minutes,
        price_override: payload.price,
        cost_alert_threshold_pct: payload.cost_alert_threshold_pct,
        is_available: payload.is_available,
        is_featured: payload.is_featured,
        sort_order: payload.sort_order,
    };

    const menuQuery = payload.id
        ? supabase.from('fb_menu_items').update(menuPayload).eq('tenant_id', tenantId).eq('id', payload.id).select('id').single()
        : supabase.from('fb_menu_items').insert(menuPayload).select('id').single();

    const { data: savedMenuItem, error: menuError } = await menuQuery;
    if (menuError) throw menuError;

    const menuItemId = str(savedMenuItem.id);

    await supabase.from('fb_menu_item_modifier_groups').delete().eq('tenant_id', tenantId).eq('menu_item_id', menuItemId);

    if (payload.modifier_groups.length > 0) {
        const rows = payload.modifier_groups.map((group) => ({
            tenant_id: tenantId,
            menu_item_id: menuItemId,
            modifier_group_id: group.modifier_group_id,
            required_override: group.required_override ?? null,
            min_select_override: group.min_select_override ?? null,
            max_select_override: group.max_select_override ?? null,
            sort_order: group.sort_order,
        }));
        const { error: modifierLinkError } = await supabase.from('fb_menu_item_modifier_groups').insert(rows);
        if (modifierLinkError) throw modifierLinkError;
    }

    if (payload.recipe_lines.length > 0) {
        const { data: savedRecipe, error: recipeError } = await supabase
            .from('recipes')
            .upsert({
                tenant_id: tenantId,
                item_id: itemId,
                name: payload.display_name.trim(),
                is_active: true,
            }, { onConflict: 'tenant_id,item_id' })
            .select('id')
            .single();

        if (recipeError) throw recipeError;

        const recipeId = str(savedRecipe.id);
        await supabase.from('recipe_ingredients').delete().eq('tenant_id', tenantId).eq('recipe_id', recipeId);

        const ingredientRows = payload.recipe_lines.map((line) => ({
            tenant_id: tenantId,
            recipe_id: recipeId,
            ingredient_id: line.ingredient_id,
            quantity: line.quantity,
            cost_snapshot: line.cost_snapshot ?? ingredientCosts.get(line.ingredient_id) ?? 0,
            waste_pct: line.waste_pct ?? 0,
            sort_order: line.sort_order,
        }));

        const { error: ingredientsSaveError } = await supabase.from('recipe_ingredients').insert(ingredientRows);
        if (ingredientsSaveError) throw ingredientsSaveError;
    } else {
        const { data: existingRecipe, error: existingRecipeError } = await supabase
            .from('recipes')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('item_id', itemId)
            .maybeSingle();

        if (existingRecipeError) throw existingRecipeError;

        if (existingRecipe?.id) {
            await supabase.from('recipe_ingredients').delete().eq('tenant_id', tenantId).eq('recipe_id', str(existingRecipe.id));
            await supabase.from('recipes').update({ is_active: false }).eq('tenant_id', tenantId).eq('id', str(existingRecipe.id));
        }
    }

    return {
        item_id: itemId,
        menu_item_id: menuItemId,
    };
}

export async function deleteRestaurantMenuItem(tenantId: string, menuItemId: string) {
    const { data: menuRow, error: menuError } = await supabase
        .from('fb_menu_items')
        .select('item_id')
        .eq('tenant_id', tenantId)
        .eq('id', menuItemId)
        .single();

    if (menuError) throw menuError;

    const itemId = str(menuRow.item_id);

    await supabase.from('fb_menu_item_modifier_groups').delete().eq('tenant_id', tenantId).eq('menu_item_id', menuItemId);
    await supabase.from('fb_menu_items').delete().eq('tenant_id', tenantId).eq('id', menuItemId);
    await supabase.from('recipes').delete().eq('tenant_id', tenantId).eq('item_id', itemId);
    await supabase.from('items').delete().eq('tenant_id', tenantId).eq('id', itemId);
}
