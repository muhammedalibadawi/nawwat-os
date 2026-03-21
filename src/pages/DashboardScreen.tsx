import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KpiCard } from '../components/ui/KpiCard';
import { ActionButton } from '../components/ui/ActionButton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DataTable } from '../components/ui/DataTable';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Building2, TrendingUp, AlertTriangle, FileText,
    Plus, Users, Settings, ChevronRight, ShoppingCart
} from 'lucide-react';

type InvoiceRow = { id: string; invoice_no: string | null; total: number | null; amount_paid: number | null; status: string | null; created_at: string };
type AuditRow = { id: string; action: string | null; table_name: string | null; created_at: string };

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function pctChange(curr: number, prev: number): { trend: 'up' | 'down' | 'neutral'; label: string } {
    if (prev === 0 && curr === 0) return { trend: 'neutral', label: 'مستقر' };
    if (prev === 0) return { trend: 'up', label: `↑ جديد` };
    const p = ((curr - prev) / Math.abs(prev)) * 100;
    const rounded = p.toFixed(1);
    if (p > 0.5) return { trend: 'up', label: `↑ ${rounded}% عن أمس` };
    if (p < -0.5) return { trend: 'down', label: `↓ ${Math.abs(Number(rounded))}% عن أمس` };
    return { trend: 'neutral', label: '≈ مثل أمس' };
}

