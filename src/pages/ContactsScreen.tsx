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
}

export default function ContactsScreen() {
    const { user } = useAuth();
    const [rows, setRows] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | ContactType>('all');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'customer' as ContactType, notes: '' });

    const load = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: qErr } = await supabase
                .from('contacts')
                .select('id,name,email,phone,type,notes,created_at')
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false });
            if (qErr) throw qErr;
            setRows((data ?? []) as ContactRow[]);
        } catch (err: any) {
            setError(err?.message ?? 'فشل تحميل جهات الاتصال');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [user?.tenant_id]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return rows.filter((r) => {
            if (typeFilter !== 'all' && r.type !== typeFilter) return false;
            if (!q) return true;
            return (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q);
        });
    }, [rows, search, typeFilter]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: '', email: '', phone: '', type: 'customer', notes: '' });
        setShowModal(true);
    };

    const openEdit = (r: ContactRow) => {
        setEditingId(r.id);
        setForm({ name: r.name || '', email: r.email || '', phone: r.phone || '', type: r.type, notes: r.notes || '' });
        setShowModal(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        if (!form.name.trim()) return;
        try {
            const payload = {
                tenant_id: user.tenant_id,
                name: form.name.trim(),
                email: form.email.trim() || null,
                phone: form.phone.trim() || null,
                type: form.type,
                notes: form.notes.trim() || null,
            };
            if (editingId) {
                const { error: updErr } = await supabase.from('contacts').update(payload).eq('id', editingId).eq('tenant_id', user.tenant_id);
                if (updErr) throw updErr;
            } else {
                const { error: insErr } = await supabase.from('contacts').insert(payload);
                if (insErr) throw insErr;
            }
            setShowModal(false);
            await load();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حفظ جهة الاتصال');
        }
    };

    const remove = async (id: string) => {
        if (!user?.tenant_id) return;
        if (!window.confirm('تأكيد الحذف؟')) return;
        try {
            const { error: delErr } = await supabase.from('contacts').delete().eq('id', id).eq('tenant_id', user.tenant_id);
            if (delErr) throw delErr;
            await load();
        } catch (err: any) {
            setError(err?.message ?? 'فشل حذف جهة الاتصال');
        }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-black text-[#071C3B]">Contacts</h1>
                <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">إضافة</button>
            </div>

            <div className="bg-white border rounded-xl p-4 flex gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className="flex-1 border rounded-lg px-3 py-2" />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="border rounded-lg px-3 py-2">
                    <option value="all">الكل</option>
                    <option value="customer">عملاء</option>
                    <option value="supplier">موردين</option>
                    <option value="both">الاثنين</option>
                </select>
            </div>

            {loading && <div className="bg-white border rounded-xl p-6 text-center">جاري التحميل...</div>}
            {!loading && error && <div className="bg-white border rounded-xl p-6 text-center text-red-600">{error}</div>}
            {!loading && !error && filtered.length === 0 && <div className="bg-white border rounded-xl p-6 text-center">لا توجد بيانات</div>}

            {!loading && !error && filtered.length > 0 && (
                <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-start">الاسم</th>
                                <th className="p-3 text-start">الإيميل</th>
                                <th className="p-3 text-start">الفون</th>
                                <th className="p-3 text-start">النوع</th>
                                <th className="p-3 text-start">الملاحظات</th>
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
                                    <td className="p-3">{r.notes || '—'}</td>
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
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <form onSubmit={save} className="w-full max-w-xl bg-white rounded-xl p-5 space-y-3">
                        <h2 className="text-lg font-black">{editingId ? 'تعديل جهة اتصال' : 'إضافة جهة اتصال'}</h2>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="الإيميل" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="الفون" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        <select className="w-full border rounded-lg px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContactType })}>
                            <option value="customer">customer</option>
                            <option value="supplier">supplier</option>
                            <option value="both">both</option>
                        </select>
                        <textarea className="w-full border rounded-lg px-3 py-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">إلغاء</button>
                            <button type="submit" className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">حفظ</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
