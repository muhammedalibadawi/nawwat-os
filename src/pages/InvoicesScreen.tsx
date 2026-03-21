import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateInvoicePDF } from '../utils/generateInvoicePDF';

type InvoiceStatus = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue' | 'sent';

type LineForm = { description: string; quantity: string; unit_price: string; tax_rate: string };

const VAT = 5;

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
function dueDefault() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
}

export default function InvoicesScreen() {
    const { user } = useAuth();
    const [rows, setRows] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('all');

    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createForm, setCreateForm] = useState({
        contact_id: '',
        new_contact_name: '',
        issue_date: todayISO(),
        due_date: dueDefault(),
        invoice_kind: 'sale' as 'sale' | 'service',
        notes: '',
    });
    const [lines, setLines] = useState<LineForm[]>([
        { description: '', quantity: '1', unit_price: '0', tax_rate: String(VAT) },
    ]);

    const [payModal, setPayModal] = useState<any | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('cash');
    const [payDate, setPayDate] = useState(todayISO());
    const [paySaving, setPaySaving] = useState(false);

    const loadInvoices = async () => {
        if (!user?.tenant_id) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { data, error: queryError } = await supabase
                .from('invoices')
                .select('id,invoice_no,total,status,created_at,amount_paid,issue_date,due_date,contact_id,invoice_type')
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false });
            if (queryError) throw queryError;
            setRows(data ?? []);
        } catch (err: any) {
            setRows([]);
            setError(err?.message ?? 'فشل تحميل الفواتير');
        } finally {
            setLoading(false);
        }
    };

    const loadContacts = async () => {
        if (!user?.tenant_id) return;
        const { data } = await supabase
            .from('contacts')
            .select('id,name,email,type')
            .eq('tenant_id', user.tenant_id)
            .in('type', ['customer', 'lead'])
            .order('name');
        setContacts(data ?? []);
    };

    useEffect(() => {
        loadInvoices();
    }, [user?.tenant_id]);

    useEffect(() => {
        loadContacts();
    }, [user?.tenant_id]);

    const filtered = useMemo(() => {
        if (statusFilter === 'all') return rows;
        if (statusFilter === 'unpaid') return rows.filter((r) => ['unpaid', 'sent', 'overdue'].includes(String(r.status || '').toLowerCase()));
        return rows.filter((r) => String(r.status || '').toLowerCase() === statusFilter);
    }, [rows, statusFilter]);

    const badgeClass = (status: string) => {
        const key = String(status || '').toLowerCase();
        if (key === 'paid') return 'bg-emerald-100 text-emerald-700';
        if (key === 'partial') return 'bg-amber-100 text-amber-700';
        if (key === 'overdue') return 'bg-red-100 text-red-700';
        return 'bg-gray-100 text-gray-700';
    };

    const nextInvoiceNo = async (): Promise<string> => {
        if (!user?.tenant_id) return `INV-${new Date().getFullYear()}-001`;
        const year = new Date().getFullYear();
        const { data } = await supabase
            .from('invoices')
            .select('invoice_no')
            .eq('tenant_id', user.tenant_id)
            .ilike('invoice_no', `INV-${year}-%`);
        let maxN = 0;
        (data ?? []).forEach((row: any) => {
            const m = String(row.invoice_no || '').match(/INV-\d{4}-(\d+)/i);
            if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
        });
        const next = maxN + 1;
        return `INV-${year}-${String(next).padStart(3, '0')}`;
    };

    const lineTotals = (l: LineForm) => {
        const q = Number(l.quantity || 0);
        const p = Number(l.unit_price || 0);
        const tr = Number(l.tax_rate || 0);
        const net = q * p;
        const tax = (net * tr) / 100;
        const lineTotal = net + tax;
        return { net, tax, lineTotal };
    };

    const createSummary = useMemo(() => {
        let sub = 0;
        let tax = 0;
        lines.forEach((l) => {
            const t = lineTotals(l);
            sub += t.net;
            tax += t.tax;
        });
        return { subtotal: sub, tax, total: sub + tax };
    }, [lines]);

    const saveInvoice = async () => {
        if (!user?.tenant_id) return;
        setSaving(true);
        setError('');
        try {
            let contactId = createForm.contact_id || null;
            if (!contactId && createForm.new_contact_name.trim()) {
                const { data: ins, error: cErr } = await supabase
                    .from('contacts')
                    .insert({
                        tenant_id: user.tenant_id,
                        name: createForm.new_contact_name.trim(),
                        type: 'customer',
                    })
                    .select('id')
                    .single();
                if (cErr) throw cErr;
                contactId = ins?.id ?? null;
                await loadContacts();
            }
            if (!contactId) {
                setError('اختر عميلاً أو أدخل اسم عميل جديد');
                setSaving(false);
                return;
            }

            const invNo = await nextInvoiceNo();
            const { subtotal, tax, total } = createSummary;
            const statusIssued = 'sent';
            const { data: inv, error: invErr } = await supabase
                .from('invoices')
                .insert({
                    tenant_id: user.tenant_id,
                    invoice_no: invNo,
                    invoice_type: 'sale',
                    status: statusIssued,
                    contact_id: contactId,
                    issue_date: createForm.issue_date,
                    due_date: createForm.due_date,
                    subtotal,
                    tax_amount: tax,
                    total,
                    amount_paid: 0,
                    notes: createForm.notes || null,
                })
                .select('id')
                .single();
            if (invErr) throw invErr;

            const itemRows = lines
                .filter((l) => l.description.trim())
                .map((l, idx) => {
                    const t = lineTotals(l);
                    return {
                        tenant_id: user.tenant_id,
                        invoice_id: inv.id,
                        name: l.description.trim(),
                        quantity: Number(l.quantity || 0),
                        unit_price: Number(l.unit_price || 0),
                        tax_rate: Number(l.tax_rate || 0),
                        tax_amount: t.tax,
                        net_amount: t.net,
                        line_total: t.lineTotal,
                        sort_order: idx,
                    };
                });
            if (itemRows.length === 0) throw new Error('أضف صنفاً واحداً على الأقل');
            const { error: liErr } = await supabase.from('invoice_items').insert(itemRows);
            if (liErr) throw liErr;

            setShowCreate(false);
            setCreateForm({
                contact_id: '',
                new_contact_name: '',
                issue_date: todayISO(),
                due_date: dueDefault(),
                invoice_kind: 'sale',
                notes: '',
            });
            setLines([{ description: '', quantity: '1', unit_price: '0', tax_rate: String(VAT) }]);
            await loadInvoices();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حفظ الفاتورة');
        } finally {
            setSaving(false);
        }
    };

    const handlePdf = async (row: any) => {
        if (!user?.tenant_id) return;
        try {
            const [tenantRes, itemsRes] = await Promise.all([
                supabase.from('tenants').select('id,name').eq('id', user.tenant_id).single(),
                supabase.from('invoice_items').select('*').eq('tenant_id', user.tenant_id).eq('invoice_id', row.id),
            ]);
            if (tenantRes.error) throw tenantRes.error;
            if (itemsRes.error) throw itemsRes.error;
            await generateInvoicePDF({ ...row, invoice_items: itemsRes.data ?? [] }, tenantRes.data);
        } catch (err: any) {
            setError(err?.message ?? 'فشل إنشاء PDF');
        }
    };

    const recordPayment = async () => {
        if (!user?.tenant_id || !payModal) return;
        const amt = Number(payAmount);
        if (!amt || amt <= 0) return;
        setPaySaving(true);
        setError('');
        try {
            const inv = payModal;
            const prev = Number(inv.amount_paid ?? 0);
            const total = Number(inv.total ?? 0);
            const newPaid = prev + amt;
            let status = inv.status;
            if (newPaid >= total) status = 'paid';
            else if (newPaid > 0) status = 'partial';

            const { error: pErr } = await supabase.from('payments').insert({
                tenant_id: user.tenant_id,
                reference_type: 'invoice',
                reference_id: inv.id,
                contact_id: inv.contact_id || null,
                amount: amt,
                method: payMethod as any,
                paid_at: new Date(`${payDate}T12:00:00`).toISOString(),
                status: 'completed',
            });
            if (pErr) throw pErr;

            const { error: uErr } = await supabase
                .from('invoices')
                .update({ amount_paid: newPaid, status })
                .eq('id', inv.id)
                .eq('tenant_id', user.tenant_id);
            if (uErr) throw uErr;

            setPayModal(null);
            setPayAmount('');
            await loadInvoices();
        } catch (err: any) {
            setError(err?.message ?? 'فشل تسجيل الدفعة');
        } finally {
            setPaySaving(false);
        }
    };

    const creditNote = async (row: any) => {
        if (!user?.tenant_id) return;
        if (!window.confirm('إنشاء إشعار دائن مرتبط بهذه الفاتورة؟')) return;
        try {
            const no = await nextInvoiceNo();
            const { error } = await supabase.from('invoices').insert({
                tenant_id: user.tenant_id,
                invoice_no: no,
                invoice_type: 'credit_note',
                status: 'sent',
                contact_id: row.contact_id,
                issue_date: todayISO(),
                due_date: row.due_date,
                subtotal: Number(row.total ?? 0),
                tax_amount: 0,
                total: Number(row.total ?? 0),
                amount_paid: 0,
                notes: `إشعار دائن عن ${row.invoice_no}`,
            });
            if (error) throw error;
            await loadInvoices();
        } catch (e: any) {
            setError(e?.message ?? 'فشل إنشاء إشعار الدائن');
        }
    };

    const whatsappPlaceholder = () => {
        alert('سيتم ربط واتساب قريباً');
    };

    const canPay = (r: any) => ['unpaid', 'partial', 'sent', 'overdue'].includes(String(r.status || '').toLowerCase());
    const isConfirmed = (r: any) => ['paid', 'sent', 'partial'].includes(String(r.status || '').toLowerCase());

    return (
        <div className="p-8 h-full text-gray-700 font-nunito" dir="rtl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <FileText size={28} className="text-cyan-600" />
                    <h1 className="text-2xl font-extrabold text-[#0A192F]">الفواتير</h1>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#071C3B] text-white font-bold text-sm"
                >
                    <Plus size={18} /> إنشاء فاتورة جديدة +
                </button>
            </div>

            <div className="mb-4 flex gap-2 flex-wrap">
                {[
                    { id: 'all', label: 'الكل' },
                    { id: 'paid', label: 'مدفوع' },
                    { id: 'partial', label: 'جزئي' },
                    { id: 'unpaid', label: 'غير مدفوع' },
                    { id: 'overdue', label: 'متأخر' },
                ].map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setStatusFilter(f.id as InvoiceStatus)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                            statusFilter === f.id ? 'bg-[#071C3B] text-white border-[#071C3B]' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {loading && <div className="p-10 text-center font-semibold text-gray-500">جاري تحميل الفواتير...</div>}
                {!loading && error && <div className="p-10 text-center font-semibold text-red-600">{error}</div>}
                {!loading && !error && filtered.length === 0 && (
                    <div className="p-10 text-center font-semibold text-gray-500">لا توجد فواتير مطابقة</div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[900px]">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="px-4 py-4 text-start">رقم الفاتورة</th>
                                    <th className="px-4 py-4 text-start">التاريخ</th>
                                    <th className="px-4 py-4 text-start">الإجمالي</th>
                                    <th className="px-4 py-4 text-start">المدفوع</th>
                                    <th className="px-4 py-4 text-start">المتبقي</th>
                                    <th className="px-4 py-4 text-start">الحالة</th>
                                    <th className="px-4 py-4 text-start">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((row) => {
                                    const total = Number(row.total ?? 0);
                                    const paid = Number(row.amount_paid ?? 0);
                                    const remaining = Math.max(0, total - paid);
                                    return (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4 font-bold text-[#071C3B]">{row.invoice_no ?? row.id}</td>
                                            <td className="px-4 py-4">
                                                {row.issue_date
                                                    ? new Date(row.issue_date).toLocaleDateString('ar-AE')
                                                    : row.created_at
                                                      ? new Date(row.created_at).toLocaleDateString('ar-AE')
                                                      : '—'}
                                            </td>
                                            <td className="px-4 py-4 font-bold">AED {total.toFixed(2)}</td>
                                            <td className="px-4 py-4">AED {paid.toFixed(2)}</td>
                                            <td className="px-4 py-4">AED {remaining.toFixed(2)}</td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${badgeClass(row.status)}`}>
                                                    {row.status ?? '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePdf(row)}
                                                        className="px-2 py-1 rounded-lg bg-[#071C3B] text-white text-xs font-bold"
                                                    >
                                                        PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={whatsappPlaceholder}
                                                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                                                    >
                                                        واتساب
                                                    </button>
                                                    {canPay(row) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPayModal(row);
                                                                setPayAmount(String(remaining.toFixed(2)));
                                                                setPayDate(todayISO());
                                                            }}
                                                            className="px-2 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold"
                                                        >
                                                            تسجيل دفعة
                                                        </button>
                                                    )}
                                                    {isConfirmed(row) && row.invoice_type !== 'credit_note' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => creditNote(row)}
                                                            className="px-2 py-1 rounded-lg border border-gray-300 text-xs font-bold"
                                                        >
                                                            إشعار دائن
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-xl">
                        <h2 className="text-xl font-black text-[#071C3B] mb-4">فاتورة جديدة</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500">العميل (من القائمة)</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 mt-1"
                                    value={createForm.contact_id}
                                    onChange={(e) => setCreateForm({ ...createForm, contact_id: e.target.value, new_contact_name: '' })}
                                >
                                    <option value="">— اختر —</option>
                                    {contacts.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">أو اسم عميل جديد</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 mt-1"
                                    value={createForm.new_contact_name}
                                    onChange={(e) => setCreateForm({ ...createForm, new_contact_name: e.target.value, contact_id: '' })}
                                    placeholder="اسم العميل"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">تاريخ الفاتورة</label>
                                <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2 mt-1"
                                    value={createForm.issue_date}
                                    onChange={(e) => setCreateForm({ ...createForm, issue_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">تاريخ الاستحقاق</label>
                                <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2 mt-1"
                                    value={createForm.due_date}
                                    onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500">نوع الفاتورة</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 mt-1"
                                    value={createForm.invoice_kind}
                                    onChange={(e) => setCreateForm({ ...createForm, invoice_kind: e.target.value as 'sale' | 'service' })}
                                >
                                    <option value="sale">بيع</option>
                                    <option value="service">خدمة</option>
                                </select>
                            </div>
                        </div>

                        <h3 className="font-bold mb-2">الأصناف</h3>
                        <table className="w-full text-xs mb-2">
                            <thead>
                                <tr className="text-gray-500">
                                    <th className="text-start py-1">الوصف</th>
                                    <th className="text-start py-1">الكمية</th>
                                    <th className="text-start py-1">السعر</th>
                                    <th className="text-start py-1">الضريبة %</th>
                                    <th className="text-start py-1">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((line, idx) => {
                                    const t = lineTotals(line);
                                    return (
                                        <tr key={idx}>
                                            <td className="pe-1">
                                                <input
                                                    className="w-full border rounded px-2 py-1"
                                                    value={line.description}
                                                    onChange={(e) =>
                                                        setLines(lines.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                                                    }
                                                    placeholder="منتج / خدمة"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="w-20 border rounded px-2 py-1"
                                                    value={line.quantity}
                                                    onChange={(e) =>
                                                        setLines(lines.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="w-24 border rounded px-2 py-1"
                                                    value={line.unit_price}
                                                    onChange={(e) =>
                                                        setLines(lines.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="w-16 border rounded px-2 py-1"
                                                    value={line.tax_rate}
                                                    onChange={(e) =>
                                                        setLines(lines.map((x, i) => (i === idx ? { ...x, tax_rate: e.target.value } : x)))
                                                    }
                                                />
                                            </td>
                                            <td className="font-bold whitespace-nowrap">{t.lineTotal.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <button
                            type="button"
                            className="mb-4 px-3 py-2 bg-gray-100 rounded-lg text-sm font-bold"
                            onClick={() => setLines([...lines, { description: '', quantity: '1', unit_price: '0', tax_rate: String(VAT) }])}
                        >
                            إضافة صنف
                        </button>

                        <div>
                            <label className="text-xs font-bold text-gray-500">ملاحظات</label>
                            <textarea
                                className="w-full border rounded-lg px-3 py-2 mt-1"
                                rows={2}
                                value={createForm.notes}
                                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                            />
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span>المجموع الفرعي</span>
                                <span className="font-bold">{createSummary.subtotal.toFixed(2)} AED</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ضريبة القيمة المضافة ({VAT}%)</span>
                                <span className="font-bold">{createSummary.tax.toFixed(2)} AED</span>
                            </div>
                            <div className="flex justify-between text-lg border-t pt-2">
                                <span className="font-black">الإجمالي</span>
                                <span className="font-black text-[#071C3B]">{createSummary.total.toFixed(2)} AED</span>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setShowCreate(false)}>
                                إلغاء
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold disabled:opacity-50"
                                onClick={saveInvoice}
                            >
                                {saving ? 'جاري الحفظ...' : 'حفظ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {payModal && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="font-black text-lg mb-3">تسجيل دفعة</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500">المبلغ</label>
                                <input
                                    type="number"
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">طريقة الدفع</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={payMethod}
                                    onChange={(e) => setPayMethod(e.target.value)}
                                >
                                    <option value="cash">نقداً</option>
                                    <option value="card">بطاقة</option>
                                    <option value="bank_transfer">تحويل بنكي</option>
                                    <option value="online">أونلاين</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">تاريخ الدفع</label>
                                <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={payDate}
                                    onChange={(e) => setPayDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setPayModal(null)}>
                                إلغاء
                            </button>
                            <button
                                type="button"
                                disabled={paySaving}
                                className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold"
                                onClick={recordPayment}
                            >
                                {paySaving ? '...' : 'تأكيد'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
