import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ContactType = 'customer' | 'supplier' | 'both';
interface ContactRow {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: ContactType;
    notes: string | null;
    created_at: string;
    tenant_id: string;
}

const CRMScreen: React.FC = () => {
    const { user } = useAuth();
    const [rows, setRows] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'customer' as ContactType });
    const [saving, setSaving] = useState(false);

    const loadContacts = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: qErr } = await supabase
                .from('contacts')
                .select('id,name,email,phone,type,created_at,notes,tenant_id')
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
        if (!q) return rows;
        return rows.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q));
    }, [rows, search]);

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

    return (
        <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-black text-[#071C3B]">CRM Contacts</h1>
                <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">إضافة عميل</button>
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
                                            <button onClick={() => openEdit(r)} className="px-3 py-1 rounded bg-cyan-50 text-cyan-700">تعديل</button>
                                            <button onClick={() => remove(r.id)} className="px-3 py-1 rounded bg-red-50 text-red-700">حذف</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                            <option value="customer">customer</option>
                            <option value="supplier">supplier</option>
                            <option value="both">both</option>
                        </select>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">إلغاء</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CRMScreen;
