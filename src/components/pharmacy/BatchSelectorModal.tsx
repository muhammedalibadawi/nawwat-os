import React from 'react';
import type { PharmacyBatch } from '@/types/pharmacy';
import ExpiryBadge from '@/components/pharmacy/ExpiryBadge';
import { formatCurrency } from '@/utils/pharmacy';

interface BatchSelectorModalProps {
  open: boolean;
  productName?: string;
  batches: PharmacyBatch[];
  onClose: () => void;
  onSelect: (batch: PharmacyBatch) => void;
}

const BatchSelectorModal: React.FC<BatchSelectorModalProps> = ({ open, productName, batches, onClose, onSelect }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" dir="rtl">
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-lg font-black text-[#071C3B]">اختيار الدفعة المناسبة</h3>
          <p className="mt-1 text-sm text-slate-500">
            {productName ? `الدفعات المتاحة لصنف ${productName}` : 'اختر دفعة متاحة للصرف.'}
          </p>
        </div>

        <div className="max-h-[56vh] overflow-y-auto px-6 py-5">
          {batches.length ? (
            <div className="space-y-3">
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => onSelect(batch)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-start transition hover:border-cyan-300 hover:bg-cyan-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-[#071C3B]">دفعة {batch.batch_number}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {batch.available_qty.toLocaleString('ar-AE')} متاح • {batch.branch_name ?? '—'}
                      </div>
                    </div>
                    <div className="text-sm font-black text-[#071C3B]">{formatCurrency(batch.selling_price)}</div>
                  </div>
                  <div className="mt-3">
                    <ExpiryBadge expiryDate={batch.expiry_date} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              السبب: لا توجد دفعات متاحة حاليًا لهذا الصنف في الفرع الحالي.
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 text-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchSelectorModal;
