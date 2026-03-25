import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, Stethoscope, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type {
  PharmacyBatch,
  PharmacyCartLine,
  PharmacyDispenseMode,
  PharmacyPaymentMethod,
  PharmacyPatientOption,
  PharmacyPrescriptionDraftInput,
  PharmacyPrescriptionDetails,
  PharmacyPrescriptionSummary,
  PharmacyProduct,
} from '@/types/pharmacy';
import {
  completeOtcSale,
  createPrescriptionDraft,
  dispensePrescription,
  loadBatches,
  loadPharmacyCatalog,
  loadPharmacyPosSnapshot,
  loadPrescriptionDetails,
  searchPharmacyProducts,
  updatePrescriptionDraft,
} from '@/services/pharmacyService';
import { calculateCartTotals, makeCartLineKey, normalizePharmacyError } from '@/utils/pharmacy';
import PharmacyPageHeader from '@/components/pharmacy/PharmacyPageHeader';
import PatientSummaryCard from '@/components/pharmacy/PatientSummaryCard';
import PrescriptionQueue from '@/components/pharmacy/PrescriptionQueue';
import MedicineSearchGrid from '@/components/pharmacy/MedicineSearchGrid';
import DispenseCartPanel from '@/components/pharmacy/DispenseCartPanel';
import BatchSelectorModal from '@/components/pharmacy/BatchSelectorModal';
import PrescriptionEditorModal from '@/components/pharmacy/PrescriptionEditorModal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { classifyRuntimeError, getRuntimeClassificationMessage } from '@/utils/runtimeClassification';

const tabButton = (active: boolean) =>
  `rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
    active ? 'bg-[#071C3B] text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'
  }`;

