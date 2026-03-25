import React, { useEffect, useMemo, useState } from 'react';
import { FileArchive, FilePlus2, Filter, ShieldCheck, Stethoscope } from 'lucide-react';
import PharmacyPageHeader from '@/components/pharmacy/PharmacyPageHeader';
import PrescriptionEditorModal from '@/components/pharmacy/PrescriptionEditorModal';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useAuth } from '@/context/AuthContext';
import {
  createPrescriptionDraft,
  loadInsuranceClaims,
  loadPharmacyCatalog,
  loadPharmacyPosSnapshot,
  loadPrescriptionDetails,
  loadPrescriptionQueue,
  updatePrescriptionDraft,
} from '@/services/pharmacyService';
import type { PharmacyInsuranceClaim, PharmacyPrescriptionDraftInput, PharmacyPrescriptionSummary } from '@/types/pharmacy';
import { formatCurrency, formatDate, normalizePharmacyError } from '@/utils/pharmacy';

const tabClass = (active: boolean) =>
  `rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
    active ? 'bg-[#071C3B] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
  }`;

const PrescriptionManagementScreen: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'list' | 'new' | 'archive' | 'claims'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queue, setQueue] = useState<PharmacyPrescriptionSummary[]>([]);
  const [claims, setClaims] = useState<PharmacyInsuranceClaim[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; name_ar?: string | null }>>([]);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof loadPharmacyCatalog>>>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<PharmacyPrescriptionDraftInput | null>(null);
  const [filters, setFilters] = useState({
    branch_id: '',
    patient_id: '',
    doctor: '',
    status: 'all',
    date_from: '',
    date_to: '',
  });

  const archivedRows = useMemo(
    () => queue.filter((item) => ['dispensed', 'cancelled', 'expired'].includes(item.status)),
    [queue]
  );

  const activeRows = useMemo(
    () => queue.filter((item) => !['dispensed', 'cancelled', 'expired'].includes(item.status)),
    [queue]
  );

  useEffect(() => {
    if (!user?.tenant_id) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, user.branch_id || undefined);
        const [productsRows, claimsRows, queueRows] = await Promise.all([
          loadPharmacyCatalog(user.tenant_id),
          loadInsuranceClaims(user.tenant_id, user.branch_id || undefined),
          loadPrescriptionQueue(user.tenant_id, { branch_id: user.branch_id || undefined }),
        ]);
        setBranches(snapshot.branches);
        setPatients(snapshot.patients.map((patient) => ({ id: patient.id, name: patient.name })));
        setProducts(productsRows);
        setClaims(claimsRows);
        setQueue(queueRows);
        setFilters((current) => ({ ...current, branch_id: user.branch_id || snapshot.branches[0]?.id || '' }));
      } catch (loadError) {
        setError(normalizePharmacyError(loadError, 'تعذر تحميل إدارة الوصفات.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.branch_id, user?.tenant_id]);

  const applyFilters = async () => {
    if (!user?.tenant_id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const rows = await loadPrescriptionQueue(user.tenant_id, {
        branch_id: filters.branch_id || undefined,
        patient_id: filters.patient_id || undefined,
        doctor: filters.doctor || undefined,
        status: filters.status as PharmacyPrescriptionSummary['status'] | 'all',
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      });
      setQueue(rows);
    } catch (filterError) {
      setError(normalizePharmacyError(filterError, 'تعذر تحميل قائمة الوصفات بعد تطبيق الفلاتر.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async (value: PharmacyPrescriptionDraftInput) => {
    if (!user?.tenant_id) return;
    try {
      if (value.id) {
        await updatePrescriptionDraft(user.tenant_id, value);
        setSuccess('تم تحديث الوصفة بنجاح.');
      } else {
        await createPrescriptionDraft(user.tenant_id, value);
        setSuccess('تم إنشاء الوصفة بنجاح.');
      }
      setEditorOpen(false);
      const rows = await loadPrescriptionQueue(user.tenant_id, { branch_id: filters.branch_id || undefined });
      setQueue(rows);
    } catch (saveError) {
      setError(normalizePharmacyError(saveError, 'تعذر حفظ الوصفة.'));
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <PharmacyPageHeader
        title="إدارة الوصفات الطبية"
        subtitle="إدارة كاملة للوصفات، المراجعة، الأرشيف، ورؤية أولية لمطالبات التأمين فوق بنية الصيدلية الجديدة."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingDraft(null);
              setEditorOpen(true);
              setTab('new');
            }}
            className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
          >
            وصفة جديدة
          </button>
        }
      />

      {error ? <StatusBanner variant="error">{error}</StatusBanner> : null}
      {success ? <StatusBanner variant="success">{success}</StatusBanner> : null}

      {!loading && branches.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          السبب: لا يوجد فرع نشط — لن تُحمَّل الوصفات أو المطالبات بشكل صحيح حتى يُضاف فرع للمستأجر.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab('list')} className={tabClass(tab === 'list')}>
          <span className="inline-flex items-center gap-2">
            <Stethoscope size={16} />
            قائمة الوصفات
          </span>
        </button>
        <button type="button" onClick={() => { setEditingDraft(null); setEditorOpen(true); setTab('new'); }} className={tabClass(tab === 'new')}>
          <span className="inline-flex items-center gap-2">
            <FilePlus2 size={16} />
            وصفة جديدة
          </span>
        </button>
        <button type="button" onClick={() => setTab('archive')} className={tabClass(tab === 'archive')}>
          <span className="inline-flex items-center gap-2">
            <FileArchive size={16} />
            الأرشيف
          </span>
        </button>
        <button type="button" onClick={() => setTab('claims')} className={tabClass(tab === 'claims')}>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={16} />
            مطالبات التأمين
          </span>
        </button>
      </div>

      {(tab === 'list' || tab === 'archive') && (
        <>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#071C3B]">
              <Filter size={16} />
              فلاتر البحث
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <select value={filters.branch_id} onChange={(event) => setFilters((current) => ({ ...current, branch_id: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3">
                <option value="">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name_ar || branch.name}
                  </option>
                ))}
              </select>
              <select value={filters.patient_id} onChange={(event) => setFilters((current) => ({ ...current, patient_id: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3">
                <option value="">كل المرضى</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
              <input value={filters.doctor} onChange={(event) => setFilters((current) => ({ ...current, doctor: event.target.value }))} placeholder="اسم الطبيب" className="rounded-2xl border border-slate-200 px-4 py-3" />
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3">
                <option value="all">كل الحالات</option>
                <option value="draft">Draft</option>
                <option value="verified">Verified</option>
                <option value="partially_dispensed">Partially dispensed</option>
                <option value="dispensed">Dispensed</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
              <input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
              <div className="flex gap-3">
                <input type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3" />
                <button type="button" onClick={applyFilters} className="rounded-2xl bg-[#071C3B] px-4 py-3 text-sm font-bold text-white">
                  تطبيق
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              ملاحظة: الوصفات التجريبية تُربط بفرع محدد. إن لم تظهر نتائج، اختر «كل الفروع» أو جرّب فرعًا آخر من فلتر الفرع.
            </p>
          </section>

          <DataTable
            data={tab === 'list' ? activeRows : archivedRows}
            className="!rounded-[24px]"
            emptyMessage={
              tab === 'list'
                ? 'السبب: لا توجد وصفات نشطة مطابقة للفلاتر الحالية (فرع/مريض/طبيب/حالة/تواريخ). جرّب «كل الفروع» أو غيّر حالة الفلتر.'
                : 'السبب: لا توجد وصفات في الأرشيف مطابقة للفلاتر الحالية.'
            }
            onRowClick={(row) => {
              if (!user?.tenant_id) return;
              void (async () => {
                try {
                  const details = await loadPrescriptionDetails(user.tenant_id, row.id);
                  setEditingDraft({
                    id: details.id,
                    branch_id: details.branch_id,
                    patient_id: details.patient_id,
                    prescription_date: details.prescription_date,
                    source_type: details.source_type,
                    status: details.status,
                    doctor_name: details.doctor_name ?? undefined,
                    doctor_license: details.doctor_license ?? undefined,
                    notes: details.notes ?? undefined,
                    insurance_provider: details.insurance_provider ?? undefined,
                    policy_number: details.policy_number ?? undefined,
                    items: details.items.map((item) => ({
                      id: item.id,
                      product_id: item.product_id,
                      prescribed_qty: item.prescribed_qty,
                      dispensed_qty: item.dispensed_qty,
                      dosage_instructions: item.dosage_instructions ?? undefined,
                      duration_text: item.duration_text ?? undefined,
                      substitutions_allowed: item.substitutions_allowed,
                      status: item.status,
                      note: item.note ?? undefined,
                    })),
                  });
                  setEditorOpen(true);
                } catch (detailsError) {
                  setError(normalizePharmacyError(detailsError, 'تعذر تحميل تفاصيل الوصفة للتعديل.'));
                }
              })();
            }}
            columns={[
              { header: 'رقم الوصفة', accessorKey: 'prescription_number' },
              { header: 'المريض', accessorKey: (row) => row.patient_name ?? '—' },
              { header: 'الطبيب', accessorKey: (row) => row.doctor_name ?? '—' },
              { header: 'التاريخ', accessorKey: (row) => formatDate(row.prescription_date) },
              { header: 'الحالة', accessorKey: 'status' },
              { header: 'البنود', accessorKey: (row) => row.item_count.toLocaleString('ar-AE') },
            ]}
          />
        </>
      )}

      {tab === 'claims' && (
        <DataTable
          data={claims}
          className="!rounded-[24px]"
          emptyMessage="السبب: لا توجد مطالبات تأمين ضمن الفرع/النطاق الحالي."
          columns={[
            { header: 'رقم المطالبة', accessorKey: (row) => row.claim_number ?? '—' },
            { header: 'شركة التأمين', accessorKey: (row) => row.insurer_name ?? '—' },
            { header: 'الحالة', accessorKey: 'status' },
            { header: 'المبلغ المطالب', accessorKey: (row) => formatCurrency(row.claimed_amount) },
            { header: 'المبلغ المعتمد', accessorKey: (row) => formatCurrency(row.approved_amount) },
            { header: 'تاريخ الإنشاء', accessorKey: (row) => formatDate(row.created_at) },
          ]}
        />
      )}

      <PrescriptionEditorModal
        open={editorOpen}
        branchId={filters.branch_id || user?.branch_id || branches[0]?.id || ''}
        patients={patients}
        products={products}
        initialValue={editingDraft}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSaveDraft}
      />
    </div>
  );
};

export default PrescriptionManagementScreen;
