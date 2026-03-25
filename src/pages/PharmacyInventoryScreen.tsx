import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, ClipboardList, RotateCcw, ShieldAlert } from 'lucide-react';
import PharmacyPageHeader from '@/components/pharmacy/PharmacyPageHeader';
import BatchAdjustmentModal from '@/components/pharmacy/BatchAdjustmentModal';
import SupplierReturnModal from '@/components/pharmacy/SupplierReturnModal';
import ExpiryBadge from '@/components/pharmacy/ExpiryBadge';
import { DataTable } from '@/components/ui/DataTable';
import { useAuth } from '@/context/AuthContext';
import { StatusBanner } from '@/components/ui/StatusBanner';
import {
  adjustBatchStock,
  createSupplierReturn,
  loadBatches,
  loadPharmacyPosSnapshot,
  loadPharmacyReports,
  markBatchExpired,
} from '@/services/pharmacyService';
import type { PharmacyBatch } from '@/types/pharmacy';
import { formatCurrency, normalizePharmacyError } from '@/utils/pharmacy';

const tabClass = (active: boolean) =>
  `rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
    active ? 'bg-[#071C3B] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
  }`;

const PharmacyInventoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'current' | 'batches' | 'near' | 'expired' | 'low' | 'adjust' | 'returns'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; name_ar?: string | null }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [batches, setBatches] = useState<PharmacyBatch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<PharmacyBatch | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reportMovements, setReportMovements] = useState<Array<{ date: string; movement_type: string; quantity: number }>>([]);

  const visibleRows = useMemo(() => {
    switch (tab) {
      case 'current':
        return batches.filter((batch) => batch.is_active && !batch.is_expired);
      case 'near':
        return batches.filter((batch) => batch.is_near_expiry);
      case 'expired':
        return batches.filter((batch) => batch.is_expired);
      case 'low':
        return batches.filter((batch) => batch.available_qty <= 5);
      default:
        return batches;
    }
  }, [batches, tab]);

  const reload = async (tenantId: string, branchId: string) => {
    const [rows, snapshot, reports] = await Promise.all([
      loadBatches(tenantId, { branch_id: branchId }),
      loadPharmacyPosSnapshot(tenantId, branchId),
      loadPharmacyReports(tenantId, { branch_id: branchId }),
    ]);
    setBatches(rows);
    setSuppliers(snapshot.suppliers);
    setReportMovements(reports.stockMovements);
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, user.branch_id || undefined);
        setBranches(snapshot.branches);
        const branchId = user.branch_id || snapshot.branches[0]?.id || '';
        setSelectedBranchId(branchId);
        if (branchId) {
          await reload(user.tenant_id, branchId);
        }
      } catch (loadError) {
        setError(normalizePharmacyError(loadError, 'تعذر تحميل مخزون الصيدلية.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.branch_id, user?.tenant_id]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedBranchId) return;
    void reload(user.tenant_id, selectedBranchId).catch((loadError) => {
      setError(normalizePharmacyError(loadError, 'تعذر تحديث مخزون الفرع الحالي.'));
    });
  }, [selectedBranchId, user?.tenant_id]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    if (!user?.tenant_id || !selectedBranchId) return;
    setError('');
    setSuccess('');
    try {
      await action();
      await reload(user.tenant_id, selectedBranchId);
      setSuccess(successMessage);
    } catch (actionError) {
      setError(normalizePharmacyError(actionError, 'تعذر تنفيذ العملية على دفعة الصيدلية.'));
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <PharmacyPageHeader
        title="مخزون الصيدلية"
        subtitle="إدارة batch-aware للمخزون والصلاحية والتعديلات ومرتجعات الموردين من شاشة واحدة."
        actions={
          <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id} className="text-slate-900">
                {branch.name_ar || branch.name}
              </option>
            ))}
          </select>
        }
      />

      {(error || success) && (
        <div className="mt-4 space-y-2">
          {error ? <StatusBanner variant="error" className="rounded-2xl">{error}</StatusBanner> : null}
          {success ? <StatusBanner variant="success" className="rounded-2xl">{success}</StatusBanner> : null}
        </div>
      )}

      {!loading && branches.length === 0 ? (
        <StatusBanner variant="warning" className="rounded-2xl">
          السبب: لا يوجد فرع نشط — لا يمكن عرض دفعات الصيدلية حتى يُضاف فرع للمستأجر/الفرع الحالي.
        </StatusBanner>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab('current')} className={tabClass(tab === 'current')}>المخزون الحالي</button>
        <button type="button" onClick={() => setTab('batches')} className={tabClass(tab === 'batches')}>الدُفعات</button>
        <button type="button" onClick={() => setTab('near')} className={tabClass(tab === 'near')}>قريب الانتهاء</button>
        <button type="button" onClick={() => setTab('expired')} className={tabClass(tab === 'expired')}>منتهي</button>
        <button type="button" onClick={() => setTab('low')} className={tabClass(tab === 'low')}>تحت الحد</button>
        <button type="button" onClick={() => setTab('adjust')} className={tabClass(tab === 'adjust')}>الجرد والتعديل</button>
        <button type="button" onClick={() => setTab('returns')} className={tabClass(tab === 'returns')}>مرتجع المورد</button>
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-[28px] bg-slate-100" />
      ) : tab === 'adjust' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {!loading && selectedBranchId && batches.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              السبب: لا توجد دفعات مسجلة لهذا الفرع بعد. إن وُضعت بذور على فرع آخر فاختره من القائمة أعلاه، أو نفّذ استلامًا من «استلام الأدوية».
            </div>
          ) : null}
          {!loading && selectedBranchId && batches.length > 0 && visibleRows.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              السبب: لا توجد دفعات ضمن هذا التبويب للفرع المختار (جميع الدفعات خارج معايير التبويب الحالي).
            </div>
          ) : null}
          <DataTable
            data={visibleRows}
            className="!rounded-[24px]"
            emptyMessage="السبب: لا توجد دفعات مطابقة لمعايير هذا العرض/التبويب الحالي."
            onRowClick={(row) => setSelectedBatch(row)}
            columns={[
              { header: 'المنتج', accessorKey: (row) => row.brand_name || row.item_name || row.generic_name || 'دواء' },
              { header: 'الدفعة', accessorKey: 'batch_number' },
              { header: 'الصلاحية', accessorKey: (row) => <ExpiryBadge expiryDate={row.expiry_date} compact /> },
              { header: 'المتاح', accessorKey: (row) => row.available_qty.toLocaleString('ar-AE') },
              { header: 'التكلفة', accessorKey: (row) => formatCurrency(row.purchase_cost) },
            ]}
          />
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <ClipboardList size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-[#071C3B]">إجراءات الدفعة</h3>
                <p className="text-sm text-slate-500">اختر دفعة من الجدول ثم نفّذ الإجراء المناسب.</p>
              </div>
            </div>
            {selectedBatch ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-[#071C3B]">{selectedBatch.brand_name || selectedBatch.item_name || selectedBatch.generic_name}</div>
                  <div className="mt-1 text-xs text-slate-500">دفعة {selectedBatch.batch_number}</div>
                </div>
                <button type="button" onClick={() => setAdjustmentOpen(true)} className="w-full rounded-2xl bg-[#071C3B] px-4 py-3 text-sm font-bold text-white">
                  تعديل المخزون
                </button>
                <button type="button" onClick={() => runAction(async () => { await markBatchExpired(selectedBatch.id); }, 'تم تعليم الدفعة كمنتهية بنجاح.')} className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                  تعليم كمنتهي
                </button>
                <button type="button" onClick={() => setReturnOpen(true)} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">
                  إنشاء مرتجع للمورد
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                اختر دفعة من الجدول لعرض الإجراءات.
              </div>
            )}
          </section>
        </div>
      ) : tab === 'returns' ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-[#071C3B]">سجل حركة المخزون</h3>
              <p className="text-sm text-slate-500">آخر الحركات المرتبطة بالاستلام والصرف والتلف والمرتجعات.</p>
            </div>
          </div>
          <DataTable
            data={reportMovements}
            className="!rounded-[24px]"
            emptyMessage="السبب: لا توجد حركات مخزون مسجّلة لهذا الفرع بعد."
            columns={[
              { header: 'التاريخ', accessorKey: (row) => new Date(row.date).toLocaleString('ar-AE') },
              { header: 'نوع الحركة', accessorKey: 'movement_type' },
              { header: 'الكمية', accessorKey: (row) => row.quantity.toLocaleString('ar-AE') },
            ]}
          />
        </section>
      ) : (
        <>
          {!loading && selectedBranchId && batches.length === 0 ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              السبب: لا توجد دفعات لهذا الفرع حتى الآن. جرّب فرعًا آخر إن وُضعت البذور هناك، أو سجّل استلامًا من «استلام الأدوية».
            </div>
          ) : null}
          {!loading && selectedBranchId && batches.length > 0 && visibleRows.length === 0 ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              السبب: توجد دفعات لهذا الفرع لكن لا شيء يطابق معايير التبويب الحالي (مثلاً لا دفعات قريبة الانتهاء أو تحت الحد).
            </div>
          ) : null}
          <DataTable
            data={visibleRows}
            className="!rounded-[24px]"
            emptyMessage="السبب: لا توجد دفعات مطابقة لمعايير هذا العرض/التبويب الحالي."
            onRowClick={(row) => setSelectedBatch(row)}
            columns={[
            { header: 'المنتج', accessorKey: (row) => row.brand_name || row.item_name || row.generic_name || 'دواء' },
            { header: 'الدفعة', accessorKey: 'batch_number' },
            { header: 'الفرع', accessorKey: (row) => row.branch_name ?? '—' },
            { header: 'الصلاحية', accessorKey: (row) => <ExpiryBadge expiryDate={row.expiry_date} compact /> },
            { header: 'المتاح', accessorKey: (row) => row.available_qty.toLocaleString('ar-AE') },
            { header: 'التكلفة', accessorKey: (row) => formatCurrency(row.purchase_cost) },
            { header: 'السعر', accessorKey: (row) => formatCurrency(row.selling_price) },
            {
              header: 'حالة المخاطرة',
              accessorKey: (row) =>
                row.is_expired ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">
                    <ShieldAlert size={12} />
                    منتهي
                  </span>
                ) : row.is_near_expiry ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                    <AlertTriangle size={12} />
                    قريب الانتهاء
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    <Boxes size={12} />
                    مستقر
                  </span>
                ),
            },
          ]}
          />
        </>
      )}

      <BatchAdjustmentModal
        open={adjustmentOpen}
        batch={selectedBatch}
        onClose={() => setAdjustmentOpen(false)}
        onSubmit={async (input) => {
          await runAction(async () => {
            await adjustBatchStock(input);
          }, 'تم تعديل مخزون الدفعة بنجاح.');
          setAdjustmentOpen(false);
        }}
      />

      <SupplierReturnModal
        open={returnOpen}
        branchId={selectedBranchId}
        suppliers={suppliers}
        selectedBatch={selectedBatch}
        onClose={() => setReturnOpen(false)}
        onSubmit={async (input) => {
          await runAction(async () => {
            await createSupplierReturn(input);
          }, 'تم إنشاء مرتجع المورد بنجاح.');
          setReturnOpen(false);
        }}
      />
    </div>
  );
};

export default PharmacyInventoryScreen;
