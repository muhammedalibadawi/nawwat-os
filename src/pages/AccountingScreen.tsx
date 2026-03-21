import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, FilePlus, FileMinus, Percent, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AccountingScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'entries' | 'accounts'>('entries');
    const [entries, setEntries] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [entrySums, setEntrySums] = useState<Record<string, { debit: number; credit: number }>>({});
    const [kpiMode, setKpiMode] = useState<'journal_lines' | 'invoices'>('journal_lines');
    const [invoiceKpis, setInvoiceKpis] = useState({ sales: 0, expenses: 0, balance: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!user?.tenant_id) return;
            setLoading(true);
            setError('');
            try {
                const [entriesRes, accountsRes] = await Promise.all([
                    supabase
                        .from('journal_entries')
                        .select('id,entry_no,description,status,created_at')
                        .eq('tenant_id', user.tenant_id)
                        .order('created_at', { ascending: false })
                        .limit(20),
                    supabase
                        .from('chart_of_accounts')
                        .select('id,code,name,account_type,balance')
                        .eq('tenant_id', user.tenant_id),
                ]);
                if (entriesRes.error) throw entriesRes.error;
                if (accountsRes.error) throw accountsRes.error;
                const entryRows = entriesRes.data ?? [];
                setEntries(entryRows);
                setAccounts(accountsRes.data ?? []);

                const { data: linesData, error: linesErr } = await supabase
                    .from('journal_lines')
                    .select('entry_id,type,amount')
                    .eq('tenant_id', user.tenant_id);

                if (!linesErr && (linesData ?? []).length > 0) {
                    const sums: Record<string, { debit: number; credit: number }> = {};
                    (linesData ?? []).forEach((line: any) => {
                        const id = String(line.entry_id ?? '');
                        if (!id) return;
                        if (!sums[id]) sums[id] = { debit: 0, credit: 0 };
                        if (line.type === 'debit') sums[id].debit += Number(line.amount ?? 0);
                        if (line.type === 'credit') sums[id].credit += Number(line.amount ?? 0);
                    });
                    setEntrySums(sums);
                    setKpiMode('journal_lines');
                } else {
                    const { data: invData, error: invErr } = await supabase
                        .from('invoices')
                        .select('total,invoice_type,status')
                        .eq('tenant_id', user.tenant_id);
                    if (invErr) throw invErr;
                    const sales = (invData ?? [])
                        .filter((i: any) => i.invoice_type === 'sale' && i.status === 'paid')
                        .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
                    const expenses = (invData ?? [])
                        .filter((i: any) => i.invoice_type === 'expense')
                        .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
                    setInvoiceKpis({ sales, expenses, balance: sales - expenses });
                    setEntrySums({});
                    setKpiMode('invoices');
                }
            } catch (err: any) {
                setError(err?.message ?? 'فشل تحميل البيانات المحاسبية');
                setEntries([]);
                setAccounts([]);
                setEntrySums({});
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.tenant_id]);

    const totals = useMemo(() => {
        const debit = Object.values(entrySums).reduce((s, e) => s + Number(e.debit ?? 0), 0);
        const credit = Object.values(entrySums).reduce((s, e) => s + Number(e.credit ?? 0), 0);
        return { debit, credit, balance: debit - credit };
    }, [entrySums]);

    return (
        <div className="p-8 h-full bg-transparent font-nunito text-gray-800">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-[#0A192F]">Financial Controller Hub</h1>
                <button className="bg-[#0A192F] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <PlusCircle size={18} /> New Journal Entry
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[
                    ...(kpiMode === 'journal_lines'
                        ? [
                              { label: 'إجمالي المدين', value: `AED ${totals.debit.toLocaleString('ar-AE')}`, icon: FilePlus, color: 'text-emerald-600' },
                              { label: 'إجمالي الدائن', value: `AED ${totals.credit.toLocaleString('ar-AE')}`, icon: FileMinus, color: 'text-red-500' },
                              { label: 'الرصيد', value: `AED ${totals.balance.toLocaleString('ar-AE')}`, icon: TrendingUp, color: 'text-cyan-600' },
                          ]
                        : [
                              { label: 'إجمالي المبيعات', value: `AED ${invoiceKpis.sales.toLocaleString('ar-AE')}`, icon: FilePlus, color: 'text-emerald-600' },
                              { label: 'إجمالي المصروفات', value: `AED ${invoiceKpis.expenses.toLocaleString('ar-AE')}`, icon: FileMinus, color: 'text-red-500' },
                              { label: 'الرصيد', value: `AED ${invoiceKpis.balance.toLocaleString('ar-AE')}`, icon: TrendingUp, color: 'text-cyan-600' },
                          ]),
                    { label: 'عدد الحسابات', value: accounts.length.toLocaleString('ar-AE'), icon: Percent, color: 'text-amber-500' },
                ].map((kpi, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
                        <kpi.icon className={`${kpi.color} mb-4`} size={24} />
                        <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">{kpi.label}</p>
                        <p className="text-2xl font-bold text-[#0A192F]">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex gap-2 mb-4">
                    <button onClick={() => setActiveTab('entries')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'entries' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>القيود</button>
                    <button onClick={() => setActiveTab('accounts')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'accounts' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>دليل الحسابات</button>
                </div>
                {loading && <div className="p-6 text-center text-gray-500">جاري التحميل...</div>}
                {!loading && error && <div className="p-6 text-center text-red-600">{error}</div>}
                {!loading && !error && activeTab === 'entries' && (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-400 text-sm border-b border-gray-100">
                                <th className="pb-4">التاريخ</th><th className="pb-4">رقم القيد</th><th className="pb-4">الوصف</th><th className="pb-4">مدين</th><th className="pb-4">دائن</th><th className="pb-4">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="text-sm hover:bg-gray-50">
                                    <td className="py-4 text-gray-500">{entry.created_at ? new Date(entry.created_at).toLocaleDateString('ar-AE') : '—'}</td>
                                    <td className="py-4 font-bold text-gray-800">{entry.entry_no || entry.id}</td>
                                    <td className="py-4 text-gray-500">{entry.description || '—'}</td>
                                    <td className="py-4 text-emerald-600 font-medium">AED {Number(entrySums[entry.id]?.debit || 0).toLocaleString('ar-AE')}</td>
                                    <td className="py-4 text-red-500 font-medium">AED {Number(entrySums[entry.id]?.credit || 0).toLocaleString('ar-AE')}</td>
                                    <td className="py-4">{entry.status || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && !error && activeTab === 'accounts' && (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-400 text-sm border-b border-gray-100">
                                <th className="pb-4">الكود</th><th className="pb-4">الحساب</th><th className="pb-4">النوع</th><th className="pb-4">الرصيد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {accounts.map((acc) => (
                                <tr key={acc.id} className="text-sm hover:bg-gray-50">
                                    <td className="py-4 font-bold">{acc.code || '—'}</td>
                                    <td className="py-4">{acc.name || '—'}</td>
                                    <td className="py-4">{acc.account_type || '—'}</td>
                                    <td className="py-4">AED {Number(acc.balance || 0).toLocaleString('ar-AE')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
