import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generateInvoicePDF } from '../utils/generateInvoicePDF';

/**
 * Public customer portal — magic link auth; no tenant in AppUser required.
 */
export default function CustomerPortalPage() {
    const { session, signInWithOtp, signOut } = useAuth();
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const userEmail = session?.user?.email?.toLowerCase().trim() ?? '';

    useEffect(() => {
        const load = async () => {
            if (!userEmail) {
                setInvoices([]);
                setTenantId(null);
                return;
            }
            setLoadingData(true);
            setErr('');
            try {
                const { data: contacts, error: cErr } = await supabase
                    .from('contacts')
                    .select('id,tenant_id')
                    .ilike('email', userEmail)
                    .limit(5);
                if (cErr) throw cErr;
                const tid = (contacts ?? [])[0]?.tenant_id as string | undefined;
                if (!tid) {
                    setTenantId(null);
                    setInvoices([]);
                    return;
                }
                setTenantId(tid);
                const { data: trow } = await supabase.from('tenants').select('name,name_ar,logo_url').eq('id', tid).single();
                setTenantName(trow?.name_ar || trow?.name || '');
                setLogoUrl(trow?.logo_url ?? null);

                const contactIds = (contacts ?? []).map((c: any) => c.id);
                const { data: inv, error: iErr } = await supabase
                    .from('invoices')
                    .select('*, invoice_items(*)')
                    .eq('tenant_id', tid)
                    .in('contact_id', contactIds)
                    .order('created_at', { ascending: false });
                if (iErr) throw iErr;
                setInvoices(inv ?? []);
            } catch (e: any) {
                setErr(e?.message ?? 'تعذر تحميل البيانات');
                setInvoices([]);
            } finally {
                setLoadingData(false);
            }
        };
        load();
    }, [userEmail]);

    const kpis = useMemo(() => {
        let due = 0;
        let paid = 0;
        invoices.forEach((inv) => {
            const t = Number(inv.total ?? 0);
            const ap = Number(inv.amount_paid ?? 0);
            due += t;
            paid += ap;
        });
        const remaining = Math.max(0, due - paid);
        return { due, paid, remaining };
    }, [invoices]);

    const sendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        setErr('');
        if (!email.trim()) return;
        setLoading(true);
        try {
            await signInWithOtp(email.trim(), '/portal');
            setMsg('تم إرسال رابط الدخول لبريدك الإلكتروني');
        } catch (e: any) {
            setErr(e?.message ?? 'فشل الإرسال');
        } finally {
            setLoading(false);
        }
    };

    const handlePdf = async (row: any) => {
        if (!tenantId) return;
        try {
            const { data: tenant } = await supabase.from('tenants').select('id,name').eq('id', tenantId).single();
            await generateInvoicePDF({ ...row, invoice_items: row.invoice_items ?? [] }, tenant);
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
                        {!loadingData && !tenantId && (
                            <div className="text-center py-10 rounded-2xl bg-white/5 border border-white/10">
                                لا يوجد حساب عميل مرتبط بهذا البريد في النظام.
                            </div>
                        )}
                        {!loadingData && tenantId && (
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
                                                            title="قريباً"
                                                        >
                                                            دفع الفاتورة
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {invoices.length === 0 && (
                                        <div className="p-8 text-center text-white/50">لا توجد فواتير</div>
                                    )}
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
