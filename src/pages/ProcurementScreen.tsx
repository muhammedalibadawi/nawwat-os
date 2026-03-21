import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ProcurementScreen() {
    const { user } = useAuth();
    const [tab, setTab] = useState<'po' | 'expenses'>('po');
    const [poRows, setPoRows] = useState<any[]>([]);
    const [expenseRows, setExpenseRows] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'approved' | 'received' | 'cancelled'>('all');
    const [showPoModal, setShowPoModal] = useState(false);
    const [showExpModal, setShowExpModal] = useState(false);
    const [poForm, setPoForm] = useState<any>({ supplier_id: '', issue_date: '', expected_date: '', lines: [{ item_id: '', qty: 1, price: 0 }] });
    const [expForm, setExpForm] = useState<any>({ description: '', category: '', amount: '', expense_date: '' });

    const load = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const [poRes, expRes, supRes] = await Promise.all([
                supabase
                    .from('purchase_orders')
                    .select('id, po_number, supplier_id, issue_date, total_amount, status, created_at')
                    .eq('tenant_id', user.tenant_id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('expenses')
                    .select('id, description, category, amount, expense_date, status')
                    .eq('tenant_id', user.tenant_id)
                    .order('expense_date', { ascending: false }),
                supabase.from('contacts').select('id,name,type').eq('tenant_id', user.tenant_id).eq('type', 'supplier'),
            ]);
            if (poRes.error) throw poRes.error;
            if (expRes.error) throw expRes.error;
            if (supRes.error) throw supRes.error;
            setPoRows(poRes.data ?? []);
            setExpenseRows(expRes.data ?? []);
            setSuppliers(supRes.data ?? []);
        } catch (err: any) {
            setError(err?.message ?? 'فشل تحميل المشتريات');
            setPoRows([]);
            setExpenseRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [user?.tenant_id]);

    const poKpis = useMemo(() => {
        return {
            total: poRows.length,
            draft: poRows.filter((r) => r.status === 'draft').length,
            received: poRows.filter((r) => r.status === 'received').length,
            value: poRows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0),
        };
    }, [poRows]);

    const filteredPo = useMemo(() => {
        if (statusFilter === 'all') return poRows;
        return poRows.filter((r) => r.status === statusFilter);
    }, [poRows, statusFilter]);

    const poTotal = useMemo(() => poForm.lines.reduce((s: number, l: any) => s + Number(l.qty || 0) * Number(l.price || 0), 0), [poForm.lines]);

    const savePo = async () => {
        if (!user?.tenant_id) return;
        try {
            const { data: po, error: poErr } = await supabase
                .from('purchase_orders')
                .insert({
                    tenant_id: user.tenant_id,
                    supplier_id: poForm.supplier_id || null,
                    issue_date: poForm.issue_date || null,
                    expected_date: poForm.expected_date || null,
                    total_amount: poTotal,
                    status: 'draft',
                })
                .select('id')
                .single();
            if (poErr) throw poErr;
            const lines = poForm.lines
                .filter((l: any) => l.item_id)
                .map((l: any) => ({
                    tenant_id: user.tenant_id,
                    po_id: po.id,
                    item_id: l.item_id,
                    quantity: Number(l.qty || 0),
                    unit_price: Number(l.price || 0),
                    total: Number(l.qty || 0) * Number(l.price || 0),
                }));
            if (lines.length > 0) {
                const { error: liErr } = await supabase.from('purchase_items').insert(lines);
                if (liErr) throw liErr;
            }
            setShowPoModal(false);
            setPoForm({ supplier_id: '', issue_date: '', expected_date: '', lines: [{ item_id: '', qty: 1, price: 0 }] });
            await load();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حفظ أمر الشراء');
        }
    };

    const updatePoStatus = async (id: string, status: string) => {
        if (!user?.tenant_id) return;
        const { error: upErr } = await supabase.from('purchase_orders').update({ status }).eq('id', id).eq('tenant_id', user.tenant_id);
        if (!upErr) await load();
    };

    const saveExpense = async () => {
        if (!user?.tenant_id) return;
        const { error: exErr } = await supabase.from('expenses').insert({
            tenant_id: user.tenant_id,
            description: expForm.description,
            category: expForm.category,
            amount: Number(expForm.amount || 0),
            expense_date: expForm.expense_date || null,
            status: 'posted',
        });
        if (exErr) setError(exErr.message);
        else {
            setShowExpModal(false);
            setExpForm({ description: '', category: '', amount: '', expense_date: '' });
            await load();
        }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-[#071C3B]">المشتريات</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowPoModal(true)} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">أمر شراء جديد</button>
                    <button onClick={() => setShowExpModal(true)} className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-bold">إضافة مصروف</button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setTab('po')} className={`px-3 py-2 rounded-lg ${tab === 'po' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>أوامر الشراء</button>
                <button onClick={() => setTab('expenses')} className={`px-3 py-2 rounded-lg ${tab === 'expenses' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>المصروفات</button>
            </div>

            {loading && <div className="animate-pulse space-y-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div><div className="h-4 bg-gray-200 rounded w-5/6"></div></div>}
            {!loading && error && <div className="text-red-600 font-bold">{error}</div>}

            {!loading && !error && tab === 'po' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white border rounded-xl p-3">إجمالي الطلبات: {poKpis.total.toLocaleString('ar-AE')}</div>
                        <div className="bg-white border rounded-xl p-3">المعلقة: {poKpis.draft.toLocaleString('ar-AE')}</div>
                        <div className="bg-white border rounded-xl p-3">المكتملة: {poKpis.received.toLocaleString('ar-AE')}</div>
                        <div className="bg-white border rounded-xl p-3">إجمالي القيمة: AED {poKpis.value.toLocaleString('ar-AE')}</div>
                    </div>
                    <div className="flex gap-2">
                        {['all', 'draft', 'approved', 'received', 'cancelled'].map((s) => (
                            <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-3 py-1.5 rounded-lg ${statusFilter === s ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>{s}</button>
                        ))}
                    </div>
                    <div className="bg-white border rounded-xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50"><tr><th className="p-3 text-start">PO</th><th className="p-3 text-start">Supplier</th><th className="p-3 text-start">Date</th><th className="p-3 text-start">Total</th><th className="p-3 text-start">Status</th><th className="p-3 text-start">Actions</th></tr></thead>
                            <tbody>
                                {filteredPo.map((r) => (
                                    <tr key={r.id} className="border-t">
                                        <td className="p-3">{r.po_number || r.id}</td>
                                        <td className="p-3">{suppliers.find((s) => s.id === r.supplier_id)?.name || r.supplier_id || '—'}</td>
                                        <td className="p-3">{r.issue_date || '—'}</td>
                                        <td className="p-3">AED {Number(r.total_amount || 0).toLocaleString('ar-AE')}</td>
                                        <td className="p-3">{r.status || '—'}</td>
                                        <td className="p-3 flex gap-1">
                                            <button onClick={() => updatePoStatus(r.id, 'approved')} className="px-2 py-1 bg-gray-100 rounded">approved</button>
                                            <button onClick={() => updatePoStatus(r.id, 'received')} className="px-2 py-1 bg-gray-100 rounded">received</button>
                                            <button onClick={() => updatePoStatus(r.id, 'cancelled')} className="px-2 py-1 bg-red-100 rounded text-red-700">حذف</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!loading && !error && tab === 'expenses' && (
                <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50"><tr><th className="p-3 text-start">الوصف</th><th className="p-3 text-start">الفئة</th><th className="p-3 text-start">المبلغ</th><th className="p-3 text-start">التاريخ</th><th className="p-3 text-start">الحالة</th></tr></thead>
                        <tbody>{expenseRows.map((e) => <tr key={e.id} className="border-t"><td className="p-3">{e.description}</td><td className="p-3">{e.category}</td><td className="p-3">{Number(e.amount || 0).toLocaleString('ar-AE')}</td><td className="p-3">{e.expense_date || '—'}</td><td className="p-3">{e.status || '—'}</td></tr>)}</tbody>
                    </table>
                </div>
            )}

            {showPoModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-white rounded-xl p-5 space-y-3">
                        <h2 className="font-black">أمر شراء جديد</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })} className="border rounded-lg px-3 py-2">
                                <option value="">اختر مورد</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input type="date" value={poForm.issue_date} onChange={(e) => setPoForm({ ...poForm, issue_date: e.target.value })} className="border rounded-lg px-3 py-2" />
                            <input type="date" value={poForm.expected_date} onChange={(e) => setPoForm({ ...poForm, expected_date: e.target.value })} className="border rounded-lg px-3 py-2" />
                        </div>
                        {poForm.lines.map((l: any, idx: number) => (
                            <div key={idx} className="grid grid-cols-3 gap-2">
                                <input placeholder="item_id" value={l.item_id} onChange={(e) => setPoForm({ ...poForm, lines: poForm.lines.map((x: any, i: number) => i === idx ? { ...x, item_id: e.target.value } : x) })} className="border rounded-lg px-3 py-2" />
                                <input type="number" value={l.qty} onChange={(e) => setPoForm({ ...poForm, lines: poForm.lines.map((x: any, i: number) => i === idx ? { ...x, qty: Number(e.target.value) } : x) })} className="border rounded-lg px-3 py-2" />
                                <input type="number" value={l.price} onChange={(e) => setPoForm({ ...poForm, lines: poForm.lines.map((x: any, i: number) => i === idx ? { ...x, price: Number(e.target.value) } : x) })} className="border rounded-lg px-3 py-2" />
                            </div>
                        ))}
                        <button onClick={() => setPoForm({ ...poForm, lines: [...poForm.lines, { item_id: '', qty: 1, price: 0 }] })} className="px-3 py-2 bg-gray-100 rounded-lg">أضف صف</button>
                        <div className="font-bold">الإجمالي: AED {poTotal.toLocaleString('ar-AE')}</div>
                        <div className="flex justify-end gap-2"><button onClick={() => setShowPoModal(false)} className="px-4 py-2 border rounded-lg">إلغاء</button><button onClick={savePo} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">حفظ</button></div>
                    </div>
                </div>
            )}

            {showExpModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-white rounded-xl p-5 space-y-3">
                        <h2 className="font-black">إضافة مصروف</h2>
                        <input placeholder="الوصف" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        <input placeholder="الفئة" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        <input type="number" placeholder="المبلغ" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        <input type="date" value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        <div className="flex justify-end gap-2"><button onClick={() => setShowExpModal(false)} className="px-4 py-2 border rounded-lg">إلغاء</button><button onClick={saveExpense} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">حفظ</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}
