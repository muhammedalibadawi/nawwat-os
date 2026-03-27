import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PharmacyPatientOption, PharmacyPrescriptionDraftInput, PharmacyProduct } from '@/types/pharmacy';

interface PrescriptionEditorModalProps {
  open: boolean;
  branchId: string;
  patients: PharmacyPatientOption[];
  products: PharmacyProduct[];
  initialValue?: PharmacyPrescriptionDraftInput | null;
  onClose: () => void;
  onSubmit: (value: PharmacyPrescriptionDraftInput) => Promise<void> | void;
}

const emptyItem = (): PharmacyPrescriptionDraftInput['items'][number] => ({
  product_id: '',
  prescribed_qty: 1,
  dosage_instructions: '',
  duration_text: '',
  substitutions_allowed: false,
  status: 'pending',
  note: '',
});

const PrescriptionEditorModal: React.FC<PrescriptionEditorModalProps> = ({
  open,
  branchId,
  patients,
  products,
  initialValue,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<PharmacyPrescriptionDraftInput>({
    branch_id: branchId,
    patient_id: '',
    prescription_date: new Date().toISOString().slice(0, 10),
    source_type: 'manual',
    status: 'draft',
    doctor_name: '',
    doctor_license: '',
    notes: '',
    insurance_provider: '',
    policy_number: '',
    items: [emptyItem()],
  });

  useEffect(() => {
    if (!open) return;
    if (initialValue) {
      setForm({
        ...initialValue,
        branch_id: initialValue.branch_id || branchId,
        items: initialValue.items.length ? initialValue.items : [emptyItem()],
      });
      return;
    }

    setForm({
      branch_id: branchId,
      patient_id: '',
      prescription_date: new Date().toISOString().slice(0, 10),
      source_type: 'manual',
      status: 'draft',
      doctor_name: '',
      doctor_license: '',
      notes: '',
      insurance_provider: '',
      policy_number: '',
      items: [emptyItem()],
    });
  }, [branchId, initialValue, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" dir="rtl">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-lg font-black text-[#071C3B]">{initialValue ? 'تعديل الوصفة' : 'إنشاء وصفة جديدة'}</h3>
          <p className="mt-1 text-sm text-slate-500">الوصفة قابلة للصرف الجزئي لاحقًا من شاشة POS الصيدلية.</p>
        </div>

        <div className="max-h-[68vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={form.patient_id}
              onChange={(event) => setForm((current) => ({ ...current, patient_id: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">اختر المريض</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            <input
              value={form.doctor_name ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, doctor_name: event.target.value }))}
              placeholder="اسم الطبيب"
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
            <input
              value={form.doctor_license ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, doctor_license: event.target.value }))}
              placeholder="رقم ترخيص الطبيب"
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
            <input
              type="date"
              value={form.prescription_date}
              onChange={(event) => setForm((current) => ({ ...current, prescription_date: event.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input
              value={form.insurance_provider ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, insurance_provider: event.target.value }))}
              placeholder="شركة التأمين"
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
            <input
              value={form.policy_number ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, policy_number: event.target.value }))}
              placeholder="رقم الوثيقة"
              className="rounded-2xl border border-slate-200 px-4 py-3"
            />
            <select
              value={form.source_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, source_type: event.target.value as PharmacyPrescriptionDraftInput['source_type'] }))
              }
              className="rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="manual">يدوي</option>
              <option value="uploaded">مرفوع</option>
              <option value="erx">eRx</option>
              <option value="walk_in">Walk-in</option>
            </select>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-[#071C3B]">بنود الوصفة</h4>
                <p className="text-xs text-slate-500">أضف الجرعات والتعليمات ومدى السماح بالبدائل.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-[#071C3B]"
              >
                <Plus size={16} />
                إضافة بند
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-3 xl:grid-cols-5">
                    <select
                      value={item.product_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, product_id: event.target.value } : entry
                          ),
                        }))
                      }
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <option value="">اختر الصنف</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.brand_name || product.item_name || product.generic_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={item.prescribed_qty}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, prescribed_qty: Number(event.target.value) } : entry
                          ),
                        }))
                      }
                      placeholder="الكمية"
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    />
                    <input
                      value={item.dosage_instructions ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, dosage_instructions: event.target.value } : entry
                          ),
                        }))
                      }
                      placeholder="تعليمات الجرعة"
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    />
                    <input
                      value={item.duration_text ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, duration_text: event.target.value } : entry
                          ),
                        }))
                      }
                      placeholder="المدة"
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    />
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <label className="text-sm font-bold text-slate-700">بدائل مسموحة</label>
                      <input
                        type="checkbox"
                        checked={item.substitutions_allowed ?? false}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            items: current.items.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, substitutions_allowed: event.target.checked } : entry
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <input
                      value={item.note ?? ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, note: event.target.value } : entry
                          ),
                        }))
                      }
                      placeholder="ملاحظات على البند"
                      className="flex-1 rounded-2xl border border-slate-200 px-4 py-3"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          items: current.items.length > 1 ? current.items.filter((_, entryIndex) => entryIndex !== index) : current.items,
                        }))
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
                    >
                      <Trash2 size={16} />
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <textarea
            value={form.notes ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            placeholder="ملاحظات عامة على الوصفة"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-2.5 font-bold text-slate-600">
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => onSubmit({ ...form, branch_id: branchId })}
              className="rounded-2xl bg-[#071C3B] px-5 py-2.5 font-bold text-white"
            >
              حفظ الوصفة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionEditorModal;
