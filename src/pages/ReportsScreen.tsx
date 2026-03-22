import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function exportExcel(rows: Record<string, unknown>[], fileName: string) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export default function ReportsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [salesByMonth, setSalesByMonth] = useState<{ month: string; total: number }[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
    const [contactsByType, setContactsByType] = useState<{ type: string; count: number }[]>([]);
    const [lowStockItems, setLowStockItems] = useState<any[]>([]);

    const [pl, setPl] = useState({ revenue: 0, expenses: 0, net: 0 });
    const [plMonthly, setPlMonthly] = useState<{ month: string; revenue: number; expenses: number; net: number }[]>([]);
    const [receivables, setReceivables] = useState<any[]>([]);
    const [inventoryVal, setInventoryVal] = useState<{ rows: any[]; total: number }>({ rows: [], total: 0 });

    const [plPreset, setPlPreset] = useState<'today' | 'month' | 'quarter' | 'year' | 'custom'>('month');
    const [plFrom, setPlFrom] = useState('');
    const [plTo, setPlTo] = useState('');
    const [plStmt, setPlStmt] = useState({ revenue: 0, cogs: 0, opex: 0, gross: 0, net: 0 });
    const [plStmtLoading, setPlStmtLoading] = useState(false);

    useEffect(() => {
        const run = async () => {
            if (!user?.tenant_id) return;
            setPlStmtLoading(true);
            try {
                const now = new Date();
                let start: Date;
                let end = new Date();
                end.setHours(23, 59, 59, 999);
                if (plPreset === 'today') {
                    start = new Date(now);
                    start.setHours(0, 0, 0, 0);
                } else if (plPreset === 'month') {
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                } else if (plPreset === 'quarter') {
                    const m = Math.floor(now.getMonth() / 3) * 3;
                    start = new Date(now.getFullYear(), m, 1);
                } else if (plPreset === 'year') {
                    start = new Date(now.getFullYear(), 0, 1);
                } else {
                    start = plFrom ? new Date(plFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
                    start.setHours(0, 0, 0, 0);
                    end = plTo ? new Date(plTo) : now;
                    end.setHours(23, 59, 59, 999);
                }
                const startIso = start.toISOString();
                const endIso = end.toISOString();
                const startDateStr = start.toISOString().slice(0, 10);
                const endDateStr = end.toISOString().slice(0, 10);

                const [invRes, expRes, movRes] = await Promise.all([
                    supabase
                        .from('invoices')
                        .select('total')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .eq('invoice_type', 'sale')
                        .gte('created_at', startIso)
                        .lte('created_at', endIso),
                    supabase
                        .from('expenses')
                        .select('amount')
                        .eq('tenant_id', user.tenant_id)
                        .gte('expense_date', startDateStr)
                        .lte('expense_date', endDateStr),
                    supabase
                        .from('inventory_movements')
                        .select('quantity, unit_cost, total_cost')
                        .eq('tenant_id', user.tenant_id)
                        .eq('movement_type', 'sale')
                        .gte('created_at', startIso)
                        .lte('created_at', endIso),
                ]);
                if (invRes.error) throw invRes.error;
                if (expRes.error) throw expRes.error;
                if (movRes.error) throw movRes.error;

                const revenue = (invRes.data ?? []).reduce((s, r: any) => s + Number(r.total ?? 0), 0);
                const opex = (expRes.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
                const cogs = (movRes.data ?? []).reduce((s, r: any) => {
                    const tc = Number((r as any).total_cost ?? 0);
                    if (tc) return s + Math.abs(tc);
                    const q = Math.abs(Number(r.quantity ?? 0));
                    const c = Number(r.unit_cost ?? 0);
                    return s + q * c;
                }, 0);
                const gross = revenue - cogs;
                const net = gross - opex;
                setPlStmt({ revenue, cogs, opex, gross, net });
            } catch (err) {
                console.error(err);
                setPlStmt({ revenue: 0, cogs: 0, opex: 0, gross: 0, net: 0 });
            } finally {
                setPlStmtLoading(false);
            }
        };
        void run();
    }, [user?.tenant_id, plPreset, plFrom, plTo]);

    useEffect(() => {
        const load = async () => {
            if (!user?.tenant_id) return;
            setLoading(true);
            setError('');
            try {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const [invRes, itemsRes, contactsRes, expRes, invPaid, stockRes] = await Promise.all([
                    supabase
                        .from('invoices')
                        .select('id,total,created_at,status,issue_date')
                        .eq('tenant_id', user.tenant_id)
                        .gte('created_at', sixMonthsAgo.toISOString()),
                    supabase
                        .from('invoice_items')
                        .select('name, item_ref, quantity, unit_price, line_total, net_amount, tax_amount')
                        .eq('tenant_id', user.tenant_id),
                    supabase
                        .from('contacts')
                        .select('id,type')
                        .eq('tenant_id', user.tenant_id),
                    supabase
                        .from('expenses')
                        .select('amount, expense_date, category')
                        .eq('tenant_id', user.tenant_id),
                    supabase
                        .from('invoices')
                        .select('total, status, created_at, issue_date, invoice_type')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .eq('invoice_type', 'sale'),
                    supabase
                        .from('stock_levels')
                        .select('item_id, quantity')
                        .eq('tenant_id', user.tenant_id),
                ]);
                if (invRes.error) throw invRes.error;
                if (itemsRes.error) throw itemsRes.error;
                if (contactsRes.error) throw contactsRes.error;
                if (expRes.error) throw expRes.error;
                if (invPaid.error) throw invPaid.error;
                if (stockRes.error) throw stockRes.error;

                const monthAgg: Record<string, number> = {};
                (invRes.data ?? []).forEach((i: any) => {
                    const key = new Date(i.created_at).toLocaleDateString('ar-AE', { month: 'short', year: 'numeric' });
                    monthAgg[key] = (monthAgg[key] ?? 0) + Number(i.total ?? 0);
                });
                setSalesByMonth(Object.entries(monthAgg).map(([month, total]) => ({ month, total })));

                const topAgg: Record<string, number> = {};
                (itemsRes.data ?? []).forEach((r: any) => {
                    const key = r.name || r.item_ref || 'unknown';
                    topAgg[key] = (topAgg[key] ?? 0) + Number(r.quantity ?? 0);
                });
                setTopProducts(
                    Object.entries(topAgg)
                        .map(([name, qty]) => ({ name, qty }))
                        .sort((a, b) => b.qty - a.qty)
                        .slice(0, 10)
                );

                const cAgg: Record<string, number> = {};
                (contactsRes.data ?? []).forEach((c: any) => {
                    const key = c.type || 'unknown';
                    cAgg[key] = (cAgg[key] ?? 0) + 1;
                });
                setContactsByType(Object.entries(cAgg).map(([type, count]) => ({ type, count })));

                const { data: itemRows, error: itemErr } = await supabase
                    .from('items')
                    .select('id,name,reorder_point,cost_price')
                    .eq('tenant_id', user.tenant_id)
                    .eq('is_active', true)
                    .is('deleted_at', null);
                if (itemErr) throw itemErr;
                setLowStockItems(itemRows ?? []);

                const revenue = (invPaid.data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
                const expenseTotal = (expRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
                setPl({ revenue, expenses: expenseTotal, net: revenue - expenseTotal });

                const monthKey = (d: Date) => d.toLocaleDateString('ar-AE', { month: 'short', year: 'numeric' });
                const pm: Record<string, { revenue: number; expenses: number }> = {};
                (invPaid.data ?? []).forEach((r: any) => {
                    const raw = r.issue_date || r.created_at;
                    const key = raw ? monthKey(new Date(raw)) : '—';
                    if (!pm[key]) pm[key] = { revenue: 0, expenses: 0 };
                    pm[key].revenue += Number(r.total ?? 0);
                });
                (expRes.data ?? []).forEach((r: any) => {
                    const key = r.expense_date ? monthKey(new Date(r.expense_date)) : '—';
                    if (!pm[key]) pm[key] = { revenue: 0, expenses: 0 };
                    pm[key].expenses += Number(r.amount ?? 0);
                });
                setPlMonthly(
                    Object.entries(pm)
                        .map(([month, v]) => ({
                            month,
                            revenue: v.revenue,
                            expenses: v.expenses,
                            net: v.revenue - v.expenses,
                        }))
                        .sort((a, b) => a.month.localeCompare(b.month, 'ar'))
                );

                const { data: saleInv, error: saleErr } = await supabase
                    .from('invoices')
                    .select('contact_id, total, amount_paid, invoice_type')
                    .eq('tenant_id', user.tenant_id)
                    .eq('invoice_type', 'sale')
                    .not('contact_id', 'is', null);
                if (saleErr) throw saleErr;
                const dueByContact: Record<string, number> = {};
                (saleInv ?? []).forEach((inv: any) => {
                    const due = Math.max(0, Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0));
                    if (due <= 0) return;
                    const cid = String(inv.contact_id);
                    dueByContact[cid] = (dueByContact[cid] ?? 0) + due;
                });
                const { data: customerRows } = await supabase
                    .from('contacts')
                    .select('id,name')
                    .eq('tenant_id', user.tenant_id)
                    .eq('type', 'customer');
                const nameMap = Object.fromEntries((customerRows ?? []).map((c: any) => [c.id, c.name]));
                const recSorted = Object.entries(dueByContact)
                    .map(([cid, total_due]) => ({
                        contact_id: cid,
                        contact_name: nameMap[cid] || '—',
                        total_due,
                    }))
                    .sort((a, b) => b.total_due - a.total_due);
                setReceivables(recSorted);

                const qtyMap: Record<string, number> = {};
                (stockRes.data ?? []).forEach((s: any) => {
                    qtyMap[s.item_id] = (qtyMap[s.item_id] ?? 0) + Number(s.quantity ?? 0);
                });
                const invRows = (itemRows ?? []).map((it: any) => {
                    const q = qtyMap[it.id] ?? 0;
                    const cost = Number(it.cost_price ?? 0);
                    return {
                        id: it.id,
                        name: it.name,
                        quantity: q,
                        cost,
                        value: q * cost,
                    };
                });
                const totalInv = invRows.reduce((s, r) => s + r.value, 0);
                setInventoryVal({ rows: invRows, total: totalInv });
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
                    التقارير
                </h1>
            </div>
            {loading && <div className="bg-white border rounded-xl p-6 text-center">جاري التحميل...</div>}
            {!loading && error && <div className="bg-white border rounded-xl p-6 text-center text-red-600">{error}</div>}

            {!loading && !error && (
                <>
                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-black">أ) تقرير المبيعات (آخر 6 شهور)</h2>
                            <button
                                type="button"
                                onClick={() => exportExcel(salesByMonth as any, 'مبيعات')}
                                className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                            >
                                تصدير Excel
                            </button>
                        </div>
                        <div className="space-y-2">
                            {salesByMonth.map((r) => (
                                <div key={r.month} className="flex justify-between text-sm">
                                    <span>{r.month}</span>
                                    <span className="font-bold">AED {r.total.toLocaleString('ar-AE')}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-black">ب) أكثر المنتجات مبيعاً</h2>
                            <button
                                type="button"
                                onClick={() => exportExcel(topProducts as any, 'اكثر-المنتجات')}
                                className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                            >
                                تصدير Excel
                            </button>
                        </div>
                        <div className="space-y-2">
                            {topProducts.map((r) => (
                                <div key={r.name} className="flex justify-between text-sm">
                                    <span>{r.name}</span>
                                    <span className="font-bold">{r.qty.toLocaleString('ar-AE')}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-black">ج) تقرير العملاء حسب النوع</h2>
                            <button
                                type="button"
                                onClick={() => exportExcel(contactsByType as any, 'عملاء-حسب-النوع')}
                                className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                            >
                                تصدير Excel
                            </button>
                        </div>
                        <div className="space-y-2">
                            {contactsByType.map((r) => (
                                <div key={r.type} className="flex justify-between text-sm">
                                    <span>{r.type}</span>
                                    <span className="font-bold">{r.count.toLocaleString('ar-AE')}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-black">د) تقرير المخزون (reorder_point)</h2>
                            <button
                                type="button"
                                onClick={() => exportExcel(inventoryLow as any, 'مخزون-تنبيه')}
                                className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                            >
                                تصدير Excel
                            </button>
                        </div>
                        <div className="space-y-2">
                            {inventoryLow.map((r: any) => (
                                <div key={r.id} className="flex justify-between text-sm">
                                    <span>{r.name || r.id}</span>
                                    <span className="font-bold">{Number(r.reorder_point || 0).toLocaleString('ar-AE')}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section id="pl-print-area" className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm print:shadow-none">
                        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                            <h2 className="font-black">هـ) قائمة الدخل (P&amp;L)</h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        exportExcel(
                                            [
                                                { بند: 'الإيرادات_فواتير_مدفوعة', مبلغ: plStmt.revenue },
                                                { بند: 'تكلفة_المبيعات_COGS', مبلغ: plStmt.cogs },
                                                { بند: 'مجمل_الربح', مبلغ: plStmt.gross },
                                                { بند: 'المصروفات_التشغيلية', مبلغ: plStmt.opex },
                                                { بند: 'صافي_الربح', مبلغ: plStmt.net },
                                            ],
                                            'PL-Statement'
                                        )
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                                >
                                    تصدير Excel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold"
                                >
                                    تصدير PDF
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {(
                                [
                                    { id: 'today' as const, label: 'اليوم' },
                                    { id: 'month' as const, label: 'هذا الشهر' },
                                    { id: 'quarter' as const, label: 'هذا الربع' },
                                    { id: 'year' as const, label: 'هذه السنة' },
                                    { id: 'custom' as const, label: 'مخصص' },
                                ] as const
                            ).map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => setPlPreset(b.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                        plPreset === b.id ? 'bg-[#071C3B] text-white border-[#071C3B]' : 'bg-white border-gray-200'
                                    }`}
                                >
                                    {b.label}
                                </button>
                            ))}
                        </div>
                        {plPreset === 'custom' && (
                            <div className="flex flex-wrap gap-2 mb-4 items-center">
                                <label className="text-xs font-bold text-gray-600">من</label>
                                <input
                                    type="date"
                                    className="border rounded-lg px-2 py-1 text-sm"
                                    value={plFrom}
                                    onChange={(e) => setPlFrom(e.target.value)}
                                />
                                <label className="text-xs font-bold text-gray-600">إلى</label>
                                <input
                                    type="date"
                                    className="border rounded-lg px-2 py-1 text-sm"
                                    value={plTo}
                                    onChange={(e) => setPlTo(e.target.value)}
                                />
                            </div>
                        )}
                        {plStmtLoading ? (
                            <div className="py-8 text-center text-gray-500 font-bold">جاري حساب P&amp;L...</div>
                        ) : (
                            <div className="space-y-3 max-w-xl font-mono text-sm">
                                <div className="flex justify-between border-b pb-2">
                                    <span>الإيرادات (فواتير مدفوعة — sale)</span>
                                    <span className="font-black">AED {plStmt.revenue.toLocaleString('ar-AE')}</span>
                                </div>
                                <div className="flex justify-between text-red-700">
                                    <span>تكلفة المبيعات (COGS — حركات بيع)</span>
                                    <span>({plStmt.cogs.toLocaleString('ar-AE')})</span>
                                </div>
                                <div className="flex justify-between border-t pt-2 font-black text-emerald-800">
                                    <span>مجمل الربح</span>
                                    <span>AED {plStmt.gross.toLocaleString('ar-AE')}</span>
                                </div>
                                <div className="flex justify-between text-red-700">
                                    <span>المصروفات التشغيلية</span>
                                    <span>({plStmt.opex.toLocaleString('ar-AE')})</span>
                                </div>
                                <div className="flex justify-between border-t-2 pt-2 text-lg font-black text-[#071C3B]">
                                    <span>صافي الربح</span>
                                    <span>AED {plStmt.net.toLocaleString('ar-AE')}</span>
                                </div>
                            </div>
                        )}
                        <div className="h-64 mt-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={plMonthly}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="revenue" fill="#00CFFF" name="إيرادات (مدفوع)" />
                                    <Bar dataKey="expenses" fill="#EF476F" name="مصروفات" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-black">و) تقرير المدينون (مجموع المستحق لكل عميل)</h2>
                            <button
                                type="button"
                                onClick={() => exportExcel(receivables as any, 'المدينون')}
                                className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                            >
                                تصدير Excel
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500">
                                        <th className="text-start py-2">العميل</th>
                                        <th className="text-start">إجمالي المستحق</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receivables.map((r: any) => (
                                        <tr key={r.contact_id} className="border-t">
                                            <td className="py-2 font-bold">{r.contact_name}</td>
                                            <td className="font-bold">AED {Number(r.total_due ?? 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                            <h2 className="font-black">ز) تقرير قيمة المخزون</h2>
                            <button
                                type="button"
                                onClick={() => exportExcel(inventoryVal.rows as any, 'قيمة-المخزون')}
                                className="px-3 py-1.5 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                            >
                                تصدير Excel
                            </button>
                        </div>
                        <p className="text-lg font-black text-[#071C3B] mb-4">
                            إجمالي قيمة المخزون: AED {inventoryVal.total.toLocaleString('ar-AE')}
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500">
                                        <th className="text-start py-2">الصنف</th>
                                        <th className="text-start">الكمية</th>
                                        <th className="text-start">تكلفة</th>
                                        <th className="text-start">القيمة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventoryVal.rows.map((r) => (
                                        <tr key={r.id} className="border-t">
                                            <td className="py-2">{r.name}</td>
                                            <td>{r.quantity.toLocaleString('ar-AE')}</td>
                                            <td>{r.cost.toFixed(2)}</td>
                                            <td className="font-bold">AED {r.value.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
