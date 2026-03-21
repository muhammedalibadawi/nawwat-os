import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generatePayslipPDF } from '../utils/generatePayslipPDF';

export default function EmployeePortalPage() {
    const { session, signInWithOtp, signOut } = useAuth();
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    const [empRow, setEmpRow] = useState<any>(null);
    const [branchName, setBranchName] = useState('—');
    const [structure, setStructure] = useState<any>(null);
    const [lastSlip, setLastSlip] = useState<any>(null);
    const [runs, setRuns] = useState<any[]>([]);
    const [tenant, setTenant] = useState<any>(null);

    const userEmail = session?.user?.email?.toLowerCase().trim() ?? '';

    useEffect(() => {
        const load = async () => {
            if (!userEmail) {
                setEmpRow(null);
                return;
            }
            setLoadingData(true);
            setErr('');
            try {
                const { data: users, error: uErr } = await supabase
                    .from('users')
                    .select('id,full_name,email,tenant_id,default_branch')
                    .ilike('email', userEmail)
                    .limit(1);
                if (uErr) throw uErr;
                const u = (users ?? [])[0];
                if (!u) {
                    setEmpRow(null);
                    return;
                }
                setEmpRow(u);
                const { data: t } = await supabase.from('tenants').select('id,name,name_ar,logo_url').eq('id', u.tenant_id).single();
                setTenant(t);
                if (u.default_branch) {
                    const { data: br } = await supabase.from('branches').select('name,name_ar').eq('id', u.default_branch).maybeSingle();
                    setBranchName(br?.name_ar || br?.name || '—');
                } else setBranchName('—');

                const { data: ss } = await supabase
                    .from('salary_structures')
                    .select('*')
                    .eq('tenant_id', u.tenant_id)
                    .eq('user_id', u.id)
                    .maybeSingle();
                setStructure(ss ?? null);

                const { data: slips } = await supabase
                    .from('payslips')
                    .select('*')
                    .eq('tenant_id', u.tenant_id)
                    .eq('user_id', u.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                const first = (slips ?? [])[0];
                if (first?.payroll_run_id) {
                    const { data: run } = await supabase
                        .from('payroll_runs')
                        .select('run_month,status')
                        .eq('id', first.payroll_run_id)
                        .maybeSingle();
                    setLastSlip({ ...first, payroll_runs: run });
                } else {
                    setLastSlip(first ?? null);
                }

                const { data: pr } = await supabase
                    .from('payroll_runs')
                    .select('id,run_month,status,total_net')
                    .eq('tenant_id', u.tenant_id)
                    .order('run_month', { ascending: false })
                    .limit(12);
                setRuns(pr ?? []);
            } catch (e: any) {
                setErr(e?.message ?? 'تعذر تحميل البيانات');
            } finally {
                setLoadingData(false);
            }
        };
        load();
    }, [userEmail]);

    const sendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        setErr('');
        if (!email.trim()) return;
        setLoading(true);
        try {
            await signInWithOtp(email.trim(), '/employee-portal');
            setMsg('تم إرسال رابط الدخول لبريدك الإلكتروني');
        } catch (e: any) {
            setErr(e?.message ?? 'فشل الإرسال');
        } finally {
            setLoading(false);
        }
    };

    const downloadSlipPdf = async () => {
        if (!lastSlip || !empRow || !tenant) return;
        try {
            await generatePayslipPDF(lastSlip, empRow, tenant);
        } catch (e: any) {
            setErr(e?.message ?? 'فشل التصدير');
        }
    };

    return (
        <div dir="rtl" className="min-h-screen bg-[#071C3B] text-white font-arabic">
            <header className="border-b border-white/10 px-4 py-4 flex items-center justify-between">
                <span className="font-black text-xl">
                    Nawwat<span className="text-[#00CFFF]">OS</span>
                </span>
                {session && (
                    <button
                        type="button"
                        onClick={() => signOut()}
                        className="text-sm font-bold px-4 py-2 rounded-xl border border-[#00CFFF]/40 text-[#00CFFF]"
                    >
                        تسجيل الخروج
                    </button>
                )}
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                {!session && (
                    <form onSubmit={sendLink} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h1 className="text-xl font-black">بوابة الموظف</h1>
                        <p className="text-sm text-white/70">أدخل بريدك الإلكتروني لاستلام رابط الدخول.</p>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl px-4 py-3 bg-white text-[#071C3B]"
                            placeholder="البريد الإلكتروني"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-black bg-[#00CFFF] text-[#071C3B] disabled:opacity-50"
                        >
                            {loading ? 'جاري الإرسال...' : 'أرسل رابط الدخول'}
                        </button>
                        {msg && <p className="text-emerald-300 text-sm font-bold">{msg}</p>}
                        {err && <p className="text-red-300 text-sm">{err}</p>}
                    </form>
                )}

                {session && (
                    <>
                        {loadingData && <div className="text-center py-10">جاري التحميل...</div>}
                        {!loadingData && !empRow && (
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                                لا يوجد ملف موظف مرتبط بهذا البريد.
                            </div>
                        )}
                        {!loadingData && empRow && (
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                    <h2 className="text-lg font-black mb-2">البيانات الأساسية</h2>
                                    <p>
                                        <span className="text-white/60">الاسم: </span>
                                        {empRow.full_name || '—'}
                                    </p>
                                    <p>
                                        <span className="text-white/60">الفرع: </span>
                                        {branchName}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                    <h2 className="text-lg font-black mb-2">الراتب الأساسي</h2>
                                    {structure ? (
                                        <p className="text-2xl font-black text-[#00CFFF]">
                                            AED {Number(structure.basic_salary ?? 0).toLocaleString('ar-AE')}
                                        </p>
                                    ) : (
                                        <p className="text-white/50">لا يوجد هيكل راتب مسجل</p>
                                    )}
                                </div>

                                <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                    <h2 className="text-lg font-black mb-2">رصيد الإجازات</h2>
                                    <p className="text-white/50 text-sm">قيد الإعداد — سيتم ربطه بنظام الإجازات لاحقاً</p>
                                </div>

                                <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                    <h2 className="text-lg font-black mb-3">آخر قسيمة راتب</h2>
                                    {lastSlip ? (
                                        <>
                                            <p className="mb-2">
                                                صافي الراتب: AED {Number(lastSlip.net_salary ?? 0).toLocaleString('ar-AE')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={downloadSlipPdf}
                                                className="px-4 py-2 rounded-xl bg-[#00CFFF] text-[#071C3B] font-bold text-sm"
                                            >
                                                تحميل PDF
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-white/50">لا توجد قسائم بعد</p>
                                    )}
                                </div>

                                <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                    <h2 className="text-lg font-black mb-3">مسيرات الرواتب السابقة</h2>
                                    <ul className="space-y-2 text-sm">
                                        {runs.map((r) => (
                                            <li key={r.id} className="flex justify-between border-b border-white/10 pb-2">
                                                <span>{r.run_month}</span>
                                                <span className="text-white/70">{r.status}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {runs.length === 0 && <p className="text-white/50">لا توجد مسيرات</p>}
                                </div>
                                {err && <p className="text-red-300 text-sm">{err}</p>}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
