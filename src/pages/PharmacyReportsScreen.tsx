import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ShieldAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PharmacyPageHeader from '@/components/pharmacy/PharmacyPageHeader';
import ExpiryBadge from '@/components/pharmacy/ExpiryBadge';
import { DataTable } from '@/components/ui/DataTable';
import { useAuth } from '@/context/AuthContext';
import { loadPharmacyPosSnapshot, loadPharmacyReports } from '@/services/pharmacyService';
import type { PharmacyReportSnapshot } from '@/types/pharmacy';
import { formatCurrency, normalizePharmacyError } from '@/utils/pharmacy';

const chartColors = ['#071C3B', '#00CFFF', '#1B6CA8', '#4F46E5', '#0EA5A4', '#F59E0B'];

const tabClass = (active: boolean) =>
  `rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
    active ? 'bg-[#071C3B] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
  }`;

const EmptyReportState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

const PharmacyReportsScreen: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'sales' | 'top' | 'expiry' | 'margin' | 'returns' | 'claims' | 'movement' | 'controlled'>('sales');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; name_ar?: string | null }>>([]);
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState<PharmacyReportSnapshot | null>(null);

  const totalSales = useMemo(() => report?.sales.reduce((sum, point) => sum + point.total, 0) ?? 0, [report]);

  const reload = async () => {
    if (!user?.tenant_id) return;
    setLoading(true);
    setError('');
    try {
      const rows = await loadPharmacyReports(user.tenant_id, {
        branch_id: branchId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setReport(rows);
    } catch (loadError) {
      setError(normalizePharmacyError(loadError, 'تعذر تحميل تقارير الصيدلية.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    void (async () => {
      try {
        const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, user.branch_id || undefined);
        setBranches(snapshot.branches);
        setBranchId(user.branch_id || snapshot.branches[0]?.id || '');
      } catch (loadError) {
        setError(normalizePharmacyError(loadError, 'تعذر تحميل الفروع لتقارير الصيدلية.'));
      }
    })();
  }, [user?.branch_id, user?.tenant_id]);

  useEffect(() => {
    void reload();
  }, [branchId, dateFrom, dateTo, user?.tenant_id]);

  return (
    <div dir="rtl" className="space-y-6">
      <PharmacyPageHeader
        title="تقارير الصيدلية"
        subtitle="لوحات تشغيلية للمبيعات، الصرف، المخاطر، الهوامش، المرتجعات، ومطالبات التأمين."
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

      {branches.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          لا يوجد فرع نشط — التقارير قد تظهر فارغة أو غير ممثلة للفرع حتى يُضاف فرع.
        </div>
      ) : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name_ar || branch.name}
              </option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" />
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm font-bold text-cyan-900">
            إجمالي المبيعات: {formatCurrency(totalSales)}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab('sales')} className={tabClass(tab === 'sales')}>المبيعات</button>
        <button type="button" onClick={() => setTab('top')} className={tabClass(tab === 'top')}>الأكثر صرفًا</button>
        <button type="button" onClick={() => setTab('expiry')} className={tabClass(tab === 'expiry')}>قريب/منتهي الصلاحية</button>
        <button type="button" onClick={() => setTab('margin')} className={tabClass(tab === 'margin')}>هامش الربح</button>
        <button type="button" onClick={() => setTab('returns')} className={tabClass(tab === 'returns')}>المرتجعات</button>
        <button type="button" onClick={() => setTab('claims')} className={tabClass(tab === 'claims')}>مطالبات التأمين</button>
        <button type="button" onClick={() => setTab('movement')} className={tabClass(tab === 'movement')}>حركة المخزون</button>
        <button type="button" onClick={() => setTab('controlled')} className={tabClass(tab === 'controlled')}>Controlled</button>
      </div>

      {loading || !report ? (
        <div className="h-96 animate-pulse rounded-[28px] bg-slate-100" />
      ) : tab === 'sales' ? (
        report.sales.length ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-[#071C3B]">Daily / Monthly Sales</h3>
                <p className="text-sm text-slate-500">مجمعة زمنياً بمفتاح YYYY-MM ثم معروضة بالعربية.</p>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.sales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#071C3B" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : (
          <EmptyReportState message="لا توجد بيانات مبيعات ضمن الفلاتر الحالية." />
        )
      ) : tab === 'top' ? (
        report.topMedicines.length ? (
          <DataTable
            data={report.topMedicines}
            className="!rounded-[24px]"
            emptyMessage="لا توجد أدوية ضمن ترتيب الصرف لهذه الفلاتر."
            columns={[
              { header: 'الدواء', accessorKey: 'label' },
              { header: 'الكمية', accessorKey: (row) => row.quantity.toLocaleString('ar-AE') },
              { header: 'الإيراد', accessorKey: (row) => formatCurrency(row.revenue) },
            ]}
          />
        ) : (
          <EmptyReportState message="لا توجد بيانات «الأكثر صرفًا» ضمن الفلاتر الحالية — جرّب توسيع نطاق التاريخ أو اختيار «كل الفروع»." />
        )
      ) : tab === 'expiry' ? (
        report.expiryRisk.length ? (
          <DataTable
            data={report.expiryRisk}
            className="!rounded-[24px]"
            columns={[
              { header: 'الدواء', accessorKey: (row) => row.brand_name || row.item_name || row.generic_name || 'دواء' },
              { header: 'الدفعة', accessorKey: 'batch_number' },
              { header: 'الصلاحية', accessorKey: (row) => <ExpiryBadge expiryDate={row.expiry_date} /> },
              { header: 'المتاح', accessorKey: (row) => row.available_qty.toLocaleString('ar-AE') },
            ]}
          />
        ) : (
          <EmptyReportState message="لا توجد دفعات عالية المخاطرة حاليًا." />
        )
      ) : tab === 'margin' ? (
        report.grossMargin.length ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <DataTable
              data={report.grossMargin}
              className="!rounded-[24px]"
              columns={[
                { header: 'الدواء', accessorKey: 'label' },
                { header: 'الإيراد', accessorKey: (row) => formatCurrency(row.revenue) },
                { header: 'الهامش %', accessorKey: (row) => `${row.margin.toFixed(1)}%` },
              ]}
            />
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-black text-[#071C3B]">Target Food Cost Suggestion</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={report.grossMargin.slice(0, 5)} dataKey="revenue" nameKey="label" innerRadius={55} outerRadius={92}>
                      {report.grossMargin.slice(0, 5).map((entry, index) => (
                        <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                الاقتراح التشغيلي الافتراضي لنسبة تكلفة الدواء/المنتج: <span className="font-black text-[#071C3B]">30%</span>
              </div>
            </section>
          </section>
        ) : (
          <EmptyReportState message="لا توجد بيانات كافية لحساب هامش الربح." />
        )
      ) : tab === 'returns' ? (
        report.supplierReturns.length ? (
          <DataTable
            data={report.supplierReturns}
            className="!rounded-[24px]"
            emptyMessage="لا توجد مرتجعات مورد ضمن الفلاتر."
            columns={[
              { header: 'المرتجع', accessorKey: 'label' },
              { header: 'القيمة', accessorKey: (row) => formatCurrency(row.total_amount) },
            ]}
          />
        ) : (
          <EmptyReportState message="لا توجد مرتجعات مورد في الفترة أو الفرع المختار." />
        )
      ) : tab === 'claims' ? (
        report.insuranceClaims.length ? (
          <DataTable
            data={report.insuranceClaims}
            className="!rounded-[24px]"
            emptyMessage="لا توجد مطالبات تأمين في هذا العرض."
            columns={[
              { header: 'الحالة', accessorKey: 'status' },
              { header: 'العدد', accessorKey: (row) => row.count.toLocaleString('ar-AE') },
              { header: 'المطالب', accessorKey: (row) => formatCurrency(row.claimed_amount) },
            ]}
          />
        ) : (
          <EmptyReportState message="لا توجد بيانات مطالبات تأمين مجمّعة ضمن الفلاتر الحالية." />
        )
      ) : tab === 'movement' ? (
        report.stockMovements.length ? (
          <DataTable
            data={report.stockMovements}
            className="!rounded-[24px]"
            emptyMessage="لا توجد حركات مخزون في هذا العرض."
            columns={[
              { header: 'التاريخ', accessorKey: (row) => new Date(row.date).toLocaleString('ar-AE') },
              { header: 'النوع', accessorKey: 'movement_type' },
              { header: 'الكمية', accessorKey: (row) => row.quantity.toLocaleString('ar-AE') },
            ]}
          />
        ) : (
          <EmptyReportState message="لا توجد حركة مخزون مسجلة ضمن الفلاتر — قد يكون الفرع بلا صرف أو استلام بعد." />
        )
      ) : report.controlledMovement.length ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-100 text-fuchsia-700">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-[#071C3B]">Controlled drugs movement log</h3>
              <p className="text-sm text-slate-500">عرض سريع للحركات الخاصة بالأدوية الخاضعة للرقابة.</p>
            </div>
          </div>
          <DataTable
            data={report.controlledMovement}
            className="!rounded-[24px]"
            columns={[
              { header: 'الدواء', accessorKey: 'label' },
              { header: 'الكمية', accessorKey: (row) => row.quantity.toLocaleString('ar-AE') },
              { header: 'الدفعة', accessorKey: 'batch_number' },
              { header: 'التاريخ', accessorKey: (row) => new Date(row.created_at).toLocaleString('ar-AE') },
            ]}
          />
        </section>
      ) : (
        <EmptyReportState message="لا توجد حركات للأدوية الخاضعة للرقابة ضمن الفلاتر الحالية." />
      )}
    </div>
  );
};

export default PharmacyReportsScreen;
