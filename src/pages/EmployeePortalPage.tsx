import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generatePayslipPDF } from '../utils/generatePayslipPDF';

type PortalEmployeeProfile = {
    id: string;
    full_name?: string | null;
    email?: string | null;
    tenant_id?: string | null;
    default_branch?: string | null;
};

type PortalTenant = {
    id: string;
    name?: string | null;
    name_ar?: string | null;
    logo_url?: string | null;
};

type PortalSalaryStructure = {
    basic_salary?: number | string | null;
};

type PortalPayrollRun = {
    id: string;
    run_month?: string | null;
    status?: string | null;
    total_net?: number | string | null;
};

type PortalPayslip = {
    id: string;
    payroll_run_id?: string | null;
    basic_salary?: number | string | null;
    total_allowances?: number | string | null;
    net_salary?: number | string | null;
    created_at?: string | null;
    payroll_runs?: PortalPayrollRun | null;
};

type PortalBranch = {
    name?: string | null;
    name_ar?: string | null;
};

export default function EmployeePortalPage() {
    const { session, signInWithOtp, signOut } = useAuth();
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    const [empRow, setEmpRow] = useState<PortalEmployeeProfile | null>(null);
    const [branchName, setBranchName] = useState('—');
    const [structure, setStructure] = useState<PortalSalaryStructure | null>(null);
    const [lastSlip, setLastSlip] = useState<PortalPayslip | null>(null);
    const [runs, setRuns] = useState<PortalPayrollRun[]>([]);
    const [tenant, setTenant] = useState<PortalTenant | null>(null);

    const appMeta = session?.user?.app_metadata ?? {};
    const authUserId = session?.user?.id ?? '';
    const displayEmail = session?.user?.email?.toLowerCase().trim() ?? '';
    const portalTenantId = typeof appMeta.tenant_id === 'string' ? appMeta.tenant_id : '';
    const portalRole = typeof appMeta.user_role === 'string' ? appMeta.user_role : '';
    const hasPortalIdentity = Boolean(session?.user && portalRole === 'employee' && portalTenantId && authUserId);

    useEffect(() => {
        let cancelled = false;

        const clearPortalState = () => {
            setEmpRow(null);
            setBranchName('—');
            setStructure(null);
            setLastSlip(null);
            setRuns([]);
            setTenant(null);
        };

        const load = async () => {
            if (!session?.user) {
                clearPortalState();
                setErr('');
                setLoadingData(false);
                return;
            }

            if (!hasPortalIdentity) {
                clearPortalState();
                setErr('هذا الحساب غير مرتبط ببوابة موظف مفعّلة.');
                setLoadingData(false);
                return;
            }

            setLoadingData(true);
            setErr('');

            try {
                const [{ data: tenantRow, error: tenantError }, { data: employee, error: employeeError }] = await Promise.all([
                    supabase
                        .from('tenants')
                        .select('id,name,name_ar,logo_url')
                        .eq('id', portalTenantId)
                        .single(),
                    supabase
                        .from('users')
                        .select('id,full_name,email,tenant_id,default_branch')
                        .eq('tenant_id', portalTenantId)
                        .eq('auth_id', authUserId)
                        .maybeSingle(),
                ]);

                if (tenantError) throw tenantError;
                if (employeeError) throw employeeError;
                if (cancelled) return;

                setTenant((tenantRow as PortalTenant | null) ?? null);

                if (!employee) {
                    setEmpRow(null);
                    setBranchName('—');
                    setStructure(null);
                    setLastSlip(null);
                    setRuns([]);
                    return;
                }

                const employeeProfile = employee as PortalEmployeeProfile;
                setEmpRow(employeeProfile);

                let resolvedBranchName = '—';
                if (employeeProfile.default_branch) {
                    const { data: branchRow, error: branchError } = await supabase
                        .from('branches')
                        .select('name,name_ar')
                        .eq('id', employeeProfile.default_branch)
                        .maybeSingle();

                    if (branchError) throw branchError;
                    const branch = (branchRow as PortalBranch | null) ?? null;
                    resolvedBranchName = branch?.name_ar || branch?.name || '—';
                }

                const [{ data: salaryRow, error: salaryError }, { data: payslipRows, error: payslipError }] = await Promise.all([
                    supabase
                        .from('salary_structures')
                        .select('*')
                        .eq('tenant_id', portalTenantId)
                        .eq('user_id', employeeProfile.id)
                        .maybeSingle(),
                    supabase
                        .from('payslips')
                        .select('*')
                        .eq('tenant_id', portalTenantId)
                        .eq('user_id', employeeProfile.id)
                        .order('created_at', { ascending: false })
                        .limit(12),
                ]);

                if (salaryError) throw salaryError;
                if (payslipError) throw payslipError;

                let slipsWithRuns: PortalPayslip[] = (((payslipRows as PortalPayslip[] | null) ?? []).map((slip) => ({
                    ...slip,
                    payroll_runs: null,
                })));

                const runIds = Array.from(
                    new Set(
                        slipsWithRuns
                            .map((slip) => slip.payroll_run_id)
                            .filter((value): value is string => Boolean(value))
                    )
                );

                if (runIds.length > 0) {
                    const { data: runRows, error: runError } = await supabase
                        .from('payroll_runs')
                        .select('id,run_month,status,total_net')
                        .in('id', runIds);

                    if (runError) {
                        console.warn('[EmployeePortalPage] payroll_runs fetch:', runError.message);
                    } else {
                        const runsById = Object.fromEntries(
                            (((runRows as PortalPayrollRun[] | null) ?? [])).map((run) => [run.id, run])
                        );

                        slipsWithRuns = slipsWithRuns.map((slip) => ({
                            ...slip,
                            payroll_runs: slip.payroll_run_id ? runsById[String(slip.payroll_run_id)] ?? null : null,
                        }));
                    }
                }

                if (cancelled) return;

                setBranchName(resolvedBranchName);
                setStructure((salaryRow as PortalSalaryStructure | null) ?? null);
                setLastSlip(slipsWithRuns[0] ?? null);
                setRuns(
                    slipsWithRuns.map((slip) => ({
                        id: slip.payroll_run_id || slip.id,
                        run_month:
                            slip.payroll_runs?.run_month ||
                            (slip.created_at
                                ? new Date(slip.created_at).toLocaleDateString('ar-AE', { month: 'short', year: 'numeric' })
                                : '—'),
                        status: slip.payroll_runs?.status || 'completed',
                        total_net: slip.payroll_runs?.total_net ?? slip.net_salary ?? 0,
                    }))
                );
            } catch (e: any) {
                if (!cancelled) {
                    clearPortalState();
                    setErr(e?.message ?? 'تعذّر تحميل البيانات');
                }
            } finally {
                if (!cancelled) setLoadingData(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [authUserId, hasPortalIdentity, portalTenantId, portalRole, session?.user?.id]);

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

                        {!loadingData && !hasPortalIdentity && (
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                                {err || 'هذا الحساب غير مهيأ لبوابة الموظف.'}
                            </div>
                        )}

                        {!loadingData && hasPortalIdentity && !empRow && (
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                                لا يوجد ملف موظف مرتبط بهذا الحساب.
                            </div>
                        )}

                        {!loadingData && hasPortalIdentity && empRow && (
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                                    <h2 className="text-lg font-black mb-2">البيانات الأساسية</h2>
                                    <p>
                                        <span className="text-white/60">الاسم: </span>
                                        {empRow.full_name || '—'}
                                    </p>
                                    <p>
                                        <span className="text-white/60">البريد: </span>
                                        {displayEmail || empRow.email || '—'}
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
                                    <p className="text-white/50 text-sm">قيد الإعداد وسيتم ربطه بنظام الإجازات لاحقًا</p>
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
                                        {runs.map((run) => (
                                            <li key={run.id} className="flex justify-between border-b border-white/10 pb-2">
                                                <span>{run.run_month || '—'}</span>
                                                <span className="text-white/70">{run.status || '—'}</span>
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
