import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ContactType = 'customer' | 'supplier' | 'lead' | 'employee' | 'other';
interface ContactRow {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: ContactType;
    notes: string | null;
    created_at: string;
    tenant_id: string;
    pipeline_stage?: string | null;
    expected_value?: number | null;
    last_contact_at?: string | null;
}

const STAGES: { id: string; label: string }[] = [
    { id: 'new', label: 'جديد' },
    { id: 'qualified', label: 'مؤهل' },
    { id: 'proposal', label: 'عرض سعر' },
    { id: 'negotiation', label: 'تفاوض' },
    { id: 'closed', label: 'مغلق' },
];

const CRMScreen: React.FC = () => {
    const { user } = useAuth();
    const [mainTab, setMainTab] = useState<'contacts' | 'pipeline'>('contacts');
    const [rows, setRows] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'customer' as ContactType });
    const [saving, setSaving] = useState(false);

    const [showOppModal, setShowOppModal] = useState(false);
    const [oppForm, setOppForm] = useState({ name: '', email: '', expected_value: '', stage: 'new' });
    const [dragId, setDragId] = useState<string | null>(null);

    const loadContacts = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: qErr } = await supabase
                .from('contacts')
                .select(
                    'id,name,email,phone,type,created_at,notes,tenant_id,pipeline_stage,expected_value,last_contact_at'
                )
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false });
            if (qErr) throw qErr;
            setRows((data ?? []) as ContactRow[]);
        } catch (err: any) {
            setError(err?.message ?? 'فشل تحميل العملاء');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContacts();
    }, [user?.tenant_id]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        let list = rows;
        if (!q) return list;
        return list.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q));
    }, [rows, search]);

    const pipelineRows = useMemo(() => rows.filter((r) => r.type === 'lead'), [rows]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: '', email: '', phone: '', type: 'customer' });
        setShowModal(true);
    };

    const openEdit = (r: ContactRow) => {
        setEditingId(r.id);
        setForm({ name: r.name || '', email: r.email || '', phone: r.phone || '', type: (r.type || 'customer') as ContactType });
        setShowModal(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        if (!form.name.trim()) return;
        setSaving(true);
        setError('');
        try {
            const payload = {
                tenant_id: user.tenant_id,
                name: form.name.trim(),
                email: form.email.trim() || null,
                phone: form.phone.trim() || null,
                type: form.type,
            };
            if (editingId) {
                const { error: updErr } = await supabase.from('contacts').update(payload).eq('id', editingId).eq('tenant_id', user.tenant_id);
                if (updErr) throw updErr;
            } else {
                const { error: insErr } = await supabase.from('contacts').insert(payload);
                if (insErr) throw insErr;
            }
            setShowModal(false);
            await loadContacts();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حفظ العميل');
        } finally {
            setSaving(false);
        }
    };

    const saveOpportunity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        if (!oppForm.name.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('contacts').insert({
                tenant_id: user.tenant_id,
                name: oppForm.name.trim(),
                email: oppForm.email.trim() || null,
                type: 'lead',
                pipeline_stage: oppForm.stage,
                expected_value: oppForm.expected_value ? Number(oppForm.expected_value) : null,
                last_contact_at: new Date().toISOString(),
            });
            if (error) throw error;
            setShowOppModal(false);
            setOppForm({ name: '', email: '', expected_value: '', stage: 'new' });
            await loadContacts();
        } catch (err: any) {
            setError(err?.message ?? 'فشل الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const onDragStart = (id: string) => setDragId(id);
    const onDragEnd = () => setDragId(null);

    const onDropStage = async (stageId: string) => {
        if (!dragId || !user?.tenant_id) return;
        const prev = rows.find((r) => r.id === dragId);
        try {
            const { error } = await supabase
                .from('contacts')
                .update({ pipeline_stage: stageId, last_contact_at: new Date().toISOString() })
                .eq('id', dragId)
                .eq('tenant_id', user.tenant_id);
            if (error) throw error;
            if (stageId === 'closed' && prev?.pipeline_stage !== 'closed') {
                confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            }
            setDragId(null);
            await loadContacts();
        } catch (err: any) {
            setError(err?.message ?? 'فشل التحديث');
        }
    };

    const remove = async (id: string) => {
        if (!user?.tenant_id) return;
        if (!window.confirm('تأكيد حذف العميل؟')) return;
        try {
            const { error: delErr } = await supabase.from('contacts').delete().eq('id', id).eq('tenant_id', user.tenant_id);
            if (delErr) throw delErr;
            await loadContacts();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حذف العميل');
        }
    };

    const cardsByStage = (stageId: string) =>
        pipelineRows.filter((r) => (r.pipeline_stage || 'new') === stageId);

    return (
        <div className="p-6 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h1 className="text-2xl font-black text-[#071C3B]">إدارة العملاء</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMainTab('contacts')}
                        className={`px-4 py-2 rounded-lg font-bold ${mainTab === 'contacts' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}
                    >
                        جهات الاتصال
                    </button>
                    <button
                        onClick={() => setMainTab('pipeline')}
                        className={`px-4 py-2 rounded-lg font-bold ${mainTab === 'pipeline' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}
                    >
                        Pipeline
                    </button>
                </div>
            </div>

            {mainTab === 'contacts' && (
                <>
                    <div className="flex justify-end">
                        <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">
                            إضافة عميل
                        </button>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="بحث بالاسم أو الإيميل"
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>

                    {loading && <div className="bg-white rounded-xl border p-6 text-center">جاري التحميل...</div>}
                    {!loading && error && <div className="bg-white rounded-xl border p-6 text-center text-red-600">{error}</div>}
                    {!loading && !error && filtered.length === 0 && <div className="bg-white rounded-xl border p-6 text-center">لا توجد بيانات</div>}

                    {!loading && !error && filtered.length > 0 && (
                        <div className="bg-white rounded-xl border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-start">الاسم</th>
                                        <th className="p-3 text-start">الإيميل</th>
                                        <th className="p-3 text-start">الهاتف</th>
                                        <th className="p-3 text-start">النوع</th>
                                        <th className="p-3 text-start">التاريخ</th>
                                        <th className="p-3 text-start">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((r) => (
                                        <tr key={r.id} className="border-t">
                                            <td className="p-3 font-bold">{r.name}</td>
                                            <td className="p-3">{r.email || '—'}</td>
                                            <td className="p-3">{r.phone || '—'}</td>
                                            <td className="p-3">{r.type}</td>
                                            <td className="p-3">{new Date(r.created_at).toLocaleDateString('ar-AE')}</td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => openEdit(r)} className="px-3 py-1 rounded bg-cyan-50 text-cyan-700">
                                                        تعديل
                                                    </button>
                                                    <button onClick={() => remove(r.id)} className="px-3 py-1 rounded bg-red-50 text-red-700">
                                                        حذف
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {mainTab === 'pipeline' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowOppModal(true)} className="px-4 py-2 rounded-lg bg-[#00CFFF] text-[#071C3B] font-bold">
                            إضافة فرصة جديدة
                        </button>
                    </div>
                    {error && <div className="text-red-600 font-bold">{error}</div>}
                    <div className="flex gap-3 overflow-x-auto pb-4">
                        {STAGES.map((col) => (
                            <div
                                key={col.id}
                                className="min-w-[220px] flex-1 bg-gray-50 rounded-xl border border-gray-200 p-3"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => onDropStage(col.id)}
                            >
                                <h3 className="font-black text-sm mb-3 text-[#071C3B]">{col.label}</h3>
                                <div className="space-y-2 min-h-[120px]">
                                    {cardsByStage(col.id).map((c) => (
                                        <div
                                            key={c.id}
                                            draggable
                                            onDragStart={() => onDragStart(c.id)}
                                            onDragEnd={onDragEnd}
                                            className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm cursor-grab active:cursor-grabbing"
                                        >
                                            <div className="font-bold text-sm">{c.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                القيمة: AED {Number(c.expected_value ?? 0).toLocaleString('ar-AE')}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                آخر تواصل:{' '}
                                                {c.last_contact_at
                                                    ? new Date(c.last_contact_at).toLocaleDateString('ar-AE')
                                                    : '—'}
                                            </div>
                                            <button type="button" className="mt-2 text-xs text-cyan-600 font-bold">
                                                تفاصيل
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
                    <form onSubmit={save} className="w-full max-w-lg bg-white rounded-xl p-5 space-y-3">
                        <h2 className="text-lg font-black">{editingId ? 'تعديل عميل' : 'إضافة عميل'}</h2>
                        <input className="w-full px-3 py-2 border rounded-lg" placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <input className="w-full px-3 py-2 border rounded-lg" placeholder="الإيميل" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        <input className="w-full px-3 py-2 border rounded-lg" placeholder="الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        <select className="w-full px-3 py-2 border rounded-lg" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContactType })}>
                            <option value="customer">عميل</option>
                            <option value="supplier">مورد</option>
                            <option value="lead">عميل محتمل</option>
                            <option value="employee">موظف</option>
                            <option value="other">أخرى</option>
                        </select>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">
                                إلغاء
                            </button>
                            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">
                                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showOppModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
                    <form onSubmit={saveOpportunity} className="w-full max-w-lg bg-white rounded-xl p-5 space-y-3">
                        <h2 className="text-lg font-black">فرصة جديدة</h2>
                        <input
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="الاسم"
                            value={oppForm.name}
                            onChange={(e) => setOppForm({ ...oppForm, name: e.target.value })}
                        />
                        <input
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="الإيميل"
                            value={oppForm.email}
                            onChange={(e) => setOppForm({ ...oppForm, email: e.target.value })}
                        />
                        <input
                            type="number"
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="القيمة المتوقعة"
                            value={oppForm.expected_value}
                            onChange={(e) => setOppForm({ ...oppForm, expected_value: e.target.value })}
                        />
                        <select
                            className="w-full px-3 py-2 border rounded-lg"
                            value={oppForm.stage}
                            onChange={(e) => setOppForm({ ...oppForm, stage: e.target.value })}
                        >
                            {STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowOppModal(false)} className="px-4 py-2 border rounded-lg">
                                إلغاء
                            </button>
                            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">
                                حفظ
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CRMScreen;
