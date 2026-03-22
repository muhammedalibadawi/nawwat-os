import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Package, AlertCircle, PlusCircle, Pencil, Trash2, Building2, ArrowRightLeft, BarChart3, BellRing, Warehouse, ImageIcon, Eye } from 'lucide-react';

type TabKey = 'products' | 'movements' | 'reports' | 'warehouses' | 'alerts' | 'transfers' | 'writeoffs';
type StockFilter = 'all' | 'available' | 'low' | 'out';
type MovementType = 'receipt' | 'issue' | 'transfer' | 'adjustment' | 'waste';

interface ItemRow {
    id: string;
    name: string;
    name_ar: string | null;
    sku: string;
    barcode: string | null;
    category_id: string | null;
    selling_price: number | null;
    cost_price: number | null;
    min_price: number | null;
    reorder_point: number | null;
    reorder_qty: number | null;
    track_stock: boolean | null;
    is_active: boolean | null;
    is_sellable: boolean | null;
    item_type: string | null;
    tax_id: string | null;
    is_tax_inclusive: boolean | null;
}

interface StockLevelRow {
    id: string;
    item_id: string;
    warehouse_id: string | null;
    quantity: number | null;
}

interface MovementRow {
    id: string;
    item_id: string;
    movement_type: MovementType;
    quantity: number;
    unit_cost: number | null;
    total_cost: number | null;
    reference_type: string | null;
    reference_id: string | null;
    batch_no: string | null;
    expiry_date: string | null;
    notes: string | null;
    created_at: string;
    warehouse_id: string | null;
    created_by: string | null;
}

interface WarehouseRow {
    id: string;
    branch_id: string | null;
    name: string;
    name_ar: string | null;
    type: string | null;
    is_active: boolean | null;
}

const tabs: { key: TabKey; label: string }[] = [
    { key: 'products', label: '📦 المنتجات' },
    { key: 'movements', label: '🔄 الحركات' },
    { key: 'reports', label: '📊 التقارير' },
    { key: 'warehouses', label: '🏭 المستودعات' },
    { key: 'alerts', label: '⚠️ التنبيهات' },
    { key: 'transfers', label: '🔀 التحويلات' },
    { key: 'writeoffs', label: '🗑️ الإتلاف والتسوية' },
];

const WASTE_REASONS: { id: string; label: string }[] = [
    { id: 'damage', label: 'تلف' },
    { id: 'expiry', label: 'انتهاء صلاحية' },
    { id: 'theft', label: 'سرقة' },
    { id: 'sample', label: 'عينة' },
    { id: 'internal', label: 'استخدام داخلي' },
    { id: 'donation', label: 'تبرع' },
    { id: 'inventory_diff', label: 'فروق جرد' },
    { id: 'other', label: 'أخرى' },
];

const movementTypeLabel: Record<MovementType, string> = {
    receipt: '📥 استلام',
    issue: '📤 صرف',
    transfer: '🔁 تحويل',
    adjustment: '✏️ تعديل جرد',
    waste: '🗑️ هالك/تالف',
};

