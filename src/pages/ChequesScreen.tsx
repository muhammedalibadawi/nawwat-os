import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Banknote, Loader2 } from 'lucide-react';

type Direction = 'received' | 'issued';
type ChqStatus = 'pending' | 'deposited' | 'cleared' | 'bounced' | 'cancelled' | 'legal';

const STATUS_LABEL: Record<ChqStatus, { ar: string; className: string }> = {
    pending: { ar: 'معلق', className: 'bg-gray-200 text-gray-800' },
    deposited: { ar: 'تم الإيداع', className: 'bg-blue-100 text-blue-800' },
    cleared: { ar: 'تم التحصيل', className: 'bg-emerald-100 text-emerald-800' },
    bounced: { ar: 'مرتجع', className: 'bg-red-100 text-red-700' },
    cancelled: { ar: 'ملغي', className: 'bg-gray-100 text-gray-500' },
    legal: { ar: 'إجراء قانوني', className: 'bg-red-900 text-white' },
};

export default function ChequesScreen() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Direction>('received');
    const [rows, setRows] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [statusModal, setStatusModal] = useState<any | null>(null);
    const [form, setForm] = useState({
        cheque_no: '',
        bank_name: '',
        cheque_date: '',
        due_date: '',
        amount: '',
        currency: 'AED',
        contact_id: '',
        notes: '',
    });

    const load = useCallback(async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: qErr } = await supabase
                .from('cheques')
                .select('*')
                .eq('tenant_id', user.tenant_id)
                .eq('direction', tab)
                .order('created_at', { ascending: false });
            if (qErr) throw qErr;
            setRows(data ?? []);
            const { data: cts } = await supabase.from('contacts').select('id,name,type').eq('tenant_id', user.tenant_id);
            setContacts(cts ?? []);
        } catch (e: any) {
            setError(e?.message ?? 'فشل التحميل');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [user?.tenant_id, tab]);

    useEffect(() => {
        load();
    }, [load]);

    const kpis = useMemo(() => {
        const list = rows;
        const total = list.reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const cleared = list.filter((r) => r.status === 'cleared').reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const bounced = list.filter((r) => r.status === 'bounced').reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const pending = list.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount ?? 0), 0);
        return { total, cleared, bounced, pending };
    }, [rows]);

    const saveCheque = async () => {
        if (!user?.tenant_id || !user?.id) return;
        setSaving(true);
        setError('');
        try {
            const { error: insErr } = await supabase.from('cheques').insert({
                tenant_id: user.tenant_id,
                direction: tab,
                cheque_no: form.cheque_no || null,
                bank_name: form.bank_name || null,
                cheque_date: form.cheque_date || null,
                due_date: form.due_date || null,
                amount: Number(form.amount || 0),
                currency: form.currency || 'AED',
                contact_id: form.contact_id || null,
                notes: form.notes || null,
                status: 'pending',
                created_by: user.id,
            });
            if (insErr) throw insErr;
            setShowModal(false);
            setForm({
                cheque_no: '',
                bank_name: '',
                cheque_date: '',
                due_date: '',
                amount: '',
                currency: 'AED',
                contact_id: '',
                notes: '',
            });
            await load();
        } catch (e: any) {
            setError(e?.message ?? 'فشل الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (id: string, status: ChqStatus) => {
        if (!user?.tenant_id) return;
        try {
            const { error: uErr } = await supabase.from('cheques').update({ status }).eq('id', id).eq('tenant_id', user.tenant_id);
            if (uErr) throw uErr;
            setStatusModal(null);
            await load();
        } catch (e: any) {
            setError(e?.message ?? 'فشل التحديث');
        }
    };

    const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name || '—';

    return (
        <div className="p-6 space-y-6 font-arabic" dir="rtl">
            <div className="flex items-center gap-2">
                <Banknote className="text-cyan-600" />
                <h1 className="text-2xl font-black text-[#071C3B]">الشيكات</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 font-bold">إجمالي ({tab === 'received' ? 'مستلمة' : 'صادرة'})</p>
                    <p className="text-xl font-black text-[#071C3B]">{kpis.total.toLocaleString('ar-AE', { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p className="text-xs text-emerald-800 font-bold">المحصلة</p>
                    <p className="text-xl font-black text-emerald-800">{kpis.cleared.toLocaleString('ar-AE', { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <p className="text-xs text-red-800 font-bold">المرتجعة</p>
                    <p className="text-xl font-black text-red-800">{kpis.bounced.toLocaleString('ar-AE', { maximumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-gray-50 border rounded-xl p-4">
                    <p className="text-xs text-gray-700 font-bold">المعلقة</p>
                    <p className="text-xl font-black text-gray-900">{kpis.pending.toLocaleString('ar-AE', { maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => setTab('received')}
                    className={`px-4 py-2 rounded-xl font-bold ${tab === 'received' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}
                >
                    شيكات مستلمة
                </button>
                <button
                    type="button"
                    onClick={() => setTab('issued')}
                    className={`px-4 py-2 rounded-xl font-bold ${tab === 'issued' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}
                >
                    شيكات صادرة
                </button>
                <button type="button" onClick={() => setShowModal(true)} className="ms-auto px-4 py-2 rounded-xl bg-cyan-500 text-white font-bold">
                    إضافة شيك
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="animate-spin" size={20} /> جاري التحميل...
                </div>
            )}
            {error && <div className="text-red-600 font-bold">{error}</div>}

            {!loading && !error && rows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 border border-dashed rounded-2xl bg-gray-50/80">
                    <Banknote size={48} className="opacity-40 mb-3" />
                    <p className="font-bold">لا توجد شيكات بعد</p>
                </div>
            )}

            {!loading && rows.length > 0 && (
                <div className="overflow-x-auto bg-white border rounded-2xl shadow-sm">
                    <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="p-3 text-start">رقم الشيك</th>
                                <th className="p-3 text-start">البنك</th>
                                <th className="p-3 text-start">التاريخ</th>
                                <th className="p-3 text-start">الاستحقاق</th>
                                <th className="p-3 text-start">المبلغ</th>
                                <th className="p-3 text-start">الجهة</th>
                                <th className="p-3 text-start">الحالة</th>
                                <th className="p-3 text-start"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t hover:bg-gray-50/80">
                                    <td className="p-3 font-mono font-bold">{r.cheque_no || '—'}</td>
                                    <td className="p-3">{r.bank_name || '—'}</td>
                                    <td className="p-3">{r.cheque_date || '—'}</td>
                                    <td className="p-3">{r.due_date || '—'}</td>
                                    <td className="p-3 font-bold">
                                        {r.currency} {Number(r.amount ?? 0).toLocaleString('ar-AE')}
                                    </td>
                                    <td className="p-3">{contactName(r.contact_id)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${STATUS_LABEL[r.status as ChqStatus]?.className || 'bg-gray-100'}`}>
                                            {STATUS_LABEL[r.status as ChqStatus]?.ar || r.status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <button type="button" className="text-xs font-bold text-cyan-700 underline" onClick={() => setStatusModal(r)}>
                                            تحديث الحالة
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3 shadow-xl">
                        <h3 className="font-black text-lg">شيك جديد ({tab === 'received' ? 'مستلم' : 'صادر'})</h3>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="رقم الشيك" value={form.cheque_no} onChange={(e) => setForm({ ...form, cheque_no: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="اسم البنك" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" className="border rounded-lg px-3 py-2" value={form.cheque_date} onChange={(e) => setForm({ ...form, cheque_date: e.target.value })} />
                            <input type="date" className="border rounded-lg px-3 py-2" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" className="border rounded-lg px-3 py-2" placeholder="المبلغ" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                            <select className="border rounded-lg px-3 py-2" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                                {['AED', 'SAR', 'USD', 'EUR', 'BHD', 'OMR', 'KWD', 'QAR', 'EGP'].map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <select className="w-full border rounded-lg px-3 py-2" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })}>
                            <option value="">— عميل / مورد —</option>
                            {contacts.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.type})
                                </option>
                            ))}
                        </select>
                        <textarea className="w-full border rounded-lg px-3 py-2" rows={2} placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        <div className="flex justify-end gap-2">
                            <button type="button" className="px-4 py-2 border rounded-lg font-bold" onClick={() => setShowModal(false)}>
                                إلغاء
                            </button>
                            <button type="button" disabled={saving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg font-bold" onClick={saveCheque}>
                                {saving ? '...' : 'حفظ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {statusModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3">
                        <h4 className="font-black">تحديث حالة الشيك</h4>
                        <div className="flex flex-col gap-2">
                            {(Object.keys(STATUS_LABEL) as ChqStatus[]).map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    className="px-3 py-2 rounded-lg border text-start font-bold hover:bg-gray-50"
                                    onClick={() => updateStatus(statusModal.id, st)}
                                >
                                    {STATUS_LABEL[st].ar}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="w-full py-2 border rounded-lg font-bold" onClick={() => setStatusModal(null)}>
                            إلغاء
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
