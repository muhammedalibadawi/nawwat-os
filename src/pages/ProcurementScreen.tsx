import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type PoStatus = 'draft' | 'pending' | 'approved' | 'received' | 'cancelled';

async function getOwnerUserId(tenantId: string): Promise<string | null> {
    const { data: roleRow } = await supabase.from('roles').select('id').eq('tenant_id', tenantId).eq('name', 'owner').maybeSingle();
    if (!roleRow?.id) return null;
    const { data: ur } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role_id', roleRow.id)
        .limit(1)
        .maybeSingle();
    return ur?.user_id ?? null;
}

export default function ProcurementScreen() {
    const { user } = useAuth();
    const [tab, setTab] = useState<'po' | 'expenses'>('po');
    const [poRows, setPoRows] = useState<any[]>([]);
    const [expenseRows, setExpenseRows] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [itemsById, setItemsById] = useState<Record<string, string>>({});
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | PoStatus>('all');
    const [showPoModal, setShowPoModal] = useState(false);
    const [showExpModal, setShowExpModal] = useState(false);
    const [poForm, setPoForm] = useState<any>({
        supplier_id: '',
        issue_date: '',
        expected_delivery_date: '',
        lines: [{ item_id: '', qty: 1, price: 0 }],
    });
    const [expForm, setExpForm] = useState<any>({ description: '', category: '', amount: '', expense_date: '' });

    const [receiptPo, setReceiptPo] = useState<any | null>(null);
    const [receiptLines, setReceiptLines] = useState<{ id: string; item_id: string; quantity: number; received: string; name: string }[]>([]);
    const [receiptWarehouse, setReceiptWarehouse] = useState('');
    const [receiptNotes, setReceiptNotes] = useState('');
    const [receiptSaving, setReceiptSaving] = useState(false);

    const canApprove = user?.role === 'owner' || user?.role === 'master_admin';

    const load = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const [poRes, expRes, supRes, itemsRes, whRes] = await Promise.all([
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
                supabase.from('items').select('id,name').eq('tenant_id', user.tenant_id).limit(500),
                supabase.from('warehouses').select('id,name,name_ar').eq('tenant_id', user.tenant_id).eq('is_active', true),
            ]);
            if (poRes.error) throw poRes.error;
            if (expRes.error) throw expRes.error;
            if (supRes.error) throw supRes.error;
            if (itemsRes.error) throw itemsRes.error;
            if (whRes.error) throw whRes.error;
            setPoRows(poRes.data ?? []);
            setExpenseRows(expRes.data ?? []);
            setSuppliers(supRes.data ?? []);
            const imap: Record<string, string> = {};
            (itemsRes.data ?? []).forEach((it: any) => {
                imap[it.id] = it.name;
            });
            setItemsById(imap);
            setWarehouses(whRes.data ?? []);
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
            const basePayload: Record<string, unknown> = {
                tenant_id: user.tenant_id,
                supplier_id: poForm.supplier_id || null,
                issue_date: poForm.issue_date || null,
                total_amount: poTotal,
                status: 'draft',
            };
            if (poForm.expected_delivery_date) {
                basePayload.expected_delivery_date = poForm.expected_delivery_date;
            }
            let { data: po, error: poErr } = await supabase.from('purchase_orders').insert(basePayload).select('id').single();
            if (
                poErr &&
                poForm.expected_delivery_date &&
                /expected_delivery_date|Could not find.*column/i.test(String(poErr.message || ''))
            ) {
                const fallback = { ...basePayload };
                delete fallback.expected_delivery_date;
                fallback.issue_date = poForm.issue_date || poForm.expected_delivery_date || null;
                const retry = await supabase.from('purchase_orders').insert(fallback).select('id').single();
                po = retry.data;
                poErr = retry.error;
            }
            if (poErr) throw poErr;
            if (!po) throw new Error('تعذر إنشاء أمر الشراء');
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
            setPoForm({
                supplier_id: '',
                issue_date: '',
                expected_delivery_date: '',
                lines: [{ item_id: '', qty: 1, price: 0 }],
            });
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

    const submitForApproval = async (po: any) => {
        if (!user?.tenant_id) return;
        try {
            const { error } = await supabase.from('purchase_orders').update({ status: 'pending' }).eq('id', po.id).eq('tenant_id', user.tenant_id);
            if (error) throw error;
            const ownerId = await getOwnerUserId(user.tenant_id);
            await supabase.from('notifications').insert({
                tenant_id: user.tenant_id,
                user_id: ownerId,
                type: 'push',
                title: 'طلب موافقة على أمر شراء',
                body: `أمر شراء رقم ${po.po_number || po.id} ينتظر موافقتك`,
                status: 'pending',
            });
            await load();
        } catch (e: any) {
            setError(e?.message ?? 'فشل الإرسال');
        }
    };

    const openReceipt = async (po: any) => {
        if (!user?.tenant_id) return;
        const { data: lines, error } = await supabase
            .from('purchase_items')
            .select('id,item_id,quantity')
            .eq('tenant_id', user.tenant_id)
            .eq('po_id', po.id);
        if (error) {
            setError(error.message);
            return;
        }
        setReceiptPo(po);
        setReceiptLines(
            (lines ?? []).map((l: any) => ({
                id: l.id,
                item_id: l.item_id,
                quantity: Number(l.quantity ?? 0),
                received: String(l.quantity ?? 0),
                name: itemsById[l.item_id] || l.item_id,
            }))
        );
        setReceiptWarehouse(warehouses[0]?.id || '');
        setReceiptNotes('');
    };

    const saveReceipt = async () => {
        if (!user?.tenant_id || !user?.id || !receiptPo || !receiptWarehouse) return;
        setReceiptSaving(true);
        setError('');
        try {
            for (const line of receiptLines) {
                const q = Number(line.received || 0);
                if (q <= 0) continue;
                const unitCost = 0;
                const { error: movErr } = await supabase.from('inventory_movements').insert({
                    tenant_id: user.tenant_id,
                    item_id: line.item_id,
                    warehouse_id: receiptWarehouse,
                    movement_type: 'purchase_receipt',
                    quantity: q,
                    unit_cost: unitCost,
                    total_cost: q * unitCost,
                    reference_type: 'purchase_order',
                    reference_id: receiptPo.id,
                    notes: receiptNotes || null,
                    created_by: user.id,
                });
                if (movErr) throw movErr;
            }
            const { error: upErr } = await supabase
                .from('purchase_orders')
                .update({ status: 'received' })
                .eq('id', receiptPo.id)
                .eq('tenant_id', user.tenant_id);
            if (upErr) throw upErr;
            setReceiptPo(null);
            alert('تم الاستلام وتحديث المخزون');
            await load();
        } catch (e: any) {
            setError(e?.message ?? 'فشل الاستلام');
        } finally {
            setReceiptSaving(false);
        }
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

    const statusLabel: Record<string, string> = {
        all: 'الكل',
        draft: 'مسودة',
        pending: 'بانتظار الموافقة',
        approved: 'معتمد',
        received: 'مستلم',
        cancelled: 'ملغى',
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-[#071C3B]">المشتريات</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowPoModal(true)} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">
                        أمر شراء جديد
                    </button>
                    <button onClick={() => setShowExpModal(true)} className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-bold">
                        إضافة مصروف
                    </button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setTab('po')} className={`px-3 py-2 rounded-lg ${tab === 'po' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>
                    أوامر الشراء
                </button>
                <button onClick={() => setTab('expenses')} className={`px-3 py-2 rounded-lg ${tab === 'expenses' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>
                    المصروفات
                </button>
            </div>

            {loading && <div className="animate-pulse space-y-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div></div>}
            {!loading && error && <div className="text-red-600 font-bold">{error}</div>}

            {!loading && !error && tab === 'po' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white border rounded-xl p-3">إجمالي الطلبات: {poKpis.total.toLocaleString('ar-AE')}</div>
                        <div className="bg-white border rounded-xl p-3">المسودة: {poKpis.draft.toLocaleString('ar-AE')}</div>
                        <div className="bg-white border rounded-xl p-3">المكتملة: {poKpis.received.toLocaleString('ar-AE')}</div>
                        <div className="bg-white border rounded-xl p-3">إجمالي القيمة: AED {poKpis.value.toLocaleString('ar-AE')}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {(['all', 'draft', 'pending', 'approved', 'received', 'cancelled'] as const).map((s) => (
                            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg ${statusFilter === s ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>
                                {statusLabel[s]}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white border rounded-xl overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-start">رقم أمر الشراء</th>
                                    <th className="p-3 text-start">المورد</th>
                                    <th className="p-3 text-start">التاريخ</th>
                                    <th className="p-3 text-start">الإجمالي</th>
                                    <th className="p-3 text-start">الحالة</th>
                                    <th className="p-3 text-start">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPo.map((r) => (
                                    <tr key={r.id} className="border-t">
                                        <td className="p-3">{r.po_number || r.id}</td>
                                        <td className="p-3">{suppliers.find((s) => s.id === r.supplier_id)?.name || r.supplier_id || '—'}</td>
                                        <td className="p-3">{r.issue_date || '—'}</td>
                                        <td className="p-3">AED {Number(r.total_amount || 0).toLocaleString('ar-AE')}</td>
                                        <td className="p-3">{statusLabel[String(r.status)] || r.status}</td>
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1">
                                                {r.status === 'draft' && (
                                                    <button onClick={() => submitForApproval(r)} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">
                                                        إرسال للموافقة
                                                    </button>
                                                )}
                                                {canApprove && r.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => updatePoStatus(r.id, 'approved')} className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">
                                                            اعتماد
                                                        </button>
                                                        <button onClick={() => updatePoStatus(r.id, 'cancelled')} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                                                            رفض
                                                        </button>
                                                    </>
                                                )}
                                                {r.status === 'approved' && (
                                                    <button onClick={() => openReceipt(r)} className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs font-bold">
                                                        استلام بضاعة
                                                    </button>
                                                )}
                                                {r.status === 'draft' && (
                                                    <button onClick={() => updatePoStatus(r.id, 'approved')} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                        اعتماد مباشر
                                                    </button>
                                                )}
                                                <button onClick={() => updatePoStatus(r.id, 'cancelled')} className="px-2 py-1 bg-red-100 rounded text-red-700 text-xs">
                                                    إلغاء
                                                </button>
                                            </div>
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
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-start">الوصف</th>
                                <th className="p-3 text-start">الفئة</th>
                                <th className="p-3 text-start">المبلغ</th>
                                <th className="p-3 text-start">التاريخ</th>
                                <th className="p-3 text-start">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenseRows.map((e) => (
                                <tr key={e.id} className="border-t">
                                    <td className="p-3">{e.description}</td>
                                    <td className="p-3">{e.category}</td>
                                    <td className="p-3">{Number(e.amount || 0).toLocaleString('ar-AE')}</td>
                                    <td className="p-3">{e.expense_date || '—'}</td>
                                    <td className="p-3">{e.status || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showPoModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-white rounded-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
                        <h2 className="font-black">أمر شراء جديد</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })} className="border rounded-lg px-3 py-2">
                                <option value="">اختر مورد</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                            <input type="date" value={poForm.issue_date} onChange={(e) => setPoForm({ ...poForm, issue_date: e.target.value })} className="border rounded-lg px-3 py-2" />
                            <input
                                type="date"
                                value={poForm.expected_delivery_date}
                                onChange={(e) => setPoForm({ ...poForm, expected_delivery_date: e.target.value })}
                                className="border rounded-lg px-3 py-2"
                            />
                        </div>
                        {poForm.lines.map((l: any, idx: number) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <select
                                    value={l.item_id}
                                    onChange={(e) =>
                                        setPoForm({
                                            ...poForm,
                                            lines: poForm.lines.map((x: any, i: number) => (i === idx ? { ...x, item_id: e.target.value } : x)),
                                        })
                                    }
                                    className="border rounded-lg px-3 py-2"
                                >
                                    <option value="">اختر صنفاً</option>
                                    {Object.entries(itemsById).map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={l.qty}
                                    onChange={(e) =>
                                        setPoForm({
                                            ...poForm,
                                            lines: poForm.lines.map((x: any, i: number) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)),
                                        })
                                    }
                                    className="border rounded-lg px-3 py-2"
                                />
                                <input
                                    type="number"
                                    value={l.price}
                                    onChange={(e) =>
                                        setPoForm({
                                            ...poForm,
                                            lines: poForm.lines.map((x: any, i: number) => (i === idx ? { ...x, price: Number(e.target.value) } : x)),
                                        })
                                    }
                                    className="border rounded-lg px-3 py-2"
                                />
                            </div>
                        ))}
                        <button onClick={() => setPoForm({ ...poForm, lines: [...poForm.lines, { item_id: '', qty: 1, price: 0 }] })} className="px-3 py-2 bg-gray-100 rounded-lg">
                            أضف صف
                        </button>
                        <div className="font-bold">الإجمالي: AED {poTotal.toLocaleString('ar-AE')}</div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowPoModal(false)} className="px-4 py-2 border rounded-lg">
                                إلغاء
                            </button>
                            <button onClick={savePo} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {receiptPo && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
                        <h2 className="font-black">استلام بضاعة — {receiptPo.po_number || receiptPo.id}</h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500">
                                    <th className="text-start py-2">الصنف</th>
                                    <th className="text-start">المطلوب</th>
                                    <th className="text-start">المستلم</th>
                                </tr>
                            </thead>
                            <tbody>
                                {receiptLines.map((line) => (
                                    <tr key={line.id} className="border-t">
                                        <td className="py-2">{line.name}</td>
                                        <td>{line.quantity}</td>
                                        <td>
                                            <input
                                                type="number"
                                                className="border rounded px-2 py-1 w-24"
                                                value={line.received}
                                                onChange={(e) =>
                                                    setReceiptLines((prev) =>
                                                        prev.map((x) => (x.id === line.id ? { ...x, received: e.target.value } : x))
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div>
                            <label className="text-xs font-bold text-gray-500">المستودع</label>
                            <select
                                className="w-full border rounded-lg px-3 py-2 mt-1"
                                value={receiptWarehouse}
                                onChange={(e) => setReceiptWarehouse(e.target.value)}
                            >
                                <option value="">اختر مستودعاً</option>
                                {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name_ar || w.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <textarea
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="ملاحظات"
                            value={receiptNotes}
                            onChange={(e) => setReceiptNotes(e.target.value)}
                            rows={2}
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setReceiptPo(null)}>
                                إلغاء
                            </button>
                            <button
                                type="button"
                                disabled={receiptSaving}
                                onClick={saveReceipt}
                                className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold disabled:opacity-50"
                            >
                                {receiptSaving ? '...' : 'حفظ الاستلام'}
                            </button>
                        </div>
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
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowExpModal(false)} className="px-4 py-2 border rounded-lg">
                                إلغاء
                            </button>
                            <button onClick={saveExpense} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