const DashboardScreen: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paidRevenue, setPaidRevenue] = useState<number>(0);
    const [paidRevenueYtdYesterday, setPaidRevenueYtdYesterday] = useState<number>(0);
    const [salesToday, setSalesToday] = useState<number>(0);
    const [salesYesterday, setSalesYesterday] = useState<number>(0);
    const [activeLeasesCount, setActiveLeasesCount] = useState<number>(0);
    const [activeLeasesYesterday, setActiveLeasesYesterday] = useState<number>(0);
    const [activeItemsCount, setActiveItemsCount] = useState<number>(0);
    const [activeItemsYesterday, setActiveItemsYesterday] = useState<number>(0);
    const [pendingAmount, setPendingAmount] = useState<number>(0);
    const [pendingYesterday, setPendingYesterday] = useState<number>(0);
    const [activity, setActivity] = useState<AuditRow[]>([]);
    const [actionData, setActionData] = useState<any[]>([]);
    const [chartRows, setChartRows] = useState<{ month: string; total: number }[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);

    const today = new Date().toLocaleDateString('ar-AE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 12) return 'صباح الخير';
        if (h < 17) return 'مساء الخير';
        return 'مساء النور';
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!user?.tenant_id) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const now = new Date();
                const yStart = startOfDay(now);
                const yEnd = endOfDay(now);
                const prev = new Date(now);
                prev.setDate(prev.getDate() - 1);
                const ys = startOfDay(prev);
                const ye = endOfDay(prev);
                const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
                const yesterdayEndIso = ye.toISOString();

                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

                const [
                    revenueData,
                    ytdYesterdayData,
                    salesTodayData,
                    salesYestData,
                    leasesData,
                    stockData,
                    pendingData,
                    pendingInvoices,
                    activityData,
                    actionRows,
                    chartData,
                    topItemsRes,
                ] = await Promise.all([
                    supabase
                        .from('invoices')
                        .select('total')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .gte('created_at', yearStart),
                    supabase
                        .from('invoices')
                        .select('total')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .gte('created_at', yearStart)
                        .lte('created_at', yesterdayEndIso),
                    supabase
                        .from('invoices')
                        .select('total')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .gte('created_at', yStart.toISOString())
                        .lte('created_at', yEnd.toISOString()),
                    supabase
                        .from('invoices')
                        .select('total')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .gte('created_at', ys.toISOString())
                        .lte('created_at', ye.toISOString()),
                    supabase
                        .from('leases')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'active'),
                    supabase
                        .from('items')
                        .select('*', { count: 'exact', head: true })
                        .eq('tenant_id', user.tenant_id)
                        .eq('is_active', true),
                    supabase
                        .from('invoices')
                        .select('total, amount_paid')
                        .eq('tenant_id', user.tenant_id)
                        .in('status', ['unpaid', 'partial', 'sent', 'overdue']),
                    supabase
                        .from('invoices')
                        .select('total, amount_paid, created_at')
                        .eq('tenant_id', user.tenant_id)
                        .in('status', ['unpaid', 'partial', 'sent', 'overdue'])
                        .lte('created_at', yesterdayEndIso),
                    supabase
                        .from('audit_log')
                        .select('id, action, table_name, created_at')
                        .eq('tenant_id', user.tenant_id)
                        .order('created_at', { ascending: false })
                        .limit(5),
                    supabase
                        .from('invoices')
                        .select('id, invoice_no, total, amount_paid, created_at, status')
                        .eq('tenant_id', user.tenant_id)
                        .in('status', ['unpaid', 'overdue', 'sent', 'partial'])
                        .order('created_at', { ascending: false })
                        .limit(5),
                    supabase
                        .from('invoices')
                        .select('total, created_at')
                        .eq('tenant_id', user.tenant_id)
                        .eq('status', 'paid')
                        .gte('created_at', sixMonthsAgo.toISOString()),
                    supabase
                        .from('invoice_items')
                        .select('name, item_ref, quantity')
                        .eq('tenant_id', user.tenant_id),
                ]);

                if (cancelled) return;

                if (revenueData.error) throw revenueData.error;
                if (ytdYesterdayData.error) throw ytdYesterdayData.error;
                if (salesTodayData.error) throw salesTodayData.error;
                if (salesYestData.error) throw salesYestData.error;
                if (leasesData.error) throw leasesData.error;
                if (stockData.error) throw stockData.error;
                if (pendingData.error) throw pendingData.error;
                if (pendingInvoices.error) throw pendingInvoices.error;
                if (activityData.error) throw activityData.error;
                if (actionRows.error) throw actionRows.error;
                if (chartData.error) throw chartData.error;
                if (topItemsRes.error) throw topItemsRes.error;

                setPaidRevenue((revenueData.data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0));
                setPaidRevenueYtdYesterday((ytdYesterdayData.data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0));
                setSalesToday((salesTodayData.data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0));
                setSalesYesterday((salesYestData.data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0));
                setActiveLeasesCount(leasesData.count ?? 0);
                setActiveLeasesYesterday(leasesData.count ?? 0);
                setActiveItemsCount(stockData.count ?? 0);
                setActiveItemsYesterday(stockData.count ?? 0);

                const pend = (pendingData.data ?? []).reduce(
                    (s: number, r: any) => s + (Number(r.total ?? 0) - Number(r.amount_paid ?? 0)),
                    0
                );
                setPendingAmount(pend);
                const pendY = (pendingInvoices.data ?? []).reduce(
                    (s: number, r: any) => s + (Number(r.total ?? 0) - Number(r.amount_paid ?? 0)),
                    0
                );
                setPendingYesterday(pendY);

                setActivity((activityData.data ?? []) as AuditRow[]);
                setActionData((actionRows.data ?? []) as InvoiceRow[]);

                const grouped: Record<string, number> = {};
                (chartData.data ?? []).forEach((r: any) => {
                    const key = new Date(r.created_at).toLocaleDateString('ar-AE', { month: 'short', year: '2-digit' });
                    grouped[key] = (grouped[key] ?? 0) + Number(r.total ?? 0);
                });
                setChartRows(Object.entries(grouped).map(([month, total]) => ({ month, total })));

                const agg: Record<string, number> = {};
                (topItemsRes.data ?? []).forEach((r: any) => {
                    const key = r.name || r.item_ref || '—';
                    agg[key] = (agg[key] ?? 0) + Number(r.quantity ?? 0);
                });
                const top = Object.entries(agg)
                    .map(([name, qty]) => ({ name, qty }))
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 5);
                setTopProducts(top);
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load dashboard data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [user?.tenant_id]);

    const cmpYtd = pctChange(paidRevenue, paidRevenueYtdYesterday);
    const cmpSales = pctChange(salesToday, salesYesterday);
    const cmpLease = pctChange(activeLeasesCount, activeLeasesYesterday);
    const cmpStock = pctChange(activeItemsCount, activeItemsYesterday);
    const cmpPending = pctChange(pendingAmount, pendingYesterday);

    const actionRequired = useMemo(() => {
        return actionData.map((i) => ({
            id: i.invoice_no || i.id,
            client: '—',
            date: new Date(i.created_at).toLocaleDateString('ar-AE'),
            amount: `AED ${Number(i.total ?? 0).toLocaleString('ar-AE')}`,
            status: i.status === 'overdue' ? 'متأخرة' : 'معلقة',
        }));
    }, [actionData]);

    return (
        <div className="font-arabic flex flex-col gap-6 max-w-[1600px] mx-auto w-full animate-fade-in pb-10">
            <div className="bg-gradient-to-r from-cyan/10 to-transparent p-6 sm:p-8 rounded-[20px] border border-cyan/20 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
                <div className="absolute top-0 start-0 w-[500px] h-[500px] bg-cyan/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="relative z-10">
                    <h1 className="font-nunito text-3xl sm:text-4xl font-black text-midnight mb-2">
                        {greeting}، {user?.full_name?.split(' ')[0] || 'المستخدم'}!
                    </h1>
                    <p className="text-content-3 text-sm font-medium flex items-center gap-2">
                        <span>{today}</span>
                        <span className="w-1 h-1 rounded-full bg-content-4" />
                        <span className="text-success font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            ZATCA متصل
                        </span>
                    </p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto relative z-10 shrink-0">
                    <Link to="/reports" className="flex-1 sm:flex-none border border-border bg-surface-card hover:bg-surface-bg transition-colors text-content font-bold text-[0.82rem] px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center justify-center">
                        عرض التقارير
                    </Link>
                    <Link
                        to="/invoices"
                        className="flex-1 sm:flex-none bg-midnight hover:bg-[#1a2b4b] transition-colors text-white font-bold text-[0.82rem] px-5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> معاملة جديدة
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                <KpiCard
                    title="المبيعات اليوم"
                    value={`AED ${salesToday.toLocaleString('ar-AE')}`}
                    delta={cmpSales.label}
                    trend={cmpSales.trend === 'down' ? 'down' : cmpSales.trend === 'up' ? 'up' : 'neutral'}
                    colorHex="#00CFFF"
                    icon={<ShoppingCart />}
                />
                <KpiCard
                    title="إجمالي الإيرادات (السنة)"
                    value={`AED ${paidRevenue.toLocaleString('ar-AE')}`}
                    delta={cmpYtd.label}
                    trend={cmpYtd.trend === 'down' ? 'down' : cmpYtd.trend === 'up' ? 'up' : 'neutral'}
                    colorHex="#00CFFF"
                    icon={<TrendingUp />}
                />
                <KpiCard
                    title="الإيجارات النشطة"
                    value={activeLeasesCount.toLocaleString('ar-AE')}
                    delta={cmpLease.label}
                    trend={cmpLease.trend === 'down' ? 'down' : cmpLease.trend === 'up' ? 'up' : 'neutral'}
                    colorHex="#03a07a"
                    icon={<Building2 />}
                />
                <KpiCard
                    title="تنبيهات المخزون (أصناف نشطة)"
                    value={activeItemsCount.toLocaleString('ar-AE')}
                    delta={cmpStock.label}
                    trend={cmpStock.trend === 'down' ? 'down' : cmpStock.trend === 'up' ? 'up' : 'neutral'}
                    colorHex="#EF476F"
                    icon={<AlertTriangle />}
                />
                <KpiCard
                    title="الفواتير المعلقة"
                    value={`AED ${pendingAmount.toLocaleString('ar-AE')}`}
                    delta={cmpPending.label}
                    trend={cmpPending.trend === 'down' ? 'down' : cmpPending.trend === 'up' ? 'up' : 'neutral'}
                    colorHex="#6C5CE7"
                    icon={<FileText />}
                />
            </div>

            {topProducts.length > 0 && (
                <div className="bg-surface-card border border-border rounded-[20px] p-6 shadow-sm">
                    <h2 className="font-nunito font-extrabold text-lg text-midnight mb-4">أكثر المنتجات مبيعاً (Top 5)</h2>
                    <ul className="space-y-2">
                        {topProducts.map((p, i) => (
                            <li key={p.name} className="flex justify-between text-sm border-b border-border/50 pb-2">
                                <span className="font-bold text-midnight">
                                    {i + 1}. {p.name}
                                </span>
                                <span className="text-cyan font-black">{p.qty.toLocaleString('ar-AE')}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-surface-card border border-border rounded-[20px] p-6 shadow-sm flex flex-col h-[350px]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-nunito font-extrabold text-lg text-midnight">نظرة عامة على الإيرادات</h2>
                            <select className="bg-surface-bg border border-border rounded-lg px-3 py-1 text-xs font-bold text-content-2 outline-none cursor-pointer">
                                <option>آخر 30 يوم</option>
                                <option>هذا الربع</option>
                                <option>هذا العام</option>
                            </select>
                        </div>
                        <div className="flex-1 rounded-xl bg-surface-bg/50">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartRows}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip formatter={(v: any) => `AED ${Number(v).toLocaleString('ar-AE')}`} />
                                    <Line type="monotone" dataKey="total" stroke="#00CFFF" strokeWidth={3} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-surface-card border border-border rounded-[20px] p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="font-nunito font-extrabold text-lg text-midnight">يحتاج متابعة</h2>
                            <button className="text-cyan text-sm font-bold flex items-center gap-1 hover:text-[#00c5db] transition-colors">
                                عرض الكل <ChevronRight size={16} />
                            </button>
                        </div>
                        <DataTable
                            data={actionRequired}
                            columns={[
                                { header: 'رقم الفاتورة', accessorKey: 'id', className: 'font-bold text-midnight' },
                                { header: 'العميل', accessorKey: 'client' },
                                { header: 'التاريخ', accessorKey: 'date' },
                                { header: 'المبلغ', accessorKey: 'amount', className: 'font-bold' },
                                {
                                    header: 'الحالة',
                                    accessorKey: (row) => <StatusBadge text={row.status} variant={row.status === 'متأخرة' ? 'red' : 'warn'} />,
                                },
                            ]}
                        />
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-surface-card border border-border rounded-[20px] p-6 shadow-sm">
                        <h2 className="font-nunito font-extrabold text-lg text-midnight mb-5">إجراءات سريعة</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                            <ActionButton
                                onClick={() => navigate('/invoices')}
                                icon={<Plus className="text-cyan" />}
                                title="إنشاء فاتورة"
                                subtitle="ZATCA B2B / B2C"
                            />
                            <ActionButton
                                onClick={() => navigate('/crm')}
                                icon={<Users className="text-purple" />}
                                title="إضافة عميل"
                                subtitle="وحدة إدارة العملاء"
                            />
                            <ActionButton
                                onClick={() => navigate('/settings')}
                                icon={<Settings className="text-content-3" />}
                                title="إعدادات النظام"
                                subtitle="الإعدادات"
                            />
                        </div>
                    </div>

                    <div className="bg-surface-card border border-border rounded-[20px] p-6 shadow-sm flex-1">
                        <h2 className="font-nunito font-extrabold text-lg text-midnight mb-6">النشاط الأخير</h2>
                        <div className="relative">
                            <div className="absolute top-2 bottom-2 start-[11px] w-px bg-border/60" />
                            <div className="space-y-6">
                                {activity.map((entry) => (
                                    <div key={entry.id} className="relative flex gap-4 items-start">
                                        <div
                                            className={`w-6 h-6 rounded-full border-[3px] border-surface-card flex items-center justify-center shrink-0 z-10 ${'bg-cyan'}`}
                                        >
                                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                        </div>
                                        <div className="flex-1 mt-0.5">
                                            <p className="text-[0.82rem] font-bold text-content">{entry.action || 'نشاط'}</p>
                                            <p className="text-[0.75rem] text-content-2 mt-0.5">{entry.table_name || '—'}</p>
                                            <p className="text-[0.68rem] font-bold text-content-4 mt-1 opacity-70 uppercase tracking-wide">
                                                {new Date(entry.created_at).toLocaleString('ar-AE')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {loading && (
                            <div className="animate-pulse space-y-3 mt-3">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                            </div>
                        )}
                        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
                        <button className="w-full mt-6 py-2 border border-border rounded-xl text-[0.8rem] font-bold text-content-2 hover:bg-surface-bg-2 transition-colors">
                            تحميل المزيد
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardScreen;
