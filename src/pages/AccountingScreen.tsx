import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, FilePlus, FileMinus, Percent, PlusCircle, Landmark, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AccountingScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'entries' | 'accounts' | 'assets' | 'banks'>('entries');
    const [entries, setEntries] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [entrySums, setEntrySums] = useState<Record<string, { debit: number; credit: number }>>({});
    const [kpiMode, setKpiMode] = useState<'journal_lines' | 'invoices'>('journal_lines');
    const [invoiceKpis, setInvoiceKpis] = useState({ sales: 0, expenses: 0, balance: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [assets, setAssets] = useState<any[]>([]);
    const [assetModal, setAssetModal] = useState(false);
    const [assetForm, setAssetForm] = useState({
        asset_name: '',
        category: '',
        purchase_date: '',
        purchase_price: '',
        useful_life_years: '5',
        salvage_value: '0',
    });
    const [assetSaving, setAssetSaving] = useState(false);

    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [bankModal, setBankModal] = useState(false);
    const [bankForm, setBankForm] = useState({
        account_name: '',
        bank_name: '',
        iban: '',
        currency: 'AED',
        current_balance: '0',
    });
    const [bankSaving, setBankSaving] = useState(false);
    const [bankDrawer, setBankDrawer] = useState<any | null>(null);
    const [bankTx, setBankTx] = useState<any[]>([]);
    const [bankTxLoading, setBankTxLoading] = useState(false);
    const [txModal, setTxModal] = useState(false);
    const [txForm, setTxForm] = useState({ type: 'deposit' as 'deposit' | 'withdrawal', amount: '', description: '' });
    const [txSaving, setTxSaving] = useState(false);

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

    const reloadAssetsBanks = async () => {
        if (!user?.tenant_id) return;
        const [aRes, bRes] = await Promise.all([
            supabase.from('assets').select('*').eq('tenant_id', user.tenant_id).order('created_at', { ascending: false }),
            supabase.from('bank_accounts').select('*').eq('tenant_id', user.tenant_id).order('created_at', { ascending: false }),
        ]);
        if (!aRes.error) setAssets(aRes.data ?? []);
        if (!bRes.error) setBankAccounts(bRes.data ?? []);
    };

    useEffect(() => {
        reloadAssetsBanks();
    }, [user?.tenant_id]);

    const openBankDrawer = async (acc: any) => {
        if (!user?.tenant_id) return;
        setBankDrawer(acc);
        setBankTxLoading(true);
        const { data } = await supabase
            .from('bank_transactions')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('bank_account_id', acc.id)
            .order('created_at', { ascending: false });
        setBankTx(data ?? []);
        setBankTxLoading(false);
    };

    const saveAsset = async () => {
        if (!user?.tenant_id || !assetForm.asset_name.trim()) return;
        setAssetSaving(true);
        try {
            await supabase.from('assets').insert({
                tenant_id: user.tenant_id,
                asset_name: assetForm.asset_name.trim(),
                category: assetForm.category.trim() || null,
                purchase_date: assetForm.purchase_date || null,
                purchase_price: Number(assetForm.purchase_price || 0),
                useful_life_years: Number(assetForm.useful_life_years || 1),
                salvage_value: Number(assetForm.salvage_value || 0),
            });
            setAssetModal(false);
            setAssetForm({
                asset_name: '',
                category: '',
                purchase_date: '',
                purchase_price: '',
                useful_life_years: '5',
                salvage_value: '0',
            });
            await reloadAssetsBanks();
        } finally {
            setAssetSaving(false);
        }
    };

    const runDepreciation = async (row: any) => {
        if (!user?.tenant_id) return;
        const price = Number(row.purchase_price ?? 0);
        const salvage = Number(row.salvage_value ?? 0);
        const life = Math.max(Number(row.useful_life_years ?? 1), 0.0001);
        const annual = (price - salvage) / life;
        const prev = Number(row.accumulated_depreciation ?? 0);
        await supabase
            .from('assets')
            .update({ accumulated_depreciation: prev + annual, updated_at: new Date().toISOString() })
            .eq('id', row.id)
            .eq('tenant_id', user.tenant_id);
        await reloadAssetsBanks();
    };

    const saveBankAccount = async () => {
        if (!user?.tenant_id || !bankForm.account_name.trim()) return;
        setBankSaving(true);
        try {
            await supabase.from('bank_accounts').insert({
                tenant_id: user.tenant_id,
                account_name: bankForm.account_name.trim(),
                bank_name: bankForm.bank_name.trim() || null,
                iban: bankForm.iban.trim() || null,
                currency: bankForm.currency.trim() || 'AED',
                current_balance: Number(bankForm.current_balance || 0),
            });
            setBankModal(false);
            setBankForm({ account_name: '', bank_name: '', iban: '', currency: 'AED', current_balance: '0' });
            await reloadAssetsBanks();
        } finally {
            setBankSaving(false);
        }
    };

    const saveBankTx = async () => {
        if (!user?.tenant_id || !bankDrawer) return;
        const amt = Number(txForm.amount);
        if (!amt || amt <= 0) return;
        setTxSaving(true);
        try {
            await supabase.from('bank_transactions').insert({
                tenant_id: user.tenant_id,
                bank_account_id: bankDrawer.id,
                type: txForm.type,
                amount: amt,
                description: txForm.description.trim() || null,
            });
            const bal = Number(bankDrawer.current_balance ?? 0);
            const next =
                txForm.type === 'deposit' ? bal + amt : bal - amt;
            await supabase
                .from('bank_accounts')
                .update({ current_balance: next, updated_at: new Date().toISOString() })
                .eq('id', bankDrawer.id)
                .eq('tenant_id', user.tenant_id);
            setTxModal(false);
            setTxForm({ type: 'deposit', amount: '', description: '' });
            await reloadAssetsBanks();
            const { data: fresh } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('id', bankDrawer.id)
                .eq('tenant_id', user.tenant_id)
                .single();
            if (fresh) await openBankDrawer(fresh);
        } finally {
            setTxSaving(false);
        }
    };

    const totals = useMemo(() => {
        const debit = Object.values(entrySums).reduce((s, e) => s + Number(e.debit ?? 0), 0);
        const credit = Object.values(entrySums).reduce((s, e) => s + Number(e.credit ?? 0), 0);
        return { debit, credit, balance: debit - credit };
    }, [entrySums]);

    return (
        <div className="p-8 h-full bg-transparent font-nunito text-gray-800">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-[#0A192F]">مركز التحكم المالي</h1>
                <button className="bg-[#0A192F] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <PlusCircle size={18} /> قيد يومية جديد
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
                <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => setActiveTab('entries')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'entries' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>القيود</button>
                    <button onClick={() => setActiveTab('accounts')} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'accounts' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>دليل الحسابات</button>
                    <button onClick={() => setActiveTab('assets')} className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1 ${activeTab === 'assets' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>
                        <Building2 size={16} /> الأصول الثابتة
                    </button>
                    <button onClick={() => setActiveTab('banks')} className={`px-3 py-1.5 rounded-lg text-sm font-bold inline-flex items-center gap-1 ${activeTab === 'banks' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>
                        <Landmark size={16} /> الحسابات البنكية
                    </button>
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

                {!loading && activeTab === 'assets' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button type="button" onClick={() => setAssetModal(true)} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold text-sm">
                                إضافة أصل
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 border-b">
                                        <th className="py-2 text-start">الاسم</th>
                                        <th className="py-2 text-start">الفئة</th>
                                        <th className="py-2 text-start">تاريخ الشراء</th>
                                        <th className="py-2 text-start">القيمة</th>
                                        <th className="py-2 text-start">صافي القيمة</th>
                                        <th className="py-2 text-start"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assets.map((a) => {
                                        const pp = Number(a.purchase_price ?? 0);
                                        const ad = Number(a.accumulated_depreciation ?? 0);
                                        const net = pp - ad;
                                        return (
                                            <tr key={a.id} className="border-t">
                                                <td className="py-2 font-bold">{a.asset_name}</td>
                                                <td className="py-2">{a.category || '—'}</td>
                                                <td className="py-2">{a.purchase_date || '—'}</td>
                                                <td className="py-2">AED {pp.toFixed(2)}</td>
                                                <td className="py-2 font-bold">AED {net.toFixed(2)}</td>
                                                <td className="py-2">
                                                    <button type="button" className="text-xs font-bold text-cyan-700 underline" onClick={() => runDepreciation(a)}>
                                                        احتساب الإهلاك
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!loading && activeTab === 'banks' && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button type="button" onClick={() => setBankModal(true)} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold text-sm">
                                إضافة حساب
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 border-b">
                                        <th className="py-2 text-start">اسم الحساب</th>
                                        <th className="py-2 text-start">البنك</th>
                                        <th className="py-2 text-start">IBAN</th>
                                        <th className="py-2 text-start">الرصيد</th>
                                        <th className="py-2 text-start">العملة</th>
                                        <th className="py-2 text-start"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bankAccounts.map((b) => (
                                        <tr key={b.id} className="border-t">
                                            <td className="py-2 font-bold">{b.account_name}</td>
                                            <td className="py-2">{b.bank_name || '—'}</td>
                                            <td className="py-2 font-mono text-xs">{b.iban || '—'}</td>
                                            <td className="py-2">AED {Number(b.current_balance ?? 0).toFixed(2)}</td>
                                            <td className="py-2">{b.currency || 'AED'}</td>
                                            <td className="py-2">
                                                <button
                                                    type="button"
                                                    className="text-xs font-bold text-[#071C3B] underline"
                                                    onClick={() => openBankDrawer(b)}
                                                >
                                                    عرض الحركات
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {assetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-xl">
                        <h3 className="font-black text-lg">إضافة أصل</h3>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="اسم الأصل" value={assetForm.asset_name} onChange={(e) => setAssetForm({ ...assetForm, asset_name: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="الفئة" value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} />
                        <input type="date" className="w-full border rounded-lg px-3 py-2" value={assetForm.purchase_date} onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })} />
                        <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="سعر الشراء" value={assetForm.purchase_price} onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })} />
                        <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="العمر الافتراضي (سنوات)" value={assetForm.useful_life_years} onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: e.target.value })} />
                        <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="القيمة المتبقية" value={assetForm.salvage_value} onChange={(e) => setAssetForm({ ...assetForm, salvage_value: e.target.value })} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" className="px-4 py-2 border rounded-lg font-bold" onClick={() => setAssetModal(false)}>
                                إلغاء
                            </button>
                            <button type="button" disabled={assetSaving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold" onClick={saveAsset}>
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {bankModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-xl">
                        <h3 className="font-black text-lg">حساب بنكي جديد</h3>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="اسم الحساب" value={bankForm.account_name} onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="اسم البنك" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2 font-mono" placeholder="IBAN" value={bankForm.iban} onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="العملة" value={bankForm.currency} onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })} />
                        <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="الرصيد الحالي" value={bankForm.current_balance} onChange={(e) => setBankForm({ ...bankForm, current_balance: e.target.value })} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" className="px-4 py-2 border rounded-lg font-bold" onClick={() => setBankModal(false)}>
                                إلغاء
                            </button>
                            <button type="button" disabled={bankSaving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold" onClick={saveBankAccount}>
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {bankDrawer && (
                <div className="fixed inset-0 z-[60] flex justify-end bg-black/40">
                    <div className="w-full max-w-md bg-white h-full shadow-xl p-6 overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-lg">{bankDrawer.account_name}</h3>
                                <p className="text-sm text-gray-500">{bankDrawer.bank_name}</p>
                                <p className="text-sm font-bold mt-2">الرصيد: AED {Number(bankDrawer.current_balance ?? 0).toFixed(2)}</p>
                            </div>
                            <button type="button" className="text-gray-500 font-bold" onClick={() => setBankDrawer(null)}>
                                ✕
                            </button>
                        </div>
                        <button
                            type="button"
                            className="w-full mb-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold text-sm"
                            onClick={() => setTxModal(true)}
                        >
                            إضافة حركة
                        </button>
                        {bankTxLoading ? (
                            <p className="text-center text-gray-500">جاري التحميل...</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-500 border-b">
                                        <th className="py-2 text-start">النوع</th>
                                        <th className="py-2 text-start">المبلغ</th>
                                        <th className="py-2 text-start">الوصف</th>
                                        <th className="py-2 text-start">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bankTx.map((t) => (
                                        <tr key={t.id} className="border-t">
                                            <td className="py-2">{t.type === 'deposit' ? 'إيداع' : 'سحب'}</td>
                                            <td className="py-2 font-bold">AED {Number(t.amount ?? 0).toFixed(2)}</td>
                                            <td className="py-2">{t.description || '—'}</td>
                                            <td className="py-2 text-xs">{t.created_at ? new Date(t.created_at).toLocaleString('ar-AE') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {txModal && bankDrawer && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3">
                        <h4 className="font-black">حركة بنكية</h4>
                        <select
                            className="w-full border rounded-lg px-3 py-2"
                            value={txForm.type}
                            onChange={(e) => setTxForm({ ...txForm, type: e.target.value as 'deposit' | 'withdrawal' })}
                        >
                            <option value="deposit">إيداع</option>
                            <option value="withdrawal">سحب</option>
                        </select>
                        <input
                            type="number"
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="المبلغ"
                            value={txForm.amount}
                            onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                        />
                        <input
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="الوصف"
                            value={txForm.description}
                            onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                        />
                        <div className="flex gap-2 justify-end">
                            <button type="button" className="px-4 py-2 border rounded-lg font-bold" onClick={() => setTxModal(false)}>
                                إلغاء
                            </button>
                            <button type="button" disabled={txSaving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold" onClick={saveBankTx}>
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
