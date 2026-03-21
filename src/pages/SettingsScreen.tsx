import { useState, useEffect } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'company' | 'users' | 'pos' | 'branches'>('company');
    const [tenant, setTenant] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [inviteForm, setInviteForm] = useState({ email: '', role: '' });
    const [branchForm, setBranchForm] = useState({ id: '', name: '' });
    const [posSound, setPosSound] = useState(localStorage.getItem('pos_sound') !== 'off');
    const [posAutoPrint, setPosAutoPrint] = useState(localStorage.getItem('pos_auto_print') === 'on');
    const [posShowCurrency, setPosShowCurrency] = useState(localStorage.getItem('pos_show_currency') !== 'off');

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!user?.tenant_id) return;
            const [tRes, uRes, rRes, bRes] = await Promise.all([
                supabase.from('tenants').select('*').eq('id', user.tenant_id).single(),
                supabase.from('users').select('id,full_name,email').eq('tenant_id', user.tenant_id),
                supabase.from('roles').select('id,name').eq('tenant_id', user.tenant_id),
                supabase.from('branches').select('*').eq('tenant_id', user.tenant_id),
            ]);
            if (cancelled) return;
            if (tRes.error || uRes.error || rRes.error || bRes.error) {
                console.warn('[SettingsScreen]', tRes.error?.message || uRes.error?.message || rRes.error?.message || bRes.error?.message);
                return;
            }
            setTenant(tRes.data);
            setUsers(uRes.data ?? []);
            setRoles(rRes.data ?? []);
            setBranches(bRes.data ?? []);
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [user?.tenant_id]);

    const handleSaveCompany = async () => {
        if (!user?.tenant_id || !tenant) return;
        setIsSaving(true);
        await supabase.from('tenants').update({
            name: tenant.name,
            vat_no: tenant.vat_no,
            country: tenant.country,
            currency: tenant.currency,
            vat_rate: tenant.vat_rate,
            address: tenant.address,
        }).eq('id', user.tenant_id);
        setIsSaving(false);
    };

    const inviteUser = async () => {
        if (!inviteForm.email) return;
        try {
            const admin = (supabase.auth as any).admin;
            if (admin?.inviteUserByEmail) {
                await admin.inviteUserByEmail(inviteForm.email);
            } else {
                alert('Admin invite API not available in client, use signup link.');
            }
        } catch (e) {
            alert('تعذر إرسال الدعوة');
        }
    };

    const savePosSettings = () => {
        localStorage.setItem('pos_sound', posSound ? 'on' : 'off');
        localStorage.setItem('pos_auto_print', posAutoPrint ? 'on' : 'off');
        localStorage.setItem('pos_show_currency', posShowCurrency ? 'on' : 'off');
    };

    const saveBranch = async () => {
        if (!user?.tenant_id || !branchForm.name) return;
        if (branchForm.id) {
            await supabase.from('branches').update({ name: branchForm.name }).eq('id', branchForm.id).eq('tenant_id', user.tenant_id);
        } else {
            await supabase.from('branches').insert({ tenant_id: user.tenant_id, name: branchForm.name });
        }
        setBranchForm({ id: '', name: '' });
        const { data } = await supabase.from('branches').select('*').eq('tenant_id', user.tenant_id);
        setBranches(data ?? []);
    };

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-32">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Settings className="text-indigo-600" /> Platform Settings
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Manage global system configurations and Universal App modules.</p>
                </div>
                <button
                    disabled={isSaving}
                    onClick={activeTab === 'company' ? handleSaveCompany : activeTab === 'pos' ? savePosSettings : undefined}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-100 pb-px">
                <button
                    onClick={() => setActiveTab('company')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'company' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    الشركة
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    المستخدمون
                </button>
                <button
                    onClick={() => setActiveTab('pos')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'pos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    إعدادات POS
                </button>
                <button
                    onClick={() => setActiveTab('branches')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'branches' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    الفروع
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                {activeTab === 'company' && tenant && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input className="border rounded-xl px-3 py-2" placeholder="اسم الشركة" value={tenant.name || ''} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
                        <input className="border rounded-xl px-3 py-2" placeholder="TRN/VAT" value={tenant.vat_no || ''} onChange={(e) => setTenant({ ...tenant, vat_no: e.target.value })} />
                        <input className="border rounded-xl px-3 py-2" placeholder="البلد" value={tenant.country || ''} onChange={(e) => setTenant({ ...tenant, country: e.target.value })} />
                        <input className="border rounded-xl px-3 py-2" placeholder="العملة" value={tenant.currency || ''} onChange={(e) => setTenant({ ...tenant, currency: e.target.value })} />
                        <input className="border rounded-xl px-3 py-2" placeholder="نسبة الضريبة" value={tenant.vat_rate || ''} onChange={(e) => setTenant({ ...tenant, vat_rate: e.target.value })} />
                        <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="العنوان" value={tenant.address || ''} onChange={(e) => setTenant({ ...tenant, address: e.target.value })} />
                    </div>
                )}
                {activeTab === 'users' && (
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input className="border rounded-xl px-3 py-2" placeholder="إيميل الدعوة" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
                            <select className="border rounded-xl px-3 py-2" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                                <option value="">اختر دور</option>
                                {roles.map((r) => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                            </select>
                            <button onClick={inviteUser} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold">دعوة مستخدم</button>
                        </div>
                        <div className="bg-white border rounded-xl overflow-x-auto">
                            <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-start">الاسم</th><th className="p-3 text-start">الإيميل</th></tr></thead><tbody>{users.map((u) => <tr key={u.id} className="border-t"><td className="p-3">{u.full_name || '—'}</td><td className="p-3">{u.email}</td></tr>)}</tbody></table>
                        </div>
                    </div>
                )}
                {activeTab === 'pos' && (
                    <div className="p-6 space-y-3">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={posSound} onChange={(e) => setPosSound(e.target.checked)} /> صوت عند البيع</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={posAutoPrint} onChange={(e) => setPosAutoPrint(e.target.checked)} /> طباعة تلقائية</label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={posShowCurrency} onChange={(e) => setPosShowCurrency(e.target.checked)} /> العملة في العرض</label>
                    </div>
                )}
                {activeTab === 'branches' && (
                    <div className="p-6 space-y-3">
                        <div className="flex gap-2">
                            <input className="border rounded-xl px-3 py-2 flex-1" placeholder="اسم الفرع" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
                            <button onClick={saveBranch} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold">حفظ</button>
                        </div>
                        <div className="bg-white border rounded-xl overflow-x-auto">
                            <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-start">الفرع</th><th className="p-3 text-start">إجراء</th></tr></thead><tbody>{branches.map((b) => <tr key={b.id} className="border-t"><td className="p-3">{b.name || b.id}</td><td className="p-3 flex gap-2"><button onClick={() => setBranchForm({ id: b.id, name: b.name || '' })} className="px-2 py-1 bg-cyan-50 rounded">تعديل</button><button onClick={async () => { await supabase.from('branches').delete().eq('id', b.id).eq('tenant_id', user?.tenant_id); const { data } = await supabase.from('branches').select('*').eq('tenant_id', user?.tenant_id); setBranches(data ?? []); }} className="px-2 py-1 bg-red-50 rounded text-red-700">حذف</button></td></tr>)}</tbody></table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
