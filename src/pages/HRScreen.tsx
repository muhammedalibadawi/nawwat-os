import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface UserRow {
    id: string;
    full_name: string | null;
    email: string;
    is_active: boolean | null;
    default_branch: string | null;
    created_at: string;
}
interface UserRoleRow {
    user_id: string;
    role_id: string | null;
}
interface BranchRow {
    id: string;
    name: string | null;
}
interface RoleRow {
    id: string;
    name: string | null;
}

const HRScreen: React.FC = () => {
    const { user } = useAuth();
    const [rows, setRows] = useState<UserRow[]>([]);
    const [roles, setRoles] = useState<UserRoleRow[]>([]);
    const [branches, setBranches] = useState<BranchRow[]>([]);
    const [roleDefs, setRoleDefs] = useState<RoleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ full_name: '', email: '', password: '', role: '', default_branch: '' });

    const loadData = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const [usersRes, rolesRes, branchesRes, roleDefsRes] = await Promise.all([
                supabase.from('users').select('id,full_name,email,is_active,default_branch,created_at').eq('tenant_id', user.tenant_id),
                supabase.from('user_roles').select('user_id,role_id').eq('tenant_id', user.tenant_id),
                supabase.from('branches').select('id,name').eq('tenant_id', user.tenant_id),
                supabase.from('roles').select('id,name').eq('tenant_id', user.tenant_id),
            ]);
            if (usersRes.error) throw usersRes.error;
            if (rolesRes.error) throw rolesRes.error;
            if (branchesRes.error) throw branchesRes.error;
            if (roleDefsRes.error) throw roleDefsRes.error;
            setRows((usersRes.data ?? []) as UserRow[]);
            setRoles((rolesRes.data ?? []) as UserRoleRow[]);
            setBranches((branchesRes.data ?? []) as BranchRow[]);
            setRoleDefs((roleDefsRes.data ?? []) as RoleRow[]);
        } catch (err: any) {
            setError(err?.message ?? 'فشل تحميل الموظفين');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user?.tenant_id]);

    const kpis = useMemo(() => {
        const active = rows.filter((r) => r.is_active).length;
        const branches = new Set(rows.map((r) => r.default_branch).filter(Boolean)).size;
        return { total: rows.length, active, branches };
    }, [rows]);

    const roleByUser = useMemo(() => {
        const roleNameById: Record<string, string> = {};
        roleDefs.forEach((r) => {
            roleNameById[r.id] = r.name || r.id;
        });
        const map: Record<string, string> = {};
        roles.forEach((r) => {
            map[r.user_id] = r.role_id ? (roleNameById[r.role_id] || r.role_id) : '—';
        });
        return map;
    }, [roles, roleDefs]);

    const branchNameById = useMemo(() => {
        const map: Record<string, string> = {};
        branches.forEach((b) => {
            map[b.id] = b.name || b.id;
        });
        return map;
    }, [branches]);

    const createEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.tenant_id) return;
        if (!form.full_name.trim() || !form.email.trim()) return;
        setSaving(true);
        setError('');
        try {
            const { data, error: insErr } = await supabase
                .from('users')
                .insert({
                    tenant_id: user.tenant_id,
                    full_name: form.full_name.trim(),
                    email: form.email.trim(),
                    is_active: true,
                    default_branch: form.default_branch.trim() || null,
                })
                .select('id')
                .single();
            if (insErr) throw insErr;
            if (form.role.trim()) {
                const { error: roleErr } = await supabase.from('user_roles').insert({
                    tenant_id: user.tenant_id,
                    user_id: data?.id,
                    role_id: form.role.trim(),
                });
                if (roleErr) throw roleErr;
            }
            setShowModal(false);
            setForm({ full_name: '', email: '', password: '', role: '', default_branch: '' });
            await loadData();
        } catch (err: any) {
            setError(err?.message ?? 'فشل إضافة الموظف');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-[#071C3B]">HR Employees</h1>
                <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">إضافة موظف</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">عدد الموظفين</p><p className="text-2xl font-black">{kpis.total.toLocaleString('ar-AE')}</p></div>
                <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">النشطين</p><p className="text-2xl font-black">{kpis.active.toLocaleString('ar-AE')}</p></div>
                <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">الفروع</p><p className="text-2xl font-black">{kpis.branches.toLocaleString('ar-AE')}</p></div>
            </div>

            {loading && <div className="bg-white border rounded-xl p-6 text-center">جاري التحميل...</div>}
            {!loading && error && <div className="bg-white border rounded-xl p-6 text-center text-red-600">{error}</div>}
            {!loading && !error && rows.length === 0 && <div className="bg-white border rounded-xl p-6 text-center">لا توجد بيانات</div>}

            {!loading && !error && rows.length > 0 && (
                <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-start">الاسم</th>
                                <th className="p-3 text-start">الإيميل</th>
                                <th className="p-3 text-start">الدور</th>
                                <th className="p-3 text-start">الفرع</th>
                                <th className="p-3 text-start">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t">
                                    <td className="p-3 font-bold">{r.full_name || '—'}</td>
                                    <td className="p-3">{r.email}</td>
                                    <td className="p-3">{roleByUser[r.id] || '—'}</td>
                                    <td className="p-3">{r.default_branch ? (branchNameById[r.default_branch] || r.default_branch) : '—'}</td>
                                    <td className="p-3">{r.is_active ? 'نشط' : 'غير نشط'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <form onSubmit={createEmployee} className="w-full max-w-xl bg-white rounded-xl p-5 space-y-3">
                        <h2 className="text-lg font-black">إضافة موظف</h2>
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="الاسم" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="الإيميل" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        <input type="password" className="w-full border rounded-lg px-3 py-2" placeholder="كلمة المرور (للتجهيز)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="role_id" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                        <input className="w-full border rounded-lg px-3 py-2" placeholder="default_branch" value={form.default_branch} onChange={(e) => setForm({ ...form, default_branch: e.target.value })} />
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

export default HRScreen;
