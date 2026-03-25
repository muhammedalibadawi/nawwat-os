import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, User } from 'lucide-react';
import PharmacyPageHeader from '@/components/pharmacy/PharmacyPageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { useAuth } from '@/context/AuthContext';
import { loadPatientMedicationHistory, loadPharmacyPosSnapshot } from '@/services/pharmacyService';
import type { PharmacyMedicationHistoryEntry } from '@/types/pharmacy';
import { formatDate, normalizePharmacyError } from '@/utils/pharmacy';
import { StatusBanner } from '@/components/ui/StatusBanner';

const PatientMedicationHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [rows, setRows] = useState<PharmacyMedicationHistoryEntry[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!user?.tenant_id) return;
    void (async () => {
      setLoading(true);
      try {
        const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, user.branch_id || undefined);
        const patientOptions = snapshot.patients.map((patient) => ({ id: patient.id, name: patient.name }));
        setPatients(patientOptions);
        const firstPatientId = patientOptions[0]?.id || '';
        setSelectedPatientId(firstPatientId);
        if (firstPatientId) {
          const history = await loadPatientMedicationHistory(user.tenant_id, firstPatientId);
          setRows(history);
        }
      } catch (loadError) {
        setError(normalizePharmacyError(loadError, 'تعذر تحميل التاريخ الدوائي.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.branch_id, user?.tenant_id]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (dateFrom && (!row.last_dispensed_at || row.last_dispensed_at < dateFrom)) return false;
        if (dateTo && (!row.last_dispensed_at || row.last_dispensed_at > `${dateTo}T23:59:59.999Z`)) return false;
        return true;
      }),
    [dateFrom, dateTo, rows]
  );

  const handlePatientChange = async (patientId: string) => {
    if (!user?.tenant_id) return;
    setSelectedPatientId(patientId);
    setLoading(true);
    setError('');
    try {
      const history = await loadPatientMedicationHistory(user.tenant_id, patientId);
      setRows(history);
    } catch (historyError) {
      setError(normalizePharmacyError(historyError, 'تعذر تحميل تاريخ هذا المريض.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <PharmacyPageHeader
        title="التاريخ الدوائي للمريض"
        subtitle="عرض سريع لآخر الأدوية المصروفة والكميات وتكرار الصرف من داخل قطاع الصيدلية."
      />

      {error ? (
        <div className="mt-4">
          <StatusBanner variant="error" className="rounded-2xl">
            {error}
          </StatusBanner>
        </div>
      ) : null}

      {!loading && patients.length === 0 ? (
        <StatusBanner variant="warning" className="rounded-2xl">
          السبب: لا يوجد مرضى أو عملاء (نوع مريض/عميل) في القائمة لهذا tenant/مساحة العمل بعد. أضف جهة اتصال من شاشة العملاء أو طبّق بذور التجربة لعرض التاريخ الدوائي.
        </StatusBanner>
      ) : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#071C3B]">
              <User size={16} />
              المريض
            </div>
            <select
              value={selectedPatientId}
              onChange={(event) => void handlePatientChange(event.target.value)}
              disabled={patients.length === 0}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {patients.length === 0 ? (
                <option value="">لا يوجد مرضى للاختيار</option>
              ) : (
                patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#071C3B]">
              <Clock3 size={16} />
              من تاريخ
            </div>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-sm font-bold text-[#071C3B]">إلى تاريخ</div>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-cyan-900">
            يتم تحديث هذا السجل بعد كل صرف ناجح من الوصفة أو OTC عند ربط المريض.
          </div>
        </div>
      </section>

      {loading ? (
        <div className="h-80 animate-pulse rounded-[28px] bg-slate-100" />
      ) : !selectedPatientId ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
          اختر مريضًا لعرض سجل الأدوية المصروفة.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
          {rows.length === 0
            ? 'لا يوجد صرف مسجل لهذا المريض بعد (وصفة أو OTC مرتبط بالمريض).'
            : 'لا توجد صفوف ضمن نطاق التاريخ المحدد — غيّر التواريخ أو امسحها لعرض كل السجل.'}
        </div>
      ) : (
        <DataTable
          data={filteredRows}
          className="!rounded-[24px]"
          columns={[
            { header: 'الدواء', accessorKey: (row) => row.product?.brand_name || row.product?.item_name || row.product?.generic_name || 'دواء' },
            { header: 'الاسم العلمي', accessorKey: (row) => row.product?.generic_name || '—' },
            { header: 'آخر صرف', accessorKey: (row) => formatDate(row.last_dispensed_at) },
            { header: 'آخر كمية', accessorKey: (row) => (row.last_quantity ?? 0).toLocaleString('ar-AE') },
            { header: 'عدد مرات الصرف', accessorKey: (row) => row.dispense_count.toLocaleString('ar-AE') },
            { header: 'ملاحظات', accessorKey: (row) => row.notes ?? '—' },
          ]}
        />
      )}
    </div>
  );
};

export default PatientMedicationHistoryScreen;
