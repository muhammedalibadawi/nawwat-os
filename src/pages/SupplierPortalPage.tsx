import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * بوابة المورد — دخول بالبريد (Magic Link)، للموردين المسجلين في contacts.
 */
export default function SupplierPortalPage() {
    const { session, signInWithOtp, signOut } = useAuth();
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState('');
    const [contactId, setContactId] = useState<string | null>(null);
    const [pos, setPos] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const userEmail = session?.user?.email?.toLowerCase().trim() ?? '';

    useEffect(() => {
        const load = async () => {
            if (!userEmail) {
                setTenantId(null);
                setPos([]);
                return;
            }
            setLoadingData(true);
            setErr('');
            try {
                const { data: contacts, error: cErr } = await supabase
                    .from('contacts')
                    .select('id,tenant_id')
                    .eq('type', 'supplier')
                    .ilike('email', userEmail)
                    .limit(5);
                if (cErr) throw cErr;
                const row = (contacts ?? [])[0];
                if (!row?.tenant_id) {
                    setTenantId(null);
                    setContactId(null);
                    return;
                }
                setTenantId(row.tenant_id);
                setContactId(row.id);
                const { data: trow } = await supabase.from('tenants').select('name,name_ar').eq('id', row.tenant_id).single();
                setTenantName(trow?.name_ar || trow?.name || '');

                const { data: poData, error: poErr } = await supabase
                    .from('purchase_orders')
                    .select('id, po_number, status, total_amount, issue_date, created_at')
                    .eq('tenant_id', row.tenant_id)
                    .eq('supplier_id', row.id)
                    .order('created_at', { ascending: false });
                if (poErr) throw poErr;
                setPos(poData ?? []);

                const { data: invData } = await supabase
                    .from('invoices')
                    .select('id, invoice_no, total, status, issue_date, invoice_type')
                    .eq('tenant_id', row.tenant_id)
                    .eq('contact_id', row.id)
                    .eq('invoice_type', 'purchase')
                    .order('created_at', { ascending: false });
                const { data: payData } = await supabase
                    .from('payments')
                    .select('id, amount, paid_at, method, reference_id')
                    .eq('tenant_id', row.tenant_id)
                    .eq('contact_id', row.id)
                    .order('paid_at', { ascending: false })
                    .limit(50);
                setInvoices(invData ?? []);
                setPayments(payData ?? []);
            } catch (e: any) {
                setErr(e?.message ?? 'تعذر تحميل البيانات');
            } finally {
                setLoadingData(false);
            }
        };
        load();
    }, [userEmail]);

    const kpis = useMemo(() => {
        const poTotal = pos.reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
        const invDue = invoices.reduce((s, i) => s + Math.max(0, Number(i.total ?? 0)), 0);
        return { poTotal, invDue, poCount: pos.length };
    }, [pos, invoices]);

    const sendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg('');
        setErr('');
        if (!email.trim()) return;
        setLoading(true);
        try {
            await signInWithOtp(email.trim(), '/supplier-portal');
            setMsg('تم إرسال رابط الدخول لبريدك الإلكتروني');
        } catch (e: any) {
            setErr(e?.message ?? 'فشل الإرسال');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div dir="rtl" className="min-h-screen bg-[#0A192F] text-white font-arabic">
            <header className="border-b border-white/10 px-4 py-4 flex items-center justify-between">
                <span className="font-black text-xl">
                    Nawwat<span className="text-cyan-400">OS</span>{' '}
                    <span className="text-white/50 text-sm hidden sm:inline">بوابة المورد</span>
                </span>
                {session && (
                    <button type="button" onClick={() => signOut()} className="text-sm font-bold px-4 py-2 rounded-xl border border-cyan-400/40 text-cyan-300">
                        تسجيل الخروج
                    </button>
                )}
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {!session && (
                    <form onSubmit={sendLink} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 max-w-md mx-auto">
                        <h1 className="text-xl font-black">دخول الموردين</h1>
                        <p className="text-sm text-white/70">أدخل البريد المسجل كمورد لاستلام رابط الدخول.</p>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="البريد الإلكتروني"
                            className="w-full rounded-xl px-4 py-3 bg-white text-[#071C3B]"
                        />
                        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-black bg-cyan-400 text-[#071C3B] disabled:opacity-50">
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
                            <div className="text-center py-10 rounded-2xl bg-white/5 border border-white/10">لا يوجد حساب مورد مرتبط بهذا البريد.</div>
                        )}
                        {!loadingData && tenantId && (
                            <>
                                <h2 className="text-2xl font-black mb-2">{tenantName}</h2>
                                <p className="text-white/60 text-sm mb-6">{userEmail}</p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-white/50 text-xs font-bold">أوامر شراء</p>
                                        <p className="text-xl font-black text-cyan-300">{kpis.poCount}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-white/50 text-xs font-bold">قيمة أوامر الشراء</p>
                                        <p className="text-xl font-black">{kpis.poTotal.toLocaleString('ar-AE')}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                        <p className="text-white/50 text-xs font-bold">فواتير مشتريات (مستحقة)</p>
                                        <p className="text-xl font-black text-amber-300">{kpis.invDue.toLocaleString('ar-AE')}</p>
                                    </div>
                                </div>

                                <h3 className="font-black text-lg mb-2">أوامر الشراء</h3>
                                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5 mb-8">
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/20 text-white/70">
                                            <tr>
                                                <th className="p-3 text-start">رقم الأمر</th>
                                                <th className="p-3 text-start">الحالة</th>
                                                <th className="p-3 text-start">المبلغ</th>
                                                <th className="p-3 text-start">التاريخ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pos.map((p) => (
                                                <tr key={p.id} className="border-t border-white/10">
                                                    <td className="p-3 font-bold">{p.po_number || p.id}</td>
                                                    <td className="p-3">{p.status}</td>
                                                    <td className="p-3">{Number(p.total_amount ?? 0).toLocaleString('ar-AE')}</td>
                                                    <td className="p-3">{p.issue_date || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {pos.length === 0 && <div className="p-8 text-center text-white/50">لا توجد أوامر شراء</div>}
                                </div>

                                <h3 className="font-black text-lg mb-2">فواتير المشتريات</h3>
                                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5 mb-8">
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/20 text-white/70">
                                            <tr>
                                                <th className="p-3 text-start">رقم</th>
                                                <th className="p-3 text-start">المبلغ</th>
                                                <th className="p-3 text-start">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.map((i) => (
                                                <tr key={i.id} className="border-t border-white/10">
                                                    <td className="p-3">{i.invoice_no}</td>
                                                    <td className="p-3">{Number(i.total ?? 0).toLocaleString('ar-AE')}</td>
                                                    <td className="p-3">{i.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {invoices.length === 0 && <div className="p-8 text-center text-white/50">لا توجد فواتير</div>}
                                </div>

                                <h3 className="font-black text-lg mb-2">المدفوعات السابقة</h3>
                                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                                    <table className="w-full text-sm">
                                        <thead className="bg-black/20 text-white/70">
                                            <tr>
                                                <th className="p-3 text-start">المبلغ</th>
                                                <th className="p-3 text-start">الطريقة</th>
                                                <th className="p-3 text-start">التاريخ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.map((p) => (
                                                <tr key={p.id} className="border-t border-white/10">
                                                    <td className="p-3">{Number(p.amount ?? 0).toLocaleString('ar-AE')}</td>
                                                    <td className="p-3">{p.method}</td>
                                                    <td className="p-3">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-AE') : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {payments.length === 0 && <div className="p-8 text-center text-white/50">لا توجد مدفوعات</div>}
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