const num = (v: number) => v.toLocaleString('ar-AE');
const money = (v: number) => `AED ${v.toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InventoryScreen() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabKey>('products');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [items, setItems] = useState<ItemRow[]>([]);
    const [stockLevels, setStockLevels] = useState<StockLevelRow[]>([]);
    const [movements, setMovements] = useState<MovementRow[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
    const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

    const [stockFilter, setStockFilter] = useState<StockFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | MovementType>('all');
    const [movementProductFilter, setMovementProductFilter] = useState('all');
    const [movementFromDate, setMovementFromDate] = useState('');
    const [movementToDate, setMovementToDate] = useState('');
    const [warehouseProductsFilter, setWarehouseProductsFilter] = useState('all');

    const [showProductModal, setShowProductModal] = useState(false);
    const [savingProduct, setSavingProduct] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [productError, setProductError] = useState('');
    const [productForm, setProductForm] = useState({
        name: '',
        name_ar: '',
        sku: '',
        barcode: '',
        category_id: '',
        selling_price: '',
        cost_price: '',
        reorder_point: '',
        reorder_qty: '',
    });

    const [showMovementModal, setShowMovementModal] = useState(false);
    const [savingMovement, setSavingMovement] = useState(false);
    const [movementError, setMovementError] = useState('');
    const [movementForm, setMovementForm] = useState({
        item_id: '',
        movement_type: 'receipt' as MovementType,
        quantity: '',
        unit_cost: '',
        warehouse_id: '',
        reference_type: '',
        reference_id: '',
        batch_no: '',
        expiry_date: '',
        notes: '',
    });

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferSaving, setTransferSaving] = useState(false);
    const [transferError, setTransferError] = useState('');
    const [transferForm, setTransferForm] = useState({
        item_id: '',
        from_warehouse_id: '',
        to_warehouse_id: '',
        quantity: '',
    });

    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [savingWarehouse, setSavingWarehouse] = useState(false);
    const [warehouseError, setWarehouseError] = useState('');
    const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
    const [warehouseForm, setWarehouseForm] = useState({
        name: '',
        name_ar: '',
        type: 'branch',
    });

    const [writeoffs, setWriteoffs] = useState<any[]>([]);
    const [writeoffsLoading, setWriteoffsLoading] = useState(false);
    const [showWriteoffModal, setShowWriteoffModal] = useState(false);
    const [savingWriteoff, setSavingWriteoff] = useState(false);
    const [writeoffError, setWriteoffError] = useState('');
    const [writeoffForm, setWriteoffForm] = useState({
        item_id: '',
        warehouse_id: '',
        quantity: '',
        unit_cost: '',
        reason: 'damage',
        notes: '',
        receipt_url: '',
    });

    const loadWriteoffs = async () => {
        if (!user?.tenant_id) {
            setWriteoffs([]);
            return;
        }
        setWriteoffsLoading(true);
        setWriteoffError('');
        try {
            const { data, error: wErr } = await supabase
                .from('inventory_writeoffs')
                .select('*')
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false });
            if (wErr) throw wErr;
            setWriteoffs(data ?? []);
        } catch (err: any) {
            setWriteoffs([]);
            setWriteoffError(err?.message ?? 'فشل تحميل الإتلافات');
        } finally {
            setWriteoffsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'writeoffs' && user?.tenant_id) {
            void loadWriteoffs();
        }
    }, [activeTab, user?.tenant_id]);

    const loadAll = async () => {
        if (!user?.tenant_id) {
            setItems([]);
            setStockLevels([]);
            setMovements([]);
            setWarehouses([]);
            setInvoiceItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const [itemsRes, stockRes, movRes, whRes, invItemsRes] = await Promise.all([
                supabase
                    .from('items')
                    .select(
                        'id,name,name_ar,sku,barcode,category_id,cost_price,selling_price,min_price,reorder_point,reorder_qty,track_stock,is_active,is_sellable,item_type,tax_id,is_tax_inclusive'
                    )
                    .eq('tenant_id', user.tenant_id)
                    .is('deleted_at', null)
                    .order('name'),
                supabase
                    .from('stock_levels')
                    .select('id,item_id,warehouse_id,quantity')
                    .eq('tenant_id', user.tenant_id),
                supabase
                    .from('inventory_movements')
                    .select('id,item_id,warehouse_id,movement_type,quantity,unit_cost,total_cost,reference_type,reference_id,batch_no,expiry_date,notes,created_by,created_at')
                    .eq('tenant_id', user.tenant_id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('warehouses')
                    .select('id,name,name_ar,type,is_active,branch_id')
                    .eq('tenant_id', user.tenant_id)
                    .eq('is_active', true)
                    .order('name'),
                supabase
                    .from('invoice_items')
                    .select('item_ref,name,quantity,line_total')
                    .eq('tenant_id', user.tenant_id),
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (stockRes.error) throw stockRes.error;
            if (movRes.error) throw movRes.error;
            if (whRes.error) throw whRes.error;
            if (invItemsRes.error) throw invItemsRes.error;

            setItems((itemsRes.data as ItemRow[]) ?? []);
            setStockLevels((stockRes.data as StockLevelRow[]) ?? []);
            setMovements((movRes.data as MovementRow[]) ?? []);
            setWarehouses((whRes.data as WarehouseRow[]) ?? []);
            setInvoiceItems(invItemsRes.data ?? []);
        } catch (err: any) {
            setError(err?.message ?? 'فشل تحميل بيانات المخزون');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, [user?.tenant_id]);

    const qtyByItem = useMemo(() => {
        const map: Record<string, number> = {};
        stockLevels.forEach((s) => {
            map[s.item_id] = (map[s.item_id] ?? 0) + Number(s.quantity ?? 0);
        });
        return map;
    }, [stockLevels]);

    const warehouseQtyByItem = useMemo(() => {
        if (warehouseProductsFilter === 'all') return qtyByItem;
        const map: Record<string, number> = {};
        stockLevels
            .filter((s) => s.warehouse_id === warehouseProductsFilter)
            .forEach((s) => {
                map[s.item_id] = (map[s.item_id] ?? 0) + Number(s.quantity ?? 0);
            });
        return map;
    }, [stockLevels, qtyByItem, warehouseProductsFilter]);

    const enrichedItems = useMemo(() => {
        return items.map((item) => {
            const qty = warehouseQtyByItem[item.id] ?? 0;
            const min = Number(item.reorder_point ?? 0);
            const cost = Number(item.cost_price ?? 0);
            const value = qty * cost;
            const status: 'out' | 'low' | 'available' = qty === 0 ? 'out' : qty <= min ? 'low' : 'available';
            return { ...item, qty, min, cost, value, status };
        });
    }, [items, warehouseQtyByItem]);

    const categories = useMemo(() => {
        const set = new Set<string>();
        enrichedItems.forEach((i) => i.category_id && set.add(i.category_id));
        return Array.from(set);
    }, [enrichedItems]);

    const productsView = useMemo(() => {
        return enrichedItems.filter((i) => {
            if (stockFilter !== 'all' && i.status !== stockFilter) return false;
            if (categoryFilter !== 'all' && i.category_id !== categoryFilter) return false;
            return true;
        });
    }, [enrichedItems, stockFilter, categoryFilter]);

    const kpis = useMemo(() => {
        const totalValue = enrichedItems.reduce((sum, i) => sum + i.value, 0);
        const low = enrichedItems.filter((i) => i.status === 'low').length;
        const out = enrichedItems.filter((i) => i.status === 'out').length;
        return { totalValue, count: enrichedItems.length, low, out };
    }, [enrichedItems]);

    const filteredMovements = useMemo(() => {
        return movements.filter((m) => {
            if (movementTypeFilter !== 'all' && m.movement_type !== movementTypeFilter) return false;
            if (movementProductFilter !== 'all' && m.item_id !== movementProductFilter) return false;
            if (movementFromDate && new Date(m.created_at) < new Date(`${movementFromDate}T00:00:00`)) return false;
            if (movementToDate && new Date(m.created_at) > new Date(`${movementToDate}T23:59:59`)) return false;
            return true;
        });
    }, [movements, movementTypeFilter, movementProductFilter, movementFromDate, movementToDate]);

    const itemNameById = useMemo(() => {
        const map: Record<string, string> = {};
        items.forEach((i) => {
            map[i.id] = i.name;
        });
        return map;
    }, [items]);

    const reportAValueRows = useMemo(() => {
        return enrichedItems.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            cost: i.cost,
            total: i.value,
        }));
    }, [enrichedItems]);

    const reportBTop10 = useMemo(() => {
        const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
        invoiceItems.forEach((row: any) => {
            const key = row.item_ref || row.name || 'unknown';
            if (!agg[key]) agg[key] = { name: row.name || key, qty: 0, revenue: 0 };
            agg[key].qty += Number(row.quantity ?? 0);
            agg[key].revenue += Number(row.line_total ?? 0);
        });
        return Object.values(agg)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);
    }, [invoiceItems]);

    const lastReceiptByItem = useMemo(() => {
        const map: Record<string, string> = {};
        movements.forEach((m) => {
            if (m.movement_type !== 'receipt') return;
            if (!map[m.item_id] || new Date(m.created_at) > new Date(map[m.item_id])) {
                map[m.item_id] = m.created_at;
            }
        });
        return map;
    }, [movements]);

    const reportCAlerts = useMemo(() => {
        return enrichedItems
            .filter((i) => i.status === 'low' || i.status === 'out')
            .map((i) => ({ ...i, lastReceipt: lastReceiptByItem[i.id] }));
    }, [enrichedItems, lastReceiptByItem]);

    const reportDSummary = useMemo(() => {
        let inbound = 0;
        let outbound = 0;
        movements.forEach((m) => {
            const q = Number(m.quantity ?? 0);
            if (m.movement_type === 'receipt') inbound += q;
            if (m.movement_type === 'issue' || m.movement_type === 'waste') outbound += q;
        });
        return { inbound, outbound };
    }, [movements]);

    const warehousesView = useMemo(() => {
        return warehouses.map((w) => {
            const rows = stockLevels.filter((s) => s.warehouse_id === w.id);
            const itemCount = rows.length;
            const totalValue = rows.reduce((sum, row) => {
                const item = enrichedItems.find((i) => i.id === row.item_id);
                return sum + Number(row.quantity ?? 0) * Number(item?.cost ?? 0);
            }, 0);
            return { ...w, itemCount, totalValue };
        });
    }, [warehouses, stockLevels, enrichedItems]);

    const openWarehouseCreate = () => {
        setEditingWarehouseId(null);
        setWarehouseError('');
        setWarehouseForm({ name: '', name_ar: '', type: 'branch' });
        setShowWarehouseModal(true);
    };

    const openWarehouseEdit = (w: WarehouseRow) => {
        setEditingWarehouseId(w.id);
        setWarehouseError('');
        setWarehouseForm({
            name: String(w.name ?? ''),
            name_ar: String(w.name_ar ?? ''),
            type: String(w.type ?? 'branch'),
        });
        setShowWarehouseModal(true);
    };

    const saveWarehouse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        if (!warehouseForm.name.trim()) return setWarehouseError('الاسم مطلوب');
        setSavingWarehouse(true);
        setWarehouseError('');
        try {
            const payload = {
                tenant_id: user.tenant_id,
                branch_id: user.branch_id ?? null,
                name: warehouseForm.name.trim(),
                name_ar: warehouseForm.name_ar.trim() || null,
                type: warehouseForm.type,
                is_active: true,
            };
            if (editingWarehouseId) {
                const { error: updErr } = await supabase
                    .from('warehouses')
                    .update(payload)
                    .eq('id', editingWarehouseId)
                    .eq('tenant_id', user.tenant_id);
                if (updErr) throw updErr;
            } else {
                const { error: insErr } = await supabase.from('warehouses').insert(payload);
                if (insErr) throw insErr;
            }
            setShowWarehouseModal(false);
            await loadAll();
        } catch (err: any) {
            setWarehouseError(err?.message ?? 'فشل حفظ المستودع');
        } finally {
            setSavingWarehouse(false);
        }
    };

    const saveStockTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id || !user?.id) return;
        setTransferError('');
        const qty = Number(transferForm.quantity);
        if (!transferForm.item_id || !transferForm.from_warehouse_id || !transferForm.to_warehouse_id) {
            setTransferError('اختر المنتج والمستودعين');
            return;
        }
        if (transferForm.from_warehouse_id === transferForm.to_warehouse_id) {
            setTransferError('المستودع المصدر والوجهة يجب أن يختلفا');
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            setTransferError('الكمية غير صحيحة');
            return;
        }
        const sl = stockLevels.find(
            (s) => s.item_id === transferForm.item_id && s.warehouse_id === transferForm.from_warehouse_id
        );
        const available = Number(sl?.quantity ?? 0);
        if (qty > available) {
            setTransferError(`الكمية المتاحة في المستودع المصدر: ${available}`);
            return;
        }
        const item = items.find((i) => i.id === transferForm.item_id);
        const uc = Number(item?.cost_price ?? 0);
        const refId = crypto.randomUUID();
        const totalCost = Math.abs(qty * uc);
        setTransferSaving(true);
        try {
            const base = {
                tenant_id: user.tenant_id,
                item_id: transferForm.item_id,
                unit_cost: uc,
                total_cost: totalCost,
                created_by: user.id,
                reference_type: 'stock_transfer',
                reference_id: refId,
                notes: 'تحويل مخزون بين المستودعات',
            };
            const { error: e1 } = await supabase.from('inventory_movements').insert({
                ...base,
                warehouse_id: transferForm.from_warehouse_id,
                movement_type: 'transfer_out',
                quantity: -qty,
            });
            if (e1) throw e1;
            const { error: e2 } = await supabase.from('inventory_movements').insert({
                ...base,
                warehouse_id: transferForm.to_warehouse_id,
                movement_type: 'transfer_in',
                quantity: qty,
            });
            if (e2) throw e2;
            setShowTransferModal(false);
            setTransferForm({ item_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: '' });
            await loadAll();
        } catch (err: any) {
            setTransferError(err?.message ?? 'فشل التحويل');
        } finally {
            setTransferSaving(false);
        }
    };

    const deactivateWarehouse = async (id: string) => {
        if (!user?.tenant_id) return;
        if (!window.confirm('هل تريد تعطيل هذا المستودع؟')) return;
        try {
            const { error: updErr } = await supabase
                .from('warehouses')
                .update({ is_active: false })
                .eq('id', id)
                .eq('tenant_id', user.tenant_id);
            if (updErr) throw updErr;
            await loadAll();
        } catch (err: any) {
            setError(err?.message ?? 'فشل تعطيل المستودع');
        }
    };

    const alertsView = useMemo(() => {
        return enrichedItems.filter((i) => {
            const min = Number(i.reorder_point ?? 0);
            if (min <= 0) return false;
            return i.qty <= min;
        });
    }, [enrichedItems]);

    const openCreateProduct = () => {
        setEditingItemId(null);
        setProductError('');
        setProductForm({
            name: '',
            name_ar: '',
            sku: '',
            barcode: '',
            category_id: '',
            selling_price: '',
            cost_price: '',
            reorder_point: '',
            reorder_qty: '',
        });
        setShowProductModal(true);
    };

    const openEditProduct = (item: any) => {
        setEditingItemId(item.id);
        setProductError('');
        setProductForm({
            name: String(item.name ?? ''),
            name_ar: String(item.name_ar ?? ''),
            sku: String(item.sku ?? ''),
            barcode: String(item.barcode ?? ''),
            category_id: String(item.category_id ?? ''),
            selling_price: String(item.selling_price ?? ''),
            cost_price: String(item.cost_price ?? ''),
            reorder_point: String(item.reorder_point ?? 0),
            reorder_qty: String(item.reorder_qty ?? 0),
        });
        setShowProductModal(true);
    };

    const upsertStockLevel = async (itemId: string, warehouseId: string | null, qty: number) => {
        if (!user?.tenant_id) return;
        const targetWarehouse = warehouseId || warehouses[0]?.id || null;
        if (!targetWarehouse) return;
        const { data, error } = await supabase
            .from('stock_levels')
            .select('id,quantity')
            .eq('tenant_id', user.tenant_id)
            .eq('item_id', itemId)
            .eq('warehouse_id', targetWarehouse)
            .limit(1);
        if (error) throw error;
        const current = (data ?? [])[0];
        if (current) {
            const nextQty = Number(current.quantity ?? 0) + qty;
            const { error: updErr } = await supabase
                .from('stock_levels')
                .update({ quantity: Math.max(0, nextQty) })
                .eq('id', current.id);
            if (updErr) throw updErr;
        } else {
            const { error: insErr } = await supabase.from('stock_levels').insert({
                tenant_id: user.tenant_id,
                item_id: itemId,
                warehouse_id: targetWarehouse,
                quantity: Math.max(0, qty),
            });
            if (insErr) throw insErr;
        }
    };

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        const sell = Number(productForm.selling_price);
        const cost = Number(productForm.cost_price || 0);
        const reorderPoint = Number(productForm.reorder_point || 0);
        const reorderQty = Number(productForm.reorder_qty || 0);
        if (!productForm.name.trim()) return setProductError('اسم المنتج مطلوب');
        if (!productForm.sku.trim()) return setProductError('SKU مطلوب');
        if (Number.isNaN(sell) || sell < 0) return setProductError('سعر البيع غير صحيح');
        if (Number.isNaN(cost) || cost < 0) return setProductError('سعر التكلفة غير صحيح');
        if (Number.isNaN(reorderPoint) || reorderPoint < 0) return setProductError('حد إعادة الطلب غير صحيح');
        if (Number.isNaN(reorderQty) || reorderQty < 0) return setProductError('كمية إعادة الطلب غير صحيحة');

        setSavingProduct(true);
        setProductError('');
        try {
            const payload = {
                tenant_id: user.tenant_id,
                name: productForm.name.trim(),
                name_ar: productForm.name_ar.trim() || null,
                sku: productForm.sku.trim(),
                barcode: productForm.barcode.trim() || null,
                category_id: productForm.category_id.trim() || null,
                selling_price: sell,
                cost_price: cost,
                reorder_point: reorderPoint,
                reorder_qty: reorderQty,
            };
            let itemId = editingItemId;
            if (editingItemId) {
                const { error: updErr } = await supabase.from('items').update(payload).eq('id', editingItemId).eq('tenant_id', user.tenant_id);
                if (updErr) throw updErr;
            } else {
                const { data, error: insErr } = await supabase.from('items').insert(payload).select('id').single();
                if (insErr) throw insErr;
                itemId = data?.id as string;
            }
            setShowProductModal(false);
            await loadAll();
        } catch (err: any) {
            setProductError(err?.message ?? 'فشل حفظ المنتج');
        } finally {
            setSavingProduct(false);
        }
    };

    const deleteProduct = async (itemId: string) => {
        if (!user?.tenant_id) return;
        if (!window.confirm('هل تريد حذف المنتج؟')) return;
        setLoading(true);
        setError('');
        try {
            const { error: delErr } = await supabase
                .from('items')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', itemId)
                .eq('tenant_id', user.tenant_id);
            if (delErr) throw delErr;
            await loadAll();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حذف المنتج');
            setLoading(false);
        }
    };

    const openMovementModal = (preset?: Partial<typeof movementForm>) => {
        setMovementError('');
        setMovementForm({
            item_id: preset?.item_id ?? '',
            movement_type: (preset?.movement_type as MovementType) ?? 'receipt',
            quantity: preset?.quantity ?? '',
            unit_cost: preset?.unit_cost ?? '',
            warehouse_id: preset?.warehouse_id ?? '',
            reference_type: preset?.reference_type ?? '',
            reference_id: preset?.reference_id ?? '',
            batch_no: preset?.batch_no ?? '',
            expiry_date: preset?.expiry_date ?? '',
            notes: preset?.notes ?? '',
        });
        setShowMovementModal(true);
    };

    const saveMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id || !user?.id) return;
        const qty = Number(movementForm.quantity);
        const unitCost = Number(movementForm.unit_cost || 0);
        if (!movementForm.item_id) return setMovementError('اختر المنتج');
        if (Number.isNaN(qty) || qty <= 0) return setMovementError('الكمية يجب أن تكون أكبر من صفر');
        if (Number.isNaN(unitCost) || unitCost < 0) return setMovementError('تكلفة الوحدة غير صحيحة');
        setSavingMovement(true);
        setMovementError('');
        try {
            const payload = {
                tenant_id: user.tenant_id,
                item_id: movementForm.item_id,
                movement_type: movementForm.movement_type,
                quantity: qty,
                unit_cost: unitCost,
                total_cost: qty * unitCost,
                warehouse_id: movementForm.warehouse_id || null,
                batch_no: movementForm.batch_no || null,
                expiry_date: movementForm.expiry_date || null,
                reference_type: movementForm.reference_type || null,
                reference_id: movementForm.reference_id || null,
                notes: movementForm.notes || null,
                created_by: user.id,
            };
            const { error: movErr } = await supabase.from('inventory_movements').insert(payload);
            if (movErr) throw movErr;

            let delta = qty;
            if (movementForm.movement_type === 'issue' || movementForm.movement_type === 'waste') delta = -qty;
            if (movementForm.movement_type === 'transfer') delta = -qty;
            await upsertStockLevel(movementForm.item_id, movementForm.warehouse_id || null, delta);

            setShowMovementModal(false);
            await loadAll();
        } catch (err: any) {
            setMovementError(err?.message ?? 'فشل حفظ الحركة');
        } finally {
            setSavingMovement(false);
        }
    };

    const canApproveWriteoff = user?.role === 'owner' || user?.role === 'master_admin';

    const saveWriteoff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id || !user?.id) return;
        const qty = Number(writeoffForm.quantity);
        const uc = Number(writeoffForm.unit_cost);
        if (!writeoffForm.item_id) {
            setWriteoffError('اختر المنتج');
            return;
        }
        if (Number.isNaN(qty) || qty <= 0) {
            setWriteoffError('الكمية غير صحيحة');
            return;
        }
        if (Number.isNaN(uc) || uc < 0) {
            setWriteoffError('تكلفة الوحدة غير صحيحة');
            return;
        }
        const reasonLabel = WASTE_REASONS.find((r) => r.id === writeoffForm.reason)?.label ?? writeoffForm.reason;
        const autoApprove = canApproveWriteoff;
        setSavingWriteoff(true);
        setWriteoffError('');
        try {
            const { error: insErr } = await supabase.from('inventory_writeoffs').insert({
                tenant_id: user.tenant_id,
                item_id: writeoffForm.item_id,
                warehouse_id: writeoffForm.warehouse_id || null,
                quantity: qty,
                unit_cost: uc,
                reason: reasonLabel,
                reason_detail: writeoffForm.reason,
                notes: writeoffForm.notes || null,
                receipt_url: writeoffForm.receipt_url || null,
                status: autoApprove ? 'approved' : 'pending',
                approved_by: autoApprove ? user.id : null,
                approved_at: autoApprove ? new Date().toISOString() : null,
                created_by: user.id,
            });
            if (insErr) throw insErr;
            if (autoApprove) {
                await upsertStockLevel(writeoffForm.item_id, writeoffForm.warehouse_id || null, -qty);
            }
            setShowWriteoffModal(false);
            setWriteoffForm({
                item_id: '',
                warehouse_id: '',
                quantity: '',
                unit_cost: '',
                reason: 'damage',
                notes: '',
                receipt_url: '',
            });
            await loadWriteoffs();
            await loadAll();
        } catch (err: any) {
            setWriteoffError(err?.message ?? 'فشل التسجيل');
        } finally {
            setSavingWriteoff(false);
        }
    };

    const approveWriteoff = async (row: any) => {
        if (!user?.tenant_id || !user?.id || !canApproveWriteoff) return;
        if (row.status !== 'pending') return;
        setWriteoffError('');
        try {
            const { error: uErr } = await supabase
                .from('inventory_writeoffs')
                .update({
                    status: 'approved',
                    approved_by: user.id,
                    approved_at: new Date().toISOString(),
                })
                .eq('id', row.id)
                .eq('tenant_id', user.tenant_id);
            if (uErr) throw uErr;
            await upsertStockLevel(row.item_id, row.warehouse_id, -Number(row.quantity));
            await loadWriteoffs();
            await loadAll();
        } catch (err: any) {
            setWriteoffError(err?.message ?? 'فشلت الموافقة');
        }
    };

    const tabLoading = loading;
    const tabError = error;

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-[#F4F7FC] font-arabic text-[#071C3B]">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black">إدارة المخزون المتقدمة</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={openCreateProduct} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold inline-flex items-center gap-2">
                        <PlusCircle size={16} /> إضافة منتج
                    </button>
                    <button onClick={() => openMovementModal()} className="px-4 py-2 rounded-lg bg-[#00CFFF] text-[#071C3B] font-bold inline-flex items-center gap-2">
                        <ArrowRightLeft size={16} /> حركة جديدة
                    </button>
                </div>
            </div>

            <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-2 rounded-xl font-bold border text-sm ${activeTab === tab.key ? 'bg-[#071C3B] text-white border-[#071C3B]' : 'bg-white border-[#071C3B]/10 text-[#071C3B]/70'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {tabLoading && <div className="p-10 rounded-2xl bg-white text-center font-bold text-[#071C3B]/60">جاري التحميل...</div>}
            {!tabLoading && tabError && <div className="p-10 rounded-2xl bg-white text-center font-bold text-red-600">{tabError}</div>}

            {!tabLoading && !tabError && activeTab === 'products' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-white rounded-xl p-4 border border-[#071C3B]/10"><p className="text-xs text-[#071C3B]/60">إجمالي قيمة المخزون</p><p className="font-black text-lg text-[#00CFFF]">{money(kpis.totalValue)}</p></div>
                        <div className="bg-white rounded-xl p-4 border border-[#071C3B]/10"><p className="text-xs text-[#071C3B]/60">عدد الأصناف</p><p className="font-black text-lg">{num(kpis.count)}</p></div>
                        <div className="bg-white rounded-xl p-4 border border-[#071C3B]/10"><p className="text-xs text-[#071C3B]/60">أصناف منخفضة</p><p className="font-black text-lg text-amber-500">{num(kpis.low)}</p></div>
                        <div className="bg-white rounded-xl p-4 border border-[#071C3B]/10"><p className="text-xs text-[#071C3B]/60">أصناف نافدة</p><p className="font-black text-lg text-red-500">{num(kpis.out)}</p></div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10 mb-3">
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[
                                { id: 'all', label: 'الكل' },
                                { id: 'available', label: 'متاح' },
                                { id: 'low', label: 'منخفض' },
                                { id: 'out', label: 'نفد' },
                            ].map((f) => (
                                <button key={f.id} onClick={() => setStockFilter(f.id as StockFilter)} className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${stockFilter === f.id ? 'bg-[#071C3B] text-white border-[#071C3B]' : 'bg-white border-gray-200 text-[#071C3B]/70'}`}>{f.label}</button>
                            ))}
                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold">
                                <option value="all">حسب الفئة</option>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={warehouseProductsFilter} onChange={(e) => setWarehouseProductsFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold">
                                <option value="all">كل المستودعات</option>
                                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name_ar || w.name}</option>)}
                            </select>
                        </div>

                        {productsView.length === 0 ? (
                            <div className="p-8 text-center text-[#071C3B]/60 font-bold">لا توجد بيانات</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-[#071C3B]/60 uppercase text-xs">
                                        <tr>
                                            <th className="py-3 text-start">المنتج</th>
                                            <th className="py-3 text-start">الكمية</th>
                                            <th className="py-3 text-start">الحد الأدنى</th>
                                            <th className="py-3 text-start">التكلفة | البيع</th>
                                            <th className="py-3 text-start">قيمة المخزون</th>
                                            <th className="py-3 text-start">الحالة</th>
                                            <th className="py-3 text-start">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {productsView.map((p) => (
                                            <tr key={p.id}>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-[#071C3B]/10 flex items-center justify-center text-[#071C3B]/50"><ImageIcon size={16} /></div>
                                                        <div>
                                                            <p className="font-bold">{p.name_ar || p.name}</p>
                                                            <p className="text-xs text-[#071C3B]/50">{p.sku} • {p.category_id || ''}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 font-bold">{num(p.qty)}</td>
                                                <td className="py-3">{num(p.min)}</td>
                                                <td className="py-3">{money(Number(p.cost || 0))} | {money(Number(p.selling_price || 0))}</td>
                                                <td className="py-3 font-bold text-[#00CFFF]">{money(p.value)}</td>
                                                <td className="py-3">
                                                    {p.status === 'out' && <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700">🔴 نفد</span>}
                                                    {p.status === 'low' && <span className="px-2 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700">🟡 منخفض</span>}
                                                    {p.status === 'available' && <span className="px-2 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">🟢 متاح</span>}
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => openEditProduct(p)} className="p-2 rounded-lg bg-cyan-50 text-cyan-700"><Pencil size={14} /></button>
                                                        <button onClick={() => deleteProduct(p.id)} className="p-2 rounded-lg bg-red-50 text-red-700"><Trash2 size={14} /></button>
                                                        <button onClick={() => { setActiveTab('movements'); setMovementProductFilter(p.id); }} className="p-2 rounded-lg bg-[#071C3B]/10 text-[#071C3B]"><Eye size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!tabLoading && !tabError && activeTab === 'movements' && (
                <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                    <div className="flex flex-wrap gap-2 mb-3">
                        <select value={movementTypeFilter} onChange={(e) => setMovementTypeFilter(e.target.value as any)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                            <option value="all">كل الأنواع</option>
                            <option value="receipt">📥 استلام</option>
                            <option value="issue">📤 صرف</option>
                            <option value="transfer">🔁 تحويل</option>
                            <option value="adjustment">✏️ تعديل جرد</option>
                            <option value="waste">🗑️ هالك/تالف</option>
                        </select>
                        <select value={movementProductFilter} onChange={(e) => setMovementProductFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
                            <option value="all">كل المنتجات</option>
                            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input type="date" value={movementFromDate} onChange={(e) => setMovementFromDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                        <input type="date" value={movementToDate} onChange={(e) => setMovementToDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                        <button onClick={() => openMovementModal()} className="ms-auto px-3 py-2 rounded-lg bg-[#00CFFF] text-[#071C3B] font-bold text-sm">حركة جديدة</button>
                    </div>

                    {filteredMovements.length === 0 ? (
                        <div className="p-8 text-center text-[#071C3B]/60 font-bold">لا توجد حركات</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-[#071C3B]/60">
                                    <tr>
                                        <th className="py-3 text-start">التاريخ</th>
                                        <th className="py-3 text-start">المنتج</th>
                                        <th className="py-3 text-start">النوع</th>
                                        <th className="py-3 text-start">الكمية</th>
                                        <th className="py-3 text-start">المرجع</th>
                                        <th className="py-3 text-start">المستخدم</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredMovements.map((m) => (
                                        <tr key={m.id}>
                                            <td className="py-3">{new Date(m.created_at).toLocaleString('ar-AE')}</td>
                                            <td className="py-3 font-bold">{itemNameById[m.item_id] || m.item_id}</td>
                                            <td className="py-3">{movementTypeLabel[m.movement_type]}</td>
                                            <td className="py-3">{num(Number(m.quantity))}</td>
                                            <td className="py-3">
                                                {m.reference_type
                                                    ? (m.reference_id ? `${m.reference_type} / ${m.reference_id}` : m.reference_type)
                                                    : '—'}
                                            </td>
                                            <td className="py-3">{m.created_by || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!tabLoading && !tabError && activeTab === 'reports' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                        <h3 className="font-black mb-3">أ) تقرير قيمة المخزون</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-[#071C3B]/60"><tr><th className="py-2 text-start">المنتج</th><th className="py-2 text-start">الكمية</th><th className="py-2 text-start">التكلفة</th><th className="py-2 text-start">الإجمالي</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportAValueRows.map((r) => <tr key={r.id}><td className="py-2">{r.name}</td><td className="py-2">{num(r.qty)}</td><td className="py-2">{money(r.cost)}</td><td className="py-2 font-bold">{money(r.total)}</td></tr>)}
                                </tbody>
                                <tfoot><tr><td colSpan={3} className="py-3 font-black">الإجمالي الكلي</td><td className="py-3 font-black text-[#00CFFF]">{money(reportAValueRows.reduce((s, r) => s + r.total, 0))}</td></tr></tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                        <h3 className="font-black mb-3">ب) أكثر المنتجات حركة (TOP 10)</h3>
                        {reportBTop10.length === 0 ? <div className="text-sm text-[#071C3B]/60">لا توجد بيانات</div> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs uppercase text-[#071C3B]/60"><tr><th className="py-2 text-start">المنتج</th><th className="py-2 text-start">الكمية المباعة</th><th className="py-2 text-start">الإيراد</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">{reportBTop10.map((r, idx) => <tr key={`${r.name}-${idx}`}><td className="py-2">{r.name}</td><td className="py-2">{num(r.qty)}</td><td className="py-2">{money(r.revenue)}</td></tr>)}</tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                        <h3 className="font-black mb-3">ج) تقرير النفاد والتنبيهات</h3>
                        {reportCAlerts.length === 0 ? <div className="text-sm text-[#071C3B]/60">لا توجد تنبيهات</div> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs uppercase text-[#071C3B]/60"><tr><th className="py-2 text-start">المنتج</th><th className="py-2 text-start">الحالة</th><th className="py-2 text-start">آخر استلام</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">{reportCAlerts.map((r) => <tr key={r.id}><td className="py-2">{r.name}</td><td className="py-2">{r.status === 'out' ? '🔴 نافد' : '🟡 منخفض'}</td><td className="py-2">{r.lastReceipt ? new Date(r.lastReceipt).toLocaleDateString('ar-AE') : '—'}</td></tr>)}</tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                        <h3 className="font-black mb-3">د) حركات المخزون (ملخص)</h3>
                        <div className="flex gap-4">
                            <div className="px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-bold">إجمالي الوارد: {num(reportDSummary.inbound)}</div>
                            <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 font-bold">إجمالي الصادر: {num(reportDSummary.outbound)}</div>
                        </div>
                    </div>
                </div>
            )}

            {!tabLoading && !tabError && activeTab === 'warehouses' && (
                <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                    <div className="mb-3 flex justify-end">
                        <button onClick={openWarehouseCreate} className="px-3 py-2 rounded-lg bg-[#071C3B] text-white font-bold text-sm">➕ إضافة مستودع</button>
                    </div>
                    {warehousesView.length === 0 ? <div className="p-8 text-center text-[#071C3B]/60 font-bold">لا توجد مستودعات</div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {warehousesView.map((w) => (
                                <div key={w.id} className="p-4 rounded-xl border border-[#071C3B]/10 bg-[#F9FCFF]">
                                    <div className="flex items-center gap-2 font-black mb-2"><Warehouse size={16} /> {w.name_ar || w.name}</div>
                                    <p className="text-sm text-[#071C3B]/70">النوع: {w.type || '—'}</p>
                                    <p className="text-sm text-[#071C3B]/70">الفرع: {w.branch_id || '—'}</p>
                                    <p className="text-sm text-[#071C3B]/70">عدد الأصناف: {num(w.itemCount)}</p>
                                    <p className="text-sm text-[#071C3B]/70">إجمالي القيمة: {money(w.totalValue)}</p>
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => {
                                                setWarehouseProductsFilter(w.id);
                                                setActiveTab('products');
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-[#00CFFF] text-[#071C3B] text-xs font-bold"
                                        >
                                            عرض المخزون
                                        </button>
                                        <button onClick={() => openWarehouseEdit(w)} className="px-3 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 text-xs font-bold">تعديل</button>
                                        <button onClick={() => deactivateWarehouse(w.id)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold">حذف</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!tabLoading && !tabError && activeTab === 'alerts' && (
                <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10">
                    {stockLevels.length === 0 ? (
                        <div className="p-8 text-center text-[#071C3B]/70 font-bold">لم يتم تسجيل مستويات المخزون</div>
                    ) : alertsView.length === 0 ? (
                        <div className="p-8 text-center text-[#071C3B]/60 font-bold">لا توجد أصناف تحت الحد الأدنى</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-[#071C3B]/60">
                                    <tr>
                                        <th className="py-3 text-start">المنتج</th>
                                        <th className="py-3 text-start">الكمية</th>
                                        <th className="py-3 text-start">نقطة إعادة الطلب</th>
                                        <th className="py-3 text-start">التنبيه</th>
                                        <th className="py-3 text-start">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {alertsView.map((row) => (
                                        <tr key={row.id}>
                                            <td className="py-3 font-bold">{row.name}</td>
                                            <td className="py-3">{num(row.qty)}</td>
                                            <td className="py-3">{num(row.min)}</td>
                                            <td className="py-3">{row.status === 'out' ? '🔴 نافد' : '🟡 منخفض'}</td>
                                            <td className="py-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openMovementModal({ item_id: row.id, movement_type: 'receipt' })}
                                                    className="px-3 py-1.5 rounded-lg bg-[#00CFFF] text-[#071C3B] font-bold text-xs"
                                                >
                                                    إعادة تخزين
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/procurement')}
                                                    className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white font-bold text-xs"
                                                >
                                                    إنشاء طلب شراء
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!tabLoading && !tabError && activeTab === 'transfers' && (
                <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10 space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <p className="text-sm text-[#071C3B]/70 font-bold">تحويل المخزون بين المستودعات (يتم تسجيل حركتي transfer_out و transfer_in)</p>
                        <button
                            type="button"
                            onClick={() => {
                                setTransferError('');
                                setTransferForm({
                                    item_id: items[0]?.id || '',
                                    from_warehouse_id: warehouses[0]?.id || '',
                                    to_warehouse_id: warehouses[1]?.id || warehouses[0]?.id || '',
                                    quantity: '',
                                });
                                setShowTransferModal(true);
                            }}
                            className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold text-sm"
                        >
                            تحويل مخزون
                        </button>
                    </div>
                    <p className="text-xs text-[#071C3B]/50">
                        آخر التحويلات تظهر في تبويب «الحركات» بنوع transfer_in / transfer_out.
                    </p>
                </div>
            )}

            {!tabLoading && !tabError && activeTab === 'writeoffs' && (
                <div className="bg-white rounded-2xl p-4 border border-[#071C3B]/10 space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <h2 className="font-black text-lg">إتلاف وتسوية المخزون</h2>
                        <button
                            type="button"
                            onClick={() => {
                                setWriteoffError('');
                                setWriteoffForm({
                                    item_id: items[0]?.id || '',
                                    warehouse_id: warehouses[0]?.id || '',
                                    quantity: '',
                                    unit_cost: '',
                                    reason: 'damage',
                                    notes: '',
                                    receipt_url: '',
                                });
                                setShowWriteoffModal(true);
                            }}
                            className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold text-sm"
                        >
                            تسجيل إتلاف
                        </button>
                    </div>
                    {writeoffError && <p className="text-red-600 font-bold text-sm">{writeoffError}</p>}
                    {writeoffsLoading ? (
                        <div className="p-8 text-center font-bold text-[#071C3B]/60">جاري التحميل...</div>
                    ) : writeoffs.length === 0 ? (
                        <div className="p-10 flex flex-col items-center gap-2 text-[#071C3B]/50">
                            <Package className="w-12 h-12 opacity-40" strokeWidth={1.25} />
                            <span className="font-bold">لا توجد بيانات بعد</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[#071C3B]/60 text-xs">
                                        <th className="text-start py-2">المنتج</th>
                                        <th className="text-start">الكمية</th>
                                        <th className="text-start">السبب</th>
                                        <th className="text-start">التكلفة</th>
                                        <th className="text-start">الحالة</th>
                                        {canApproveWriteoff ? <th className="text-start">إجراء</th> : null}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {writeoffs.map((w) => {
                                        const name = items.find((i) => i.id === w.item_id)?.name ?? w.item_id;
                                        const lineCost = Number(w.quantity ?? 0) * Number(w.unit_cost ?? 0);
                                        return (
                                            <tr key={w.id}>
                                                <td className="py-2 font-bold">{name}</td>
                                                <td>{num(Number(w.quantity))}</td>
                                                <td>{w.reason}</td>
                                                <td>{money(lineCost)}</td>
                                                <td>
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                            w.status === 'approved'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : w.status === 'pending'
                                                                  ? 'bg-amber-100 text-amber-800'
                                                                  : 'bg-gray-100'
                                                        }`}
                                                    >
                                                        {w.status === 'approved' ? 'معتمد' : w.status === 'pending' ? 'معلق' : String(w.status)}
                                                    </span>
                                                </td>
                                                {canApproveWriteoff ? (
                                                    <td>
                                                        {w.status === 'pending' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => approveWriteoff(w)}
                                                                className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold"
                                                            >
                                                                موافقة
                                                            </button>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                ) : null}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {showWriteoffModal && (
                <div className="fixed inset-0 bg-[#071C3B]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={saveWriteoff} className="w-full max-w-lg bg-white rounded-2xl p-6 border border-[#071C3B]/10 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-black mb-4">تسجيل إتلاف</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <select
                                value={writeoffForm.item_id}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, item_id: e.target.value })}
                                className="px-3 py-2 rounded-lg border border-gray-200"
                            >
                                <option value="">اختر المنتج</option>
                                {items.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        {i.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={writeoffForm.warehouse_id}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, warehouse_id: e.target.value })}
                                className="px-3 py-2 rounded-lg border border-gray-200"
                            >
                                <option value="">المستودع</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name_ar || w.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min={0}
                                step="0.0001"
                                className="px-3 py-2 rounded-lg border border-gray-200"
                                placeholder="الكمية"
                                value={writeoffForm.quantity}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, quantity: e.target.value })}
                            />
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="px-3 py-2 rounded-lg border border-gray-200"
                                placeholder="تكلفة الوحدة"
                                value={writeoffForm.unit_cost}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, unit_cost: e.target.value })}
                            />
                            <select
                                value={writeoffForm.reason}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, reason: e.target.value })}
                                className="px-3 py-2 rounded-lg border border-gray-200"
                            >
                                {WASTE_REASONS.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                            <textarea
                                className="px-3 py-2 rounded-lg border border-gray-200"
                                placeholder="ملاحظات"
                                rows={2}
                                value={writeoffForm.notes}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, notes: e.target.value })}
                            />
                            <input
                                className="px-3 py-2 rounded-lg border border-gray-200"
                                placeholder="رابط إيصال / مستند"
                                value={writeoffForm.receipt_url}
                                onChange={(e) => setWriteoffForm({ ...writeoffForm, receipt_url: e.target.value })}
                            />
                        </div>
                        {writeoffError && <p className="mt-2 text-sm font-bold text-red-600">{writeoffError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowWriteoffModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 font-bold">
                                إلغاء
                            </button>
                            <button type="submit" disabled={savingWriteoff} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold disabled:opacity-50">
                                {savingWriteoff ? 'جارٍ الحفظ...' : 'حفظ'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showProductModal && (
                <div className="fixed inset-0 bg-[#071C3B]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={saveProduct} className="w-full max-w-2xl bg-white rounded-2xl p-6 border border-[#071C3B]/10">
                        <h3 className="text-lg font-black mb-4">{editingItemId ? 'تعديل منتج' : 'إضافة منتج'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="اسم المنتج *" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="الاسم العربي" value={productForm.name_ar} onChange={(e) => setProductForm({ ...productForm, name_ar: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="SKU *" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="الباركود" value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="معرّف الفئة" value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })} />
                            <input type="number" min={0} step="0.01" className="px-3 py-2 rounded-lg border border-gray-200" placeholder="سعر البيع *" value={productForm.selling_price} onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })} />
                            <input type="number" min={0} step="0.01" className="px-3 py-2 rounded-lg border border-gray-200" placeholder="سعر التكلفة" value={productForm.cost_price} onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })} />
                            <input type="number" min={0} className="px-3 py-2 rounded-lg border border-gray-200" placeholder="نقطة إعادة الطلب (reorder_point)" value={productForm.reorder_point} onChange={(e) => setProductForm({ ...productForm, reorder_point: e.target.value })} />
                            <input type="number" min={0} className="px-3 py-2 rounded-lg border border-gray-200" placeholder="كمية إعادة الطلب (reorder_qty)" value={productForm.reorder_qty} onChange={(e) => setProductForm({ ...productForm, reorder_qty: e.target.value })} />
                        </div>
                        {productError && <p className="mt-3 text-sm font-bold text-red-600">{productError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 font-bold">إلغاء</button>
                            <button type="submit" disabled={savingProduct} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold disabled:opacity-50">{savingProduct ? 'جارٍ الحفظ...' : 'حفظ'}</button>
                        </div>
                    </form>
                </div>
            )}

            {showMovementModal && (
                <div className="fixed inset-0 bg-[#071C3B]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={saveMovement} className="w-full max-w-xl bg-white rounded-2xl p-6 border border-[#071C3B]/10">
                        <h3 className="text-lg font-black mb-4">حركة جديدة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <select value={movementForm.item_id} onChange={(e) => setMovementForm({ ...movementForm, item_id: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
                                <option value="">اختر المنتج</option>
                                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                            <select value={movementForm.movement_type} onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value as MovementType })} className="px-3 py-2 rounded-lg border border-gray-200">
                                <option value="receipt">📥 استلام</option>
                                <option value="issue">📤 صرف</option>
                                <option value="transfer">🔁 تحويل</option>
                                <option value="adjustment">✏️ تعديل جرد</option>
                                <option value="waste">🗑️ هالك/تالف</option>
                            </select>
                            <input type="number" min={1} className="px-3 py-2 rounded-lg border border-gray-200" placeholder="الكمية" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} />
                            <input type="number" min={0} step="0.01" className="px-3 py-2 rounded-lg border border-gray-200" placeholder="تكلفة الوحدة" value={movementForm.unit_cost} onChange={(e) => setMovementForm({ ...movementForm, unit_cost: e.target.value })} />
                            <select value={movementForm.warehouse_id} onChange={(e) => setMovementForm({ ...movementForm, warehouse_id: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200">
                                <option value="">اختر المستودع</option>
                                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="نوع المرجع (اختياري)" value={movementForm.reference_type} onChange={(e) => setMovementForm({ ...movementForm, reference_type: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="رقم المرجع (اختياري)" value={movementForm.reference_id} onChange={(e) => setMovementForm({ ...movementForm, reference_id: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="رقم الدفعة (اختياري)" value={movementForm.batch_no} onChange={(e) => setMovementForm({ ...movementForm, batch_no: e.target.value })} />
                            <input type="date" className="px-3 py-2 rounded-lg border border-gray-200" placeholder="تاريخ الانتهاء (اختياري)" value={movementForm.expiry_date} onChange={(e) => setMovementForm({ ...movementForm, expiry_date: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200 md:col-span-2" placeholder="ملاحظة (اختياري)" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} />
                        </div>
                        {movementError && <p className="mt-3 text-sm font-bold text-red-600">{movementError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowMovementModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 font-bold">إلغاء</button>
                            <button type="submit" disabled={savingMovement} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold disabled:opacity-50">{savingMovement ? 'جارٍ الحفظ...' : 'حفظ الحركة'}</button>
                        </div>
                    </form>
                </div>
            )}

            {showTransferModal && (
                <div className="fixed inset-0 bg-[#071C3B]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={saveStockTransfer} className="w-full max-w-lg bg-white rounded-2xl p-6 border border-[#071C3B]/10">
                        <h3 className="text-lg font-black mb-4">تحويل مخزون</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <label className="text-xs font-bold text-[#071C3B]/60">المنتج</label>
                            <select
                                value={transferForm.item_id}
                                onChange={(e) => setTransferForm({ ...transferForm, item_id: e.target.value })}
                                className="px-3 py-2 rounded-lg border border-gray-200"
                            >
                                <option value="">— اختر —</option>
                                {items.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        {i.name}
                                    </option>
                                ))}
                            </select>
                            <label className="text-xs font-bold text-[#071C3B]/60">من مستودع</label>
                            <select
                                value={transferForm.from_warehouse_id}
                                onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
                                className="px-3 py-2 rounded-lg border border-gray-200"
                            >
                                <option value="">— اختر —</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name_ar || w.name}
                                    </option>
                                ))}
                            </select>
                            <label className="text-xs font-bold text-[#071C3B]/60">إلى مستودع</label>
                            <select
                                value={transferForm.to_warehouse_id}
                                onChange={(e) => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })}
                                className="px-3 py-2 rounded-lg border border-gray-200"
                            >
                                <option value="">— اختر —</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name_ar || w.name}
                                    </option>
                                ))}
                            </select>
                            <label className="text-xs font-bold text-[#071C3B]/60">الكمية</label>
                            <input
                                type="number"
                                min={0.0001}
                                step="any"
                                className="px-3 py-2 rounded-lg border border-gray-200"
                                placeholder="الكمية"
                                value={transferForm.quantity}
                                onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                            />
                        </div>
                        {transferError && <p className="mt-3 text-sm font-bold text-red-600">{transferError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowTransferModal(false)}
                                className="px-4 py-2 rounded-lg border border-gray-200 font-bold"
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                disabled={transferSaving}
                                className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold disabled:opacity-50"
                            >
                                {transferSaving ? 'جارٍ الحفظ...' : 'تأكيد التحويل'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showWarehouseModal && (
                <div className="fixed inset-0 bg-[#071C3B]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={saveWarehouse} className="w-full max-w-xl bg-white rounded-2xl p-6 border border-[#071C3B]/10">
                        <h3 className="text-lg font-black mb-4">{editingWarehouseId ? 'تعديل مستودع' : 'إضافة مستودع'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="الاسم *" value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} />
                            <input className="px-3 py-2 rounded-lg border border-gray-200" placeholder="الاسم بالعربي" value={warehouseForm.name_ar} onChange={(e) => setWarehouseForm({ ...warehouseForm, name_ar: e.target.value })} />
                            <select className="px-3 py-2 rounded-lg border border-gray-200 md:col-span-2" value={warehouseForm.type} onChange={(e) => setWarehouseForm({ ...warehouseForm, type: e.target.value })}>
                                <option value="main">main</option>
                                <option value="branch">branch</option>
                                <option value="cold_storage">cold_storage</option>
                                <option value="transit">transit</option>
                            </select>
                        </div>
                        {warehouseError && <p className="mt-3 text-sm font-bold text-red-600">{warehouseError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowWarehouseModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 font-bold">إلغاء</button>
                            <button type="submit" disabled={savingWarehouse} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold disabled:opacity-50">{savingWarehouse ? 'جارٍ الحفظ...' : 'حفظ'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
