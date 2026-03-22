import { useState, useEffect } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { COUNTRY_PRESETS, getCountryPreset, wpsBadgeText, zatcaBadgeText } from '@/services/countryConfig';

export default function SettingsScreen() {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'company' | 'users' | 'pos' | 'branches' | 'fx' | 'comms'>('company');
    const [tenant, setTenant] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [inviteForm, setInviteForm] = useState({ email: '', role: '' });
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [branchForm, setBranchForm] = useState({ id: '', name: '', address: '', phone: '', city: '' });
    const [posSound, setPosSound] = useState(localStorage.getItem('pos_sound') !== 'off');
    const [posAutoPrint, setPosAutoPrint] = useState(localStorage.getItem('pos_auto_print') === 'on');
    const [posShowCurrency, setPosShowCurrency] = useState(localStorage.getItem('pos_show_currency') !== 'off');
    const [fxRows, setFxRows] = useState<any[]>([]);
    const [fxLoading, setFxLoading] = useState(false);
    const [fxError, setFxError] = useState('');
    const [fxModal, setFxModal] = useState(false);
    const [fxForm, setFxForm] = useState({ from_currency: 'USD', to_currency: 'AED', rate: '3.6725' });

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!user?.tenant_id) return;
            const [tRes, uRes, rRes, bRes] = await Promise.all([
                supabase.from('tenants').select('*').eq('id', user.tenant_id).single(),
                supabase.from('users').select('id,full_name,email').eq('tenant_id', user.tenant_id),
                supabase.from('roles').select('id,name').eq('tenant_id', user.tenant_id),
                supabase
                    .from('branches')
                    .select('id, name, address, phone, is_active, created_at, city')
                    .eq('tenant_id', user.tenant_id)
                    .order('created_at', { ascending: false }),
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

    useEffect(() => {
        let c = false;
        async function loadFx() {
            if (!user?.tenant_id || activeTab !== 'fx') return;
            setFxLoading(true);
            setFxError('');
            try {
                const { data, error } = await supabase
                    .from('fx_rates')
                    .select('*')
                    .eq('tenant_id', user.tenant_id)
                    .order('rate_date', { ascending: false })
                    .limit(100);
                if (error) throw error;
                if (!c) setFxRows(data ?? []);
            } catch (e: any) {
                if (!c) setFxError(e?.message ?? 'فشل تحميل أسعار الصرف');
            } finally {
                if (!c) setFxLoading(false);
            }
        }
        loadFx();
        return () => {
            c = true;
        };
    }, [user?.tenant_id, activeTab]);

    const applyCountrySelection = (code: string) => {
        const p = getCountryPreset(code);
        if (!p || !tenant) return;
        setTenant({
            ...tenant,
            country_code: p.code,
            country: p.code,
            default_currency: p.currency,
            currency: p.currency,
            default_tax_rate: p.vatRate,
            vat_rate: p.vatRate,
        });
    };

    const handleSaveCompany = async () => {
        if (!user?.tenant_id || !tenant) return;
        setIsSaving(true);
        try {
            await supabase
                .from('tenants')
                .update({
                    name: tenant.name,
                    vat_no: tenant.vat_no,
                    country: tenant.country_code || tenant.country,
                    currency: tenant.default_currency || tenant.currency,
                    country_code: tenant.country_code || tenant.country,
                    default_currency: tenant.default_currency || tenant.currency,
                    default_tax_rate: Number(tenant.default_tax_rate ?? tenant.vat_rate ?? 5),
                    vat_rate: Number(tenant.vat_rate ?? tenant.default_tax_rate ?? 5),
                    address: tenant.address,
                })
                .eq('id', user.tenant_id);
        } finally {
            setIsSaving(false);
        }
    };

    const saveComms = async () => {
        if (!user?.tenant_id || !tenant) return;
        setIsSaving(true);
        try {
            await supabase
                .from('tenants')
                .update({
                    whatsapp_number: tenant.whatsapp_number || null,
                    whatsapp_api_key: tenant.whatsapp_api_key || null,
                })
                .eq('id', user.tenant_id);
        } finally {
            setIsSaving(false);
        }
    };

    const saveFxRate = async () => {
        if (!user?.tenant_id) return;
        setIsSaving(true);
        setFxError('');
        try {
            const row = {
                tenant_id: user.tenant_id,
                from_currency: fxForm.from_currency.trim().toUpperCase(),
                to_currency: fxForm.to_currency.trim().toUpperCase(),
                rate: Number(fxForm.rate),
                rate_date: new Date().toISOString().slice(0, 10),
                source: 'manual',
            };
            const { error } = await supabase.from('fx_rates').insert(row);
            if (error) throw error;
            setFxModal(false);
            const { data } = await supabase
                .from('fx_rates')
                .select('*')
                .eq('tenant_id', user.tenant_id)
                .order('rate_date', { ascending: false })
                .limit(100);
            setFxRows(data ?? []);
        } catch (e: any) {
            setFxError(e?.message ?? 'فشل الحفظ');
        } finally {
            setIsSaving(false);
        }
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

    const reloadBranches = async () => {
        if (!user?.tenant_id) return;
        const { data } = await supabase
            .from('branches')
            .select('id, name, address, phone, is_active, created_at, city')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: false });
        setBranches(data ?? []);
    };

    const saveBranch = async () => {
        if (!user?.tenant_id || !branchForm.name.trim()) return;
        const payload = {
            name: branchForm.name.trim(),
            address: branchForm.address.trim() || null,
            phone: branchForm.phone.trim() || null,
            city: branchForm.city.trim() || null,
        };
        if (branchForm.id) {
            await supabase.from('branches').update(payload).eq('id', branchForm.id).eq('tenant_id', user.tenant_id);
        } else {
            await supabase.from('branches').insert({ tenant_id: user.tenant_id, ...payload });
        }
        setBranchModalOpen(false);
        setBranchForm({ id: '', name: '', address: '', phone: '', city: '' });
        await reloadBranches();
    };

    const toggleBranchActive = async (b: { id: string; is_active: boolean }) => {
        if (!user?.tenant_id) return;
        await supabase.from('branches').update({ is_active: !b.is_active }).eq('id', b.id).eq('tenant_id', user.tenant_id);
        await reloadBranches();
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
                    onClick={
                        activeTab === 'company'
                            ? handleSaveCompany
                            : activeTab === 'pos'
                              ? savePosSettings
                              : activeTab === 'comms'
                                ? saveComms
                                : undefined
                    }
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-200"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
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
                <button
                    onClick={() => setActiveTab('fx')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'fx' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    العملات وأسعار الصرف
                </button>
                <button
                    onClick={() => setActiveTab('comms')}
                    className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'comms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                >
                    التواصل
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                {activeTab === 'company' && tenant && (
                    <div className="p-6 space-y-4" dir="rtl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                className="border rounded-xl px-3 py-2"
                                placeholder="اسم الشركة"
                                value={tenant.name || ''}
                                onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                            />
                            <input
                                className="border rounded-xl px-3 py-2"
                                placeholder="TRN / الرقم الضريبي"
                                value={tenant.vat_no || ''}
                                onChange={(e) => setTenant({ ...tenant, vat_no: e.target.value })}
                            />
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 block mb-1">الدولة</label>
                                <select
                                    className="w-full border rounded-xl px-3 py-2 font-bold"
                                    value={tenant.country_code || tenant.country || 'UAE'}
                                    onChange={(e) => applyCountrySelection(e.target.value)}
                                >
                                    {COUNTRY_PRESETS.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.flag} {c.code} | {c.labelAr} — ضريبة {c.vatRate}% — {c.currency}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2 flex flex-wrap gap-2">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                                    {zatcaBadgeText(getCountryPreset(tenant.country_code || tenant.country))}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-900">
                                    {wpsBadgeText(getCountryPreset(tenant.country_code || tenant.country))}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800">
                                    العملة: {tenant.default_currency || tenant.currency || 'AED'}
                                </span>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900">
                                    ضريبة افتراضية: {tenant.default_tax_rate ?? tenant.vat_rate ?? 5}%
                                </span>
                            </div>
                            <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="العنوان" value={tenant.address || ''} onChange={(e) => setTenant({ ...tenant, address: e.target.value })} />
                        </div>
                    </div>
                )}
                {activeTab === 'fx' && (
                    <div className="p-6 space-y-4" dir="rtl">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <h3 className="font-black text-lg">أسعار الصرف</h3>
                            <button
                                type="button"
                                onClick={() => setFxModal(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm"
                            >
                                تحديث سعر
                            </button>
                        </div>
                        {fxLoading && <p className="text-gray-500">جاري التحميل...</p>}
                        {fxError && <p className="text-red-600 font-bold">{fxError}</p>}
                        <div className="border rounded-xl overflow-x-auto">
                            <table className="w-full text-sm min-w-[520px]">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 text-start">من</th>
                                        <th className="p-2 text-start">إلى</th>
                                        <th className="p-2 text-start">السعر</th>
                                        <th className="p-2 text-start">التاريخ</th>
                                        <th className="p-2 text-start">المصدر</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { from: 'USD', to: 'AED', rate: 3.6725, src: 'ثابت' },
                                        { from: 'USD', to: 'SAR', rate: 3.75, src: 'ثابت' },
                                        { from: 'EUR', to: 'AED', rate: 4.02, src: 'تقديري' },
                                        { from: 'GBP', to: 'AED', rate: 4.65, src: 'تقديري' },
                                    ].map((r, i) => (
                                        <tr key={`def-${i}`} className="border-t bg-gray-50/80">
                                            <td className="p-2 font-mono">{r.from}</td>
                                            <td className="p-2 font-mono">{r.to}</td>
                                            <td className="p-2 font-bold">{r.rate}</td>
                                            <td className="p-2">—</td>
                                            <td className="p-2">{r.src}</td>
                                        </tr>
                                    ))}
                                    {fxRows.map((r: any) => (
                                        <tr key={r.id} className="border-t">
                                            <td className="p-2 font-mono">{r.from_currency}</td>
                                            <td className="p-2 font-mono">{r.to_currency}</td>
                                            <td className="p-2 font-bold">{Number(r.rate).toFixed(6)}</td>
                                            <td className="p-2">{r.rate_date}</td>
                                            <td className="p-2">{r.source || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-500">أسعار USD/AED و USD/SAR ثابتة رسمياً (عرض مرجعي).</p>
                        {fxModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                                <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-xl">
                                    <h4 className="font-black">إضافة / تحديث سعر</h4>
                                    <input
                                        className="w-full border rounded-lg px-3 py-2"
                                        placeholder="من (مثال USD)"
                                        value={fxForm.from_currency}
                                        onChange={(e) => setFxForm({ ...fxForm, from_currency: e.target.value })}
                                    />
                                    <input
                                        className="w-full border rounded-lg px-3 py-2"
                                        placeholder="إلى (مثال AED)"
                                        value={fxForm.to_currency}
                                        onChange={(e) => setFxForm({ ...fxForm, to_currency: e.target.value })}
                                    />
                                    <input
                                        className="w-full border rounded-lg px-3 py-2"
                                        placeholder="السعر"
                                        value={fxForm.rate}
                                        onChange={(e) => setFxForm({ ...fxForm, rate: e.target.value })}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button type="button" className="px-4 py-2 border rounded-lg font-bold" onClick={() => setFxModal(false)}>
                                            إلغاء
                                        </button>
                                        <button type="button" disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold" onClick={saveFxRate}>
                                            حفظ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'comms' && tenant && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3" dir="rtl">
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500">رقم WhatsApp للأعمال (مع رمز الدولة)</label>
                            <input
                                className="w-full border rounded-xl px-3 py-2 mt-1"
                                placeholder="مثال: 971501234567"
                                value={tenant.whatsapp_number || ''}
                                onChange={(e) => setTenant({ ...tenant, whatsapp_number: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500">Meta API Key (للمستقبل)</label>
                            <input
                                type="password"
                                className="w-full border rounded-xl px-3 py-2 mt-1"
                                placeholder="اختياري"
                                value={tenant.whatsapp_api_key || ''}
                                onChange={(e) => setTenant({ ...tenant, whatsapp_api_key: e.target.value })}
                            />
                        </div>
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
                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <p className="text-sm text-gray-600">إدارة فروع المنشأة</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setBranchForm({ id: '', name: '', address: '', phone: '', city: '' });
                                    setBranchModalOpen(true);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                            >
                                إضافة فرع جديد
                            </button>
                        </div>
                        <div className="border rounded-xl overflow-x-auto">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-start">الاسم</th>
                                        <th className="p-3 text-start">العنوان</th>
                                        <th className="p-3 text-start">الهاتف</th>
                                        <th className="p-3 text-start">الحالة</th>
                                        <th className="p-3 text-start">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map((b) => (
                                        <tr key={b.id} className="border-t">
                                            <td className="p-3 font-bold">{b.name || '—'}</td>
                                            <td className="p-3 text-gray-600">{b.address || '—'}</td>
                                            <td className="p-3">{b.phone || '—'}</td>
                                            <td className="p-3">
                                                <span
                                                    className={`px-2 py-1 rounded-md text-xs font-bold ${b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}
                                                >
                                                    {b.is_active ? 'نشط' : 'معطّل'}
                                                </span>
                                            </td>
                                            <td className="p-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setBranchForm({
                                                            id: b.id,
                                                            name: b.name || '',
                                                            address: b.address || '',
                                                            phone: b.phone || '',
                                                            city: b.city || '',
                                                        });
                                                        setBranchModalOpen(true);
                                                    }}
                                                    className="px-2 py-1 bg-cyan-50 text-cyan-800 rounded-lg font-bold text-xs"
                                                >
                                                    تعديل
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBranchActive(b)}
                                                    className="px-2 py-1 bg-gray-100 rounded-lg font-bold text-xs"
                                                >
                                                    {b.is_active ? 'تعطيل' : 'تفعيل'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {branchModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-3">
                                    <h3 className="text-lg font-black">{branchForm.id ? 'تعديل فرع' : 'فرع جديد'}</h3>
                                    <input
                                        className="w-full border rounded-xl px-3 py-2"
                                        placeholder="اسم الفرع *"
                                        value={branchForm.name}
                                        onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                                    />
                                    <input
                                        className="w-full border rounded-xl px-3 py-2"
                                        placeholder="العنوان"
                                        value={branchForm.address}
                                        onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                                    />
                                    <input
                                        className="w-full border rounded-xl px-3 py-2"
                                        placeholder="الهاتف"
                                        value={branchForm.phone}
                                        onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                                    />
                                    <input
                                        className="w-full border rounded-xl px-3 py-2"
                                        placeholder="المدينة"
                                        value={branchForm.city}
                                        onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                                    />
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            className="px-4 py-2 border rounded-xl font-bold"
                                            onClick={() => {
                                                setBranchModalOpen(false);
                                                setBranchForm({ id: '', name: '', address: '', phone: '', city: '' });
                                            }}
                                        >
                                            إلغاء
                                        </button>
                                        <button type="button" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold" onClick={saveBranch}>
                                            حفظ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
