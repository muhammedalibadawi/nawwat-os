import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ReportsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [salesByMonth, setSalesByMonth] = useState<{ month: string; total: number }[]>([]);
    const [topProducts, setTopProducts] = useState<{ item_ref: string; qty: number }[]>([]);
    const [contactsByType, setContactsByType] = useState<{ type: string; count: number }[]>([]);
    const [lowStockItems, setLowStockItems] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            if (!user?.tenant_id) return;
            setLoading(true);
            setError('');
            try {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const [invRes, itemsRes, contactsRes] = await Promise.all([
                    supabase
                        .from('invoices')
                        .select('id,total,created_at')
                        .eq('tenant_id', user.tenant_id)
                        .gte('created_at', sixMonthsAgo.toISOString()),
                    supabase
                        .from('invoice_items')
                        .select('item_ref,name,quantity')
                        .eq('tenant_id', user.tenant_id),
                    supabase
                        .from('contacts')
                        .select('id,type')
                        .eq('tenant_id', user.tenant_id),
                ]);
                if (invRes.error) throw invRes.error;
                if (itemsRes.error) throw itemsRes.error;
                if (contactsRes.error) throw contactsRes.error;

                const monthAgg: Record<string, number> = {};
                (invRes.data ?? []).forEach((i: any) => {
                    const key = new Date(i.created_at).toLocaleDateString('ar-AE', { month: 'short', year: 'numeric' });
                    monthAgg[key] = (monthAgg[key] ?? 0) + Number(i.total ?? 0);
                });
                setSalesByMonth(Object.entries(monthAgg).map(([month, total]) => ({ month, total })));

                const topAgg: Record<string, number> = {};
                (itemsRes.data ?? []).forEach((r: any) => {
                    const key = r.item_ref || r.name || 'unknown';
                    topAgg[key] = (topAgg[key] ?? 0) + Number(r.quantity ?? 0);
                });
                setTopProducts(Object.entries(topAgg).map(([item_ref, qty]) => ({ item_ref, qty })).sort((a, b) => b.qty - a.qty).slice(0, 10));

                const cAgg: Record<string, number> = {};
                (contactsRes.data ?? []).forEach((c: any) => {
                    const key = c.type || 'unknown';
                    cAgg[key] = (cAgg[key] ?? 0) + 1;
                });
                setContactsByType(Object.entries(cAgg).map(([type, count]) => ({ type, count })));

                const { data: itemRows, error: itemErr } = await supabase
                    .from('items')
                    .select('id,name,reorder_point')
                    .eq('tenant_id', user.tenant_id)
                    .eq('is_active', true)
                    .is('deleted_at', null);
                if (itemErr) throw itemErr;
                setLowStockItems(itemRows ?? []);
            } catch (err: any) {
                setError(err?.message ?? 'فشل تحميل التقارير');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.tenant_id]);

    const inventoryLow = useMemo(() => {
        return lowStockItems.filter((i) => Number(i.reorder_point ?? 0) > 0);
    }, [lowStockItems]);

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={28} className="text-cyan-500" />
                    Reports
                </h1>
            </div>
            {loading && <div className="bg-white border rounded-xl p-6 text-center">جاري التحميل...</div>}
            {!loading && error && <div className="bg-white border rounded-xl p-6 text-center text-red-600">{error}</div>}

            {!loading && !error && (
                <>
                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="font-black mb-3">أ) تقرير المبيعات (آخر 6 شهور)</h2>
                        <div className="space-y-2">
                            {salesByMonth.map((r) => <div key={r.month} className="flex justify-between text-sm"><span>{r.month}</span><span className="font-bold">AED {r.total.toLocaleString('ar-AE')}</span></div>)}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="font-black mb-3">ب) أكثر المنتجات مبيعاً</h2>
                        <div className="space-y-2">
                            {topProducts.map((r) => <div key={r.item_ref} className="flex justify-between text-sm"><span>{r.item_ref}</span><span className="font-bold">{r.qty.toLocaleString('ar-AE')}</span></div>)}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="font-black mb-3">ج) تقرير العملاء حسب النوع</h2>
                        <div className="space-y-2">
                            {contactsByType.map((r) => <div key={r.type} className="flex justify-between text-sm"><span>{r.type}</span><span className="font-bold">{r.count.toLocaleString('ar-AE')}</span></div>)}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="font-black mb-3">د) تقرير المخزون (reorder_point)</h2>
                        <div className="space-y-2">
                            {inventoryLow.map((r: any) => <div key={r.id} className="flex justify-between text-sm"><span>{r.name || r.id}</span><span className="font-bold">{Number(r.reorder_point || 0).toLocaleString('ar-AE')}</span></div>)}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
