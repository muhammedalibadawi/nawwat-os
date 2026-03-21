import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateInvoicePDF } from '../utils/generateInvoicePDF';

type InvoiceStatus = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue';

export default function InvoicesScreen() {
    const { user } = useAuth();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('all');

    const loadInvoices = async () => {
        if (!user?.tenant_id) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { data, error: queryError } = await supabase
                .from('invoices')
                .select('id,invoice_no,total,status,created_at,amount_paid')
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false });
            if (queryError) throw queryError;
            setRows(data ?? []);
        } catch (err: any) {
            setRows([]);
            setError(err?.message ?? 'فشل تحميل الفواتير');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvoices();
    }, [user?.tenant_id]);

    const filtered = useMemo(() => {
        if (statusFilter === 'all') return rows;
        return rows.filter((r) => String(r.status || '').toLowerCase() === statusFilter);
    }, [rows, statusFilter]);

    const badgeClass = (status: string) => {
        const key = String(status || '').toLowerCase();
        if (key === 'paid') return 'bg-emerald-100 text-emerald-700';
        if (key === 'partial') return 'bg-amber-100 text-amber-700';
        if (key === 'overdue') return 'bg-red-100 text-red-700';
        return 'bg-gray-100 text-gray-700';
    };

    const handlePdf = async (row: any) => {
        if (!user?.tenant_id) return;
        try {
            const [tenantRes, itemsRes] = await Promise.all([
                supabase.from('tenants').select('id,name').eq('id', user.tenant_id).single(),
                supabase.from('invoice_items').select('*').eq('tenant_id', user.tenant_id).eq('invoice_id', row.id),
            ]);
            if (tenantRes.error) throw tenantRes.error;
            if (itemsRes.error) throw itemsRes.error;
            await generateInvoicePDF({ ...row, invoice_items: itemsRes.data ?? [] }, tenantRes.data);
        } catch (err: any) {
            setError(err?.message ?? 'فشل إنشاء PDF');
        }
    };

    return (
        <div className="p-8 h-full text-gray-700 font-nunito">
            <div className="flex items-center gap-3 mb-6">
                <FileText size={28} className="text-cyan-600" />
                <h1 className="text-2xl font-extrabold text-[#0A192F]">الفواتير</h1>
            </div>

            <div className="mb-4 flex gap-2 flex-wrap">
                {[
                    { id: 'all', label: 'الكل' },
                    { id: 'paid', label: 'مدفوع' },
                    { id: 'partial', label: 'جزئي' },
                    { id: 'unpaid', label: 'غير مدفوع' },
                    { id: 'overdue', label: 'متأخر' },
                ].map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setStatusFilter(f.id as InvoiceStatus)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
                            statusFilter === f.id ? 'bg-[#071C3B] text-white border-[#071C3B]' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {loading && <div className="p-10 text-center font-semibold text-gray-500">جاري تحميل الفواتير...</div>}
                {!loading && error && <div className="p-10 text-center font-semibold text-red-600">{error}</div>}
                {!loading && !error && filtered.length === 0 && (
                    <div className="p-10 text-center font-semibold text-gray-500">لا توجد فواتير مطابقة</div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-4">رقم الفاتورة</th>
                                <th className="px-6 py-4">التاريخ</th>
                                <th className="px-6 py-4">الإجمالي</th>
                                <th className="px-6 py-4">المدفوع</th>
                                <th className="px-6 py-4">المتبقي</th>
                                <th className="px-6 py-4">الحالة</th>
                                <th className="px-6 py-4">PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((row) => {
                                const total = Number(row.total ?? 0);
                                const paid = Number(row.amount_paid ?? 0);
                                const remaining = Math.max(0, total - paid);
                                return (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-[#071C3B]">{row.invoice_no ?? row.id}</td>
                                        <td className="px-6 py-4">{row.created_at ? new Date(row.created_at).toLocaleDateString('ar-AE') : '—'}</td>
                                        <td className="px-6 py-4 font-bold">AED {total.toFixed(2)}</td>
                                        <td className="px-6 py-4">AED {paid.toFixed(2)}</td>
                                        <td className="px-6 py-4">AED {remaining.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${badgeClass(row.status)}`}>
                                                {row.status ?? 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => handlePdf(row)} className="px-3 py-1 rounded-lg bg-[#071C3B] text-white text-xs font-bold">
                                                📄 PDF
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
