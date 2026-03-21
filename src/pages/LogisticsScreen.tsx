import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ShipmentRow {
    id: string;
    shipment_no: string | null;
    status: string | null;
    branch_id: string | null;
    created_at: string;
}

const LogisticsScreen: React.FC = () => {
    const { user } = useAuth();
    const [rows, setRows] = useState<ShipmentRow[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'in_transit' | 'delivered'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        if (!user?.tenant_id) return;
        setLoading(true);
        setError('');
        try {
            const { data, error: qErr } = await supabase
                .from('shipments')
                .select('id,shipment_no,status,branch_id,created_at')
                .eq('tenant_id', user.tenant_id)
                .order('created_at', { ascending: false });
            if (qErr) throw qErr;
            setRows((data ?? []) as ShipmentRow[]);
        } catch (err: any) {
            setError(err?.message ?? 'فشل تحميل الشحنات');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [user?.tenant_id]);

    const filtered = useMemo(() => {
        if (filter === 'all') return rows;
        return rows.filter((r) => (r.status || '').toLowerCase() === filter);
    }, [rows, filter]);

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black text-[#071C3B]">Logistics Shipments</h1>
                <button className="px-4 py-2 rounded-lg bg-[#071C3B] text-white font-bold">شحنة جديدة</button>
            </div>

            <div className="bg-white border rounded-xl p-3 flex gap-2">
                <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded ${filter === 'all' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>كل</button>
                <button onClick={() => setFilter('pending')} className={`px-3 py-1.5 rounded ${filter === 'pending' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>معلق</button>
                <button onClick={() => setFilter('in_transit')} className={`px-3 py-1.5 rounded ${filter === 'in_transit' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>في الطريق</button>
                <button onClick={() => setFilter('delivered')} className={`px-3 py-1.5 rounded ${filter === 'delivered' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>تم التسليم</button>
            </div>

            {loading && <div className="bg-white border rounded-xl p-6 text-center">جاري التحميل...</div>}
            {!loading && error && <div className="bg-white border rounded-xl p-6 text-center text-red-600">{error}</div>}
            {!loading && !error && filtered.length === 0 && <div className="bg-white border rounded-xl p-6 text-center">لا توجد شحنات</div>}

            {!loading && !error && filtered.length > 0 && (
                <div className="bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-start">رقم الشحنة</th>
                                <th className="p-3 text-start">الحالة</th>
                                <th className="p-3 text-start">الفرع</th>
                                <th className="p-3 text-start">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => (
                                <tr key={r.id} className="border-t">
                                    <td className="p-3 font-bold">{r.shipment_no || r.id}</td>
                                    <td className="p-3">{r.status || '—'}</td>
                                    <td className="p-3">{r.branch_id || '—'}</td>
                                    <td className="p-3">{new Date(r.created_at).toLocaleString('ar-AE')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LogisticsScreen;