const PharmacyPOSScreen: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<PharmacyDispenseMode>('prescription');
  const [activePane, setActivePane] = useState<'patient' | 'search' | 'cart'>('patient');
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; name_ar?: string | null }>>([]);
  const [patients, setPatients] = useState<PharmacyPatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [queue, setQueue] = useState<PharmacyPrescriptionSummary[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<PharmacyPrescriptionDetails | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<PharmacyBatch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PharmacyBatch[]>([]);
  const [cartLines, setCartLines] = useState<PharmacyCartLine[]>([]);
  const [batchModalTarget, setBatchModalTarget] = useState<{
    productName: string;
    batches: PharmacyBatch[];
    sourcePrescriptionItemId?: string;
    product?: PharmacyProduct;
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [catalog, setCatalog] = useState<PharmacyProduct[]>([]);
  const [editingDraft, setEditingDraft] = useState<PharmacyPrescriptionDraftInput | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PharmacyPaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );
  const totals = useMemo(() => calculateCartTotals(cartLines), [cartLines]);

  const switchDispenseMode = (nextMode: PharmacyDispenseMode) => {
    setMode(nextMode);
    // منع خلط بنية الصرف بين prescription وOTC.
    setCartLines([]);
    setBatchModalTarget(null);
    setEditorOpen(false);
    setEditingDraft(null);
    if (nextMode === 'otc') setSelectedPrescription(null);
    setActivePane('patient');
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    void (async () => {
      setSnapshotLoading(true);
      setError('');
      try {
        const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, user.branch_id || undefined);
        setBranches(snapshot.branches);
        setPatients(snapshot.patients);
        setQueue(snapshot.prescriptionQueue);
        setFeaturedProducts(snapshot.featuredProducts);
        setSelectedBranchId(snapshot.selectedBranchId || snapshot.branches[0]?.id || '');
        setSelectedPatientId(snapshot.patients[0]?.id || '');
        setSearchResults(snapshot.featuredProducts);
        const pharmacyCatalog = await loadPharmacyCatalog(user.tenant_id);
        setCatalog(pharmacyCatalog);
      } catch (loadError) {
        const fallback = normalizePharmacyError(loadError, 'تعذر تحميل شاشة الصيدلية.');
        setError(getRuntimeClassificationMessage(classifyRuntimeError(loadError), fallback));
      } finally {
        setSnapshotLoading(false);
      }
    })();
  }, [user?.branch_id, user?.tenant_id]);

  useEffect(() => {
    setPaymentAmount(totals.total);
  }, [totals.total]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedBranchId) return;
    if (!searchTerm.trim()) {
      setSearchResults(featuredProducts);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const rows = await searchPharmacyProducts(user.tenant_id, selectedBranchId, searchTerm);
        setSearchResults(rows);
      } catch (searchError) {
        setError(normalizePharmacyError(searchError, 'تعذر تنفيذ البحث الدوائي.'));
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [featuredProducts, searchTerm, selectedBranchId, user?.tenant_id]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedBranchId) return;
    void (async () => {
      try {
        await reloadBranchData();
      } catch (refreshError) {
        const fallback = normalizePharmacyError(refreshError, 'تعذر تحديث بيانات الفرع الحالي.');
        setError(getRuntimeClassificationMessage(classifyRuntimeError(refreshError), fallback));
      }
    })();
  }, [selectedBranchId, user?.tenant_id]);

  const reloadBranchData = async () => {
    if (!user?.tenant_id || !selectedBranchId) return;
    const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, selectedBranchId);
    setQueue(snapshot.prescriptionQueue);
    setFeaturedProducts(snapshot.featuredProducts);
    if (!searchTerm.trim()) setSearchResults(snapshot.featuredProducts);
  };

  const addSelectedBatchToCart = (batch: PharmacyBatch, sourcePrescriptionItemId?: string) => {
    const product = catalog.find((entry) => entry.id === batch.product_id);
    const line: PharmacyCartLine = {
      id: makeCartLineKey('pharma', `${batch.product_id}-${batch.id}`),
      product_id: batch.product_id,
      product_name: batch.brand_name || batch.item_name || 'دواء',
      generic_name: batch.generic_name,
      strength: batch.strength,
      dosage_form: batch.dosage_form,
      requires_prescription: batch.requires_prescription,
      controlled_drug: batch.controlled_drug,
      batch_id: batch.id,
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      available_qty: batch.available_qty,
      unit_price: batch.selling_price,
      quantity: 1,
      tax_amount: 0,
      discount_amount: 0,
      line_total: batch.selling_price,
      source_prescription_item_id: sourcePrescriptionItemId ?? null,
      note: product?.metadata?.note ? String(product.metadata.note) : undefined,
    };
    setCartLines((current) => [...current, line]);
    setBatchModalTarget(null);
    setActivePane('cart');
  };

  const openBatchChoices = async (productId: string, sourcePrescriptionItemId?: string, fallbackName?: string) => {
    if (!user?.tenant_id || !selectedBranchId) return;
    try {
      const batches = await loadBatches(user.tenant_id, {
        branch_id: selectedBranchId,
        product_id: productId,
        active_only: true,
      });
      setBatchModalTarget({
        productName: fallbackName || batches[0]?.brand_name || batches[0]?.item_name || 'دواء',
        batches,
        sourcePrescriptionItemId,
        product: catalog.find((product) => product.id === productId),
      });
    } catch (batchError) {
      setError(normalizePharmacyError(batchError, 'تعذر تحميل الدفعات المتاحة لهذا الصنف.'));
    }
  };

  const handleSelectPrescription = async (item: PharmacyPrescriptionSummary) => {
    if (!user?.tenant_id) return;
    try {
      const details = await loadPrescriptionDetails(user.tenant_id, item.id);
      setSelectedPrescription(details);
      setSelectedPatientId(details.patient_id);
      setMode('prescription');
      setActivePane('patient');
    } catch (detailsError) {
      setError(normalizePharmacyError(detailsError, 'تعذر فتح تفاصيل الوصفة.'));
    }
  };

  const handleDispense = async () => {
    if (!selectedBranchId || !cartLines.length) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'prescription') {
        if (!selectedPrescription) throw new Error('اختر وصفة أولًا قبل تنفيذ الصرف.');
        const grouped = new Map<string, number>();
        cartLines.forEach((line) => {
          if (!line.source_prescription_item_id) return;
          grouped.set(line.source_prescription_item_id, (grouped.get(line.source_prescription_item_id) ?? 0) + line.quantity);
        });
        const result = await dispensePrescription({
          prescription_id: selectedPrescription.id,
          branch_id: selectedBranchId,
          lines: Array.from(grouped.entries()).map(([prescriptionItemId, quantity]) => ({
            prescription_item_id: prescriptionItemId,
            quantity,
          })),
          payments: paymentAmount > 0 ? [{ method: paymentMethod, amount: paymentAmount }] : [],
          notes: 'تم تنفيذ الصرف من شاشة POS الصيدلية',
          controlled_note: cartLines.some((line) => line.controlled_drug) ? 'تمت مراجعة الدواء الخاضع للرقابة من الصيدلي.' : undefined,
        });
        setSuccess(`تم صرف الوصفة بنجاح. رقم العملية: ${String(result.dispense_number ?? '—')}`);
      } else {
        const grouped = new Map<string, number>();
        cartLines.forEach((line) => {
          grouped.set(line.product_id, (grouped.get(line.product_id) ?? 0) + line.quantity);
        });
        const result = await completeOtcSale({
          branch_id: selectedBranchId,
          patient_id: selectedPatientId || undefined,
          lines: Array.from(grouped.entries()).map(([productId, quantity]) => ({ product_id: productId, quantity })),
          payments: paymentAmount > 0 ? [{ method: paymentMethod, amount: paymentAmount }] : [],
          notes: 'بيع OTC من شاشة الصيدلية',
          controlled_note: cartLines.some((line) => line.controlled_drug) ? 'تمت مراجعة الدواء الخاضع للرقابة قبل البيع.' : undefined,
        });
        setSuccess(`تم إتمام بيع OTC بنجاح. رقم العملية: ${String(result.dispense_number ?? '—')}`);
      }

      setCartLines([]);
      setSelectedPrescription(null);
      await reloadBranchData();
      setActivePane('patient');
    } catch (submitError) {
      setError(normalizePharmacyError(submitError, 'تعذر تنفيذ عملية الصرف الحالية.'));
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async (draft: PharmacyPrescriptionDraftInput) => {
    if (!user?.tenant_id) return;
    try {
      if (draft.id) {
        await updatePrescriptionDraft(user.tenant_id, draft);
        setSuccess('تم تحديث مسودة الوصفة بنجاح.');
      } else {
        await createPrescriptionDraft(user.tenant_id, draft);
        setSuccess('تم حفظ مسودة الوصفة بنجاح.');
      }
      setEditorOpen(false);
      await reloadBranchData();
    } catch (draftError) {
      setError(normalizePharmacyError(draftError, 'تعذر حفظ مسودة الوصفة.'));
    }
  };

  const desktopPanels = (
    <div className="xl:flex xl:flex-row-reverse xl:gap-6">
      <div className="space-y-6 xl:w-[320px] xl:shrink-0">
        <PatientSummaryCard patient={selectedPatient} prescription={selectedPrescription ?? undefined} />
        {mode === 'prescription' ? (
          <PrescriptionQueue
            items={queue}
            selectedId={selectedPrescription?.id}
            onSelect={handleSelectPrescription}
            loading={snapshotLoading}
            emptyHint="إن وُضعت وصفات تجريبية على فرع محدد، اختره من القائمة. يمكنك أيضًا إنشاء وصفة جديدة من الزر أعلاه."
          />
        ) : (
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-[#071C3B]">اختيار المريض</h3>
            <p className="mt-1 text-sm text-slate-500">ربط البيع بتاريخ المريض اختياري في OTC ومهم للوصفة.</p>
            <select
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">بدون مريض</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </section>
        )}
      </div>

      <div className="mt-6 space-y-6 xl:mt-0 xl:min-w-0 xl:flex-1">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name_ar || branch.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 right-4 my-auto text-slate-400" size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ابحث بالباركود، SKU، الاسم التجاري أو العلمي"
                className="w-full rounded-2xl border border-slate-200 py-3 pr-11 pl-4"
              />
            </div>
          </div>

          {mode === 'prescription' && selectedPrescription ? (
            <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
              <div className="text-sm font-black text-[#071C3B]">بنود الوصفة المحددة</div>
              <div className="mt-3 grid gap-3">
                {selectedPrescription.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white bg-white/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-[#071C3B]">
                          {item.product?.brand_name || item.product?.item_name || item.product?.generic_name || 'دواء'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.dosage_instructions || 'بدون تعليمات'} • {item.duration_text || 'بدون مدة'}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        {item.dispensed_qty.toLocaleString('ar-AE')} / {item.prescribed_qty.toLocaleString('ar-AE')}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          openBatchChoices(
                            item.product_id,
                            item.id,
                            item.product?.brand_name || item.product?.item_name || item.product?.generic_name || undefined
                          )
                        }
                        className="rounded-2xl bg-[#071C3B] px-4 py-2 text-sm font-bold text-white"
                      >
                        إضافة للصرف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <MedicineSearchGrid
          items={searchResults}
          onAdd={(item) => openBatchChoices(item.product_id, undefined, item.brand_name || item.item_name || item.generic_name || undefined)}
          loading={searchLoading}
          emptyMessage={
            selectedBranchId
              ? 'السبب: لا توجد دفعات جاهزة للصرف في هذا الفرع بعد. جرّب فرعًا آخر أو نفّذ استلامًا من «استلام الأدوية».'
              : 'السبب: اختر فرعًا أولًا لبدء البحث.'
          }
        />
      </div>

      <div className="mt-6 xl:mt-0 xl:w-[360px] xl:shrink-0">
        <DispenseCartPanel
          title={mode === 'prescription' ? 'سلة صرف الوصفة' : 'سلة OTC'}
          lines={cartLines}
          onIncrease={(id) =>
            setCartLines((current) =>
              current.map((line) =>
                line.id === id ? { ...line, quantity: line.quantity + 1, line_total: line.unit_price * (line.quantity + 1) } : line
              )
            )
          }
          onDecrease={(id) =>
            setCartLines((current) =>
              current.flatMap((line) => {
                if (line.id !== id) return [line];
                if (line.quantity <= 1) return [];
                return [{ ...line, quantity: line.quantity - 1, line_total: line.unit_price * (line.quantity - 1) }];
              })
            )
          }
          onRemove={(id) => setCartLines((current) => current.filter((line) => line.id !== id))}
          footer={
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#071C3B]">
                  <Wallet size={16} />
                  طريقة الدفع
                </div>
                <div className="grid gap-3">
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PharmacyPaymentMethod)}
                    className="rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <option value="cash">نقد</option>
                    <option value="card">بطاقة</option>
                    <option value="transfer">تحويل</option>
                  </select>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(Number(event.target.value))}
                    className="rounded-2xl border border-slate-200 px-4 py-3"
                    placeholder="المبلغ المدفوع"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleDispense}
                disabled={!cartLines.length || saving || !selectedBranchId}
                className="w-full rounded-2xl bg-[#00CFFF] px-5 py-3 text-sm font-black text-[#071C3B] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'جارٍ التنفيذ...' : mode === 'prescription' ? 'صرف الوصفة' : 'إتمام بيع OTC'}
              </button>
              <button
                type="button"
                onClick={() => setCartLines([])}
                className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600"
              >
                إلغاء السلة الحالية
              </button>
            </div>
          }
        />
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="space-y-6">
      <PharmacyPageHeader
        title="POS الصيدلية"
        subtitle="صرف الوصفات وبيع OTC بتخصيص FEFO وحوكمة batch-aware فوق البنية المشتركة لـ NawwatOS."
        actions={
          <>
            <button type="button" onClick={() => { setEditingDraft(null); setEditorOpen(true); }} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white">
              وصفة جديدة
            </button>
            <div className="rounded-2xl bg-white/10 p-1">
              <button type="button" onClick={() => switchDispenseMode('prescription')} className={tabButton(mode === 'prescription')}>
                <span className="inline-flex items-center gap-2">
                  <Stethoscope size={16} />
                  Prescription
                </span>
              </button>
              <button type="button" onClick={() => switchDispenseMode('otc')} className={tabButton(mode === 'otc')}>
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag size={16} />
                  OTC
                </span>
              </button>
            </div>
          </>
        }
      />

      {error ? <StatusBanner variant="error">{error}</StatusBanner> : null}
      {success ? <StatusBanner variant="success">{success}</StatusBanner> : null}

      {!snapshotLoading && user?.tenant_id && branches.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          السبب: لا يوجد فرع نشط لهذا المستأجر (tenant). لن تُحمَّل دفعات أو طابور وصفات حتى يُضاف فرع.
        </div>
      ) : null}
      {!snapshotLoading && branches.length > 0 && !selectedBranchId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          السبب: لم يتم اختيار فرع لعرض الدفعات والبحث والوصفات المرتبطة به.
        </div>
      ) : null}

      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 px-4 py-3 text-sm text-cyan-900">
        التخصيص النهائي للدفعات يتم داخل RPC بشكل آمن وفق FEFO. اختيار الدفعة في الواجهة يساعد فقط في المعاينة قبل التنفيذ.
      </div>

      <div className="xl:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          <button type="button" onClick={() => setActivePane('patient')} className={tabButton(activePane === 'patient')}>
            المريض والوصفة
          </button>
          <button type="button" onClick={() => setActivePane('search')} className={tabButton(activePane === 'search')}>
            البحث
          </button>
          <button type="button" onClick={() => setActivePane('cart')} className={tabButton(activePane === 'cart')}>
            السلة
          </button>
        </div>
      </div>

      {snapshotLoading ? (
        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-96 animate-pulse rounded-[28px] bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden xl:block">{desktopPanels}</div>
          <div className="space-y-6 xl:hidden">
            {activePane === 'patient' ? (
              <>
                <PatientSummaryCard patient={selectedPatient} prescription={selectedPrescription ?? undefined} />
                {mode === 'prescription' ? (
                  <PrescriptionQueue
                    items={queue}
                    selectedId={selectedPrescription?.id}
                    onSelect={handleSelectPrescription}
                    loading={snapshotLoading}
                    emptyHint="السبب: لا توجد وصفات جاهزة للصرف للفرع المحدد حاليًا (قد تكون بيانات الوصفات/المريض مفقودة). اختر فرعًا آخر من القائمة أو أنشئ وصفة جديدة من «وصفة جديدة»."
                  />
                ) : null}
              </>
            ) : null}
            {activePane === 'search' ? (
              <>
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4">
                    <select
                      value={selectedBranchId}
                      onChange={(event) => setSelectedBranchId(event.target.value)}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <option value="">اختر الفرع</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name_ar || branch.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="ابحث بالباركود أو الاسم"
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </div>
                </div>
                <MedicineSearchGrid
                  items={searchResults}
                  onAdd={(item) => openBatchChoices(item.product_id, undefined, item.brand_name || item.item_name || item.generic_name || undefined)}
                  loading={searchLoading}
                  emptyMessage={
                    selectedBranchId
                      ? 'السبب: لا توجد دفعات جاهزة للصرف في هذا الفرع بعد. جرّب فرعًا آخر أو نفّذ استلامًا من «استلام الأدوية».'
                      : 'السبب: اختر فرعًا أولًا لبدء البحث.'
                  }
                />
              </>
            ) : null}
            {activePane === 'cart' ? (
              <DispenseCartPanel
                title={mode === 'prescription' ? 'سلة صرف الوصفة' : 'سلة OTC'}
                lines={cartLines}
                onIncrease={(id) =>
                  setCartLines((current) =>
                    current.map((line) =>
                      line.id === id ? { ...line, quantity: line.quantity + 1, line_total: line.unit_price * (line.quantity + 1) } : line
                    )
                  )
                }
                onDecrease={(id) =>
                  setCartLines((current) =>
                    current.flatMap((line) => {
                      if (line.id !== id) return [line];
                      if (line.quantity <= 1) return [];
                      return [{ ...line, quantity: line.quantity - 1, line_total: line.unit_price * (line.quantity - 1) }];
                    })
                  )
                }
                onRemove={(id) => setCartLines((current) => current.filter((line) => line.id !== id))}
                footer={
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleDispense}
                      disabled={!cartLines.length || saving || !selectedBranchId}
                      className="w-full rounded-2xl bg-[#00CFFF] px-5 py-3 text-sm font-black text-[#071C3B]"
                    >
                      {saving ? 'جارٍ التنفيذ...' : mode === 'prescription' ? 'صرف الوصفة' : 'إتمام بيع OTC'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCartLines([])}
                      className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600"
                    >
                      إلغاء السلة الحالية
                    </button>
                  </div>
                }
              />
            ) : null}
          </div>
        </>
      )}

      <BatchSelectorModal
        open={Boolean(batchModalTarget)}
        productName={batchModalTarget?.productName}
        batches={batchModalTarget?.batches ?? []}
        onClose={() => setBatchModalTarget(null)}
        onSelect={(batch) => addSelectedBatchToCart(batch, batchModalTarget?.sourcePrescriptionItemId)}
      />

      <PrescriptionEditorModal
        open={editorOpen}
        branchId={selectedBranchId}
        patients={patients}
        products={catalog}
        initialValue={editingDraft}
        onClose={() => setEditorOpen(false)}
        onSubmit={saveDraft}
      />
    </div>
  );
};

export default PharmacyPOSScreen;
