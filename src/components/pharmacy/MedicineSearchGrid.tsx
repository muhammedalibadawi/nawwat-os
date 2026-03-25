import React from 'react';
import { Pill, Plus } from 'lucide-react';
import type { PharmacyBatch } from '@/types/pharmacy';
import ControlledDrugBadge from '@/components/pharmacy/ControlledDrugBadge';
import ExpiryBadge from '@/components/pharmacy/ExpiryBadge';
import { formatCurrency, getMedicineDisplayName, getMedicineSecondaryName } from '@/utils/pharmacy';

interface MedicineSearchGridProps {
  items: PharmacyBatch[];
  onAdd: (item: PharmacyBatch) => void;
  loading?: boolean;
  emptyMessage?: string;
}

const MedicineSearchGrid: React.FC<MedicineSearchGridProps> = ({
  items,
  onAdd,
  loading = false,
  emptyMessage = 'السبب: لا توجد نتائج مطابقة للبحث الحالي أو لا توجد دفعات جاهزة في الفرع المحدد.',
}) => {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
          <Pill size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-[#071C3B]">نتائج البحث الدوائي</h3>
          <p className="text-sm text-slate-500">نتائج batch-aware مع أقرب صلاحية وسعر الصرف.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={`${item.id}:${item.batch_number}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-[#071C3B]">{getMedicineDisplayName(item)}</h4>
                  <p className="mt-1 text-xs text-slate-500">{getMedicineSecondaryName(item) || 'بدون تفاصيل إضافية'}</p>
                </div>
                <div className="text-sm font-black text-[#071C3B]">{formatCurrency(item.selling_price)}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.requires_prescription ? (
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">
                    Prescription
                  </span>
                ) : null}
                <ControlledDrugBadge controlled={item.controlled_drug} />
                <ExpiryBadge expiryDate={item.expiry_date} compact />
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>الدفعة</span>
                  <span className="font-bold text-slate-900">{item.batch_number}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>المتاح</span>
                  <span className="font-bold text-emerald-700">{item.available_qty.toLocaleString('ar-AE')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الفرع</span>
                  <span className="font-bold text-slate-900">{item.branch_name ?? '—'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onAdd(item)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#071C3B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0d2a55]"
              >
                <Plus size={16} />
                إضافة إلى الصرف
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </section>
  );
};

export default MedicineSearchGrid;
