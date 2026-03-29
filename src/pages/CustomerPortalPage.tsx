import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generateInvoicePDF } from '../utils/generateInvoicePDF';

type PortalInvoice = {
    id: string;
    invoice_no?: string | null;
    total?: number | string | null;
    amount_paid?: number | string | null;
    status?: string | null;
    issue_date?: string | null;
    created_at?: string | null;
    invoice_items?: any[];
};

/**
 * Customer portal.
 * Reads tenant context from JWT app_metadata and relies on RLS for invoice visibility.
 */
export default function CustomerPortalPage() {
    const { session, signInWithOtp, signOut } = useAuth();
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [tenantName, setTenantName] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const appMeta = session?.user?.app_metadata ?? {};
    const userEmail = session?.user?.email?.toLowerCase().trim() ?? '';
    const portalTenantId = typeof appMeta.tenant_id === 'string' ? appMeta.tenant_id : '';
    const portalRole = typeof appMeta.user_role === 'string' ? appMeta.user_role : '';
    const hasPortalIdentity = Boolean(session?.user && portalRole === 'customer' && portalTenantId);

    useEffect(() => {
        const load = async () => {
            if (!session?.user) {
                setErr('');
                setTenantName('');
                setLogoUrl(null);
                setInvoices([]);
                setLoadingData(false);
                return;
            }

            if (!hasPortalIdentity) {
                setErr('هذا الحساب غير مرتبط ببوابة عميل مفعّلة.');
                setTenantName('');
                setLogoUrl(null);
                setInvoices([]);
                setLoadingData(false);
                return;
            }

            setLoadingData(true);
            setErr('');

            try {
                const [{ data: tenant, error: tenantError }, { data: invoiceRows, error: invoiceError }] = await Promise.all([
                    supabase
                        .from('tenants')
                        .select('id,name,name_ar,logo_url')
                        .eq('id', portalTenantId)
                        .single(),
                    supabase
                        .from('invoices')
                        .select('id, invoice_no, total, amount_paid, status, issue_date, created_at, invoice_items(*)')
                        .eq('tenant_id', portalTenantId)
                        .order('created_at', { ascending: false }),
                ]);

                if (tenantError) throw tenantError;
                if (invoiceError) throw invoiceError;

                setTenantName(tenant?.name_ar || tenant?.name || '');
                setLogoUrl(tenant?.logo_url ?? null);
                setInvoices((invoiceRows as PortalInvoice[] | null) ?? []);
            } catch (e: any) {
                setErr(e?.message ?? 'تعذّر تحميل بيانات البوابة');
                setTenantName('');
                setLogoUrl(null);
                setInvoices([]);
            } finally {
                setLoadingData(false);
            }
        };

        void load();
    }, [hasPortalIdentity, portalTenantId, portalRole, session?.user?.id]);

    const kpis = useMemo(() => {
        let due = 0;
        let paid = 0;

        invoices.forEach((inv) => {
            due += Number(inv.total ?? 0);
            paid += Number(inv.amount_paid ?? 0);
        });

        return {
            due,
            paid,
            remaining: Math.max(0, due - paid),
        };
    }, [invoices]);

    const sendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        setErr('');
        if (!email.trim()) return;

        setLoading(true);
        try {
            await signInWithOtp(email.trim(), '/portal');
            setMsg('تم إرسال رابط الدخول إلى بريدك الإلكتروني');
        } catch (e: any) {
            setErr(e?.message ?? 'فشل الإرسال');
        } finally {
            setLoading(false);
        }
    };

    const handlePdf = async (row: PortalInvoice) => {
        try {
            await generateInvoicePDF(
                { ...row, invoice_items: row.invoice_items ?? [] },
                { id: portalTenantId, name: tenantName || 'الشركة' }
            );
        } catch (e: any) {
            setErr(e?.message ?? 'فشل PDF');
        }
    };

    return (
        <div dir="rtl" className="min-h-screen bg-[#071C3B] text-white font-arabic">
            <header className="border-b border-white/10 bg-[#071C3B]/95 backdrop-blur px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-black text-xl">
                        Nawwat<span className="text-[#00CFFF]">OS</span>
                    </span>
                    <span className="text-white/50 text-sm hidden sm:inline">بوابة العميل</span>
                </div>
                {session && (
                    <button
                        type="button"
                        onClick={() => signOut()}
                        className="text-sm font-bold px-4 py-2 rounded-xl border border-[#00CFFF]/40 text-[#00CFFF] hover:bg-white/5"
                    >
                        تسجيل الخروج
                    </button>
                )}
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {!session && (
                    <form onSubmit={sendLink} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 max-w-md mx-auto">
                        <h1 className="text-xl font-black">تسجيل الدخول</h1>
                        <p className="text-sm text-white/70">أدخل بريدك الإلكتروني لاستلام رابط الدخول.</p>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="البريد الإلكتروني"
                            className="w-full rounded-xl px-4 py-3 bg-white text-[#071C3B] border-none outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-black bg-[#00CFFF] text-[#071C3B] disabled:opacity-50"
                        >
                            {loading ? 'جاري الإرسال...' : 'أرسل رابط الدخول'}
                        </button>
                        {msg && <p className="text-emerald-300 text-sm font-bold">{msg}</p>}
                        {err && <p className="text-red-300 text-sm font-bold">{err}</p>}
                    </form>
                )}

                {session && (
                    <>
                        {loadingData && <div className="text-center py-10 text-white/70">جاري التحميل...</div>}

                        {!loadingData && !hasPortalIdentity && (
                            <div className="text-center py-10 rounded-2xl bg-white/5 border border-white/10">
                                {err || 'هذا الحساب غير مهيأ لبوابة العميل.'}
                            </div>
                        )}

                        {!loadingData && hasPortalIdentity && (
                            <>
                                <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                                    {logoUrl ? (
                                        <img src={logoUrl} alt="" className="h-16 w-auto object-contain bg-white rounded-lg p-2" />
                                    ) : (
                                        <div className="h-16 w-16 rounded-xl bg-[#00CFFF]/20 flex items-center justify-center font-black text-[#00CFFF]">
                                            {tenantName.slice(0, 1) || 'N'}
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-2xl font-black">{tenantName || 'الشركة'}</h2>
                                        <p className="text-white/60 text-sm">{userEmail}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-white/50 text-xs font-bold">إجمالي المستحق</p>
                                        <p className="text-xl font-black text-[#00CFFF]">AED {kpis.due.toLocaleString('ar-AE')}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-white/50 text-xs font-bold">المدفوع</p>
                                        <p className="text-xl font-black">AED {kpis.paid.toLocaleString('ar-AE')}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-white/50 text-xs font-bold">المتبقي</p>
                                        <p className="text-xl font-black text-amber-300">AED {kpis.remaining.toLocaleString('ar-AE')}</p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/20 text-white/70">
                                            <tr>
                                                <th className="p-3 text-start">رقم الفاتورة</th>
                                                <th className="p-3 text-start">التاريخ</th>
                                                <th className="p-3 text-start">المبلغ</th>
                                                <th className="p-3 text-start">الحالة</th>
                                                <th className="p-3 text-start">إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.map((inv) => (
                                                <tr key={inv.id} className="border-t border-white/10">
                                                    <td className="p-3 font-bold">{inv.invoice_no ?? inv.id}</td>
                                                    <td className="p-3">
                                                        {inv.issue_date
                                                            ? new Date(inv.issue_date).toLocaleDateString('ar-AE')
                                                            : inv.created_at
                                                              ? new Date(inv.created_at).toLocaleDateString('ar-AE')
                                                              : '—'}
                                                    </td>
                                                    <td className="p-3">AED {Number(inv.total ?? 0).toLocaleString('ar-AE')}</td>
                                                    <td className="p-3">{inv.status ?? '—'}</td>
                                                    <td className="p-3 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePdf(inv)}
                                                            className="px-3 py-1.5 rounded-lg bg-[#00CFFF] text-[#071C3B] text-xs font-bold"
                                                        >
                                                            تحميل PDF
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold opacity-50 cursor-not-allowed"
                                                            title="قريبًا"
                                                        >
                                                            دفع الفاتورة
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {invoices.length === 0 && <div className="p-8 text-center text-white/50">لا توجد فواتير</div>}
                                </div>

                                {err && <p className="mt-4 text-red-300 text-sm">{err}</p>}
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
