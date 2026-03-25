import React from 'react';
import { ChevronLeft, ClipboardCheck } from 'lucide-react';
import type { PharmacyPrescriptionSummary } from '@/types/pharmacy';
import { formatDate } from '@/utils/pharmacy';

interface PrescriptionQueueProps {
  items: PharmacyPrescriptionSummary[];
  selectedId?: string | null;
  onSelect: (item: PharmacyPrescriptionSummary) => void;
  loading?: boolean;
  /** نص إضافي عند فراغ الطابور (مثلاً توضيح فرع البذور) */
  emptyHint?: string;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  verified: 'bg-cyan-100 text-cyan-800',
  partially_dispensed: 'bg-amber-100 text-amber-800',
  dispensed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
  expired: 'bg-rose-100 text-rose-800',
};

const PrescriptionQueue: React.FC<PrescriptionQueueProps> = ({ items, selectedId, onSelect, loading = false, emptyHint }) => {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
          <ClipboardCheck size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-[#071C3B]">طابور الوصفات</h3>
          <p className="text-sm text-slate-500">الوصفات الجاهزة للمراجعة أو الصرف الجزئي.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full rounded-2xl border p-4 text-start transition ${
                  active ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#071C3B]">{item.prescription_number}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.patient_name ?? 'مريض غير محدد'}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[item.status] ?? statusStyles.draft}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDate(item.prescription_date)}</span>
                  <span>{item.item_count} بنود</span>
                  <span className="inline-flex items-center gap-1 text-[#071C3B]">
                    فتح الوصفة
                    <ChevronLeft size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          <p className="font-bold text-slate-600">السبب: لا توجد وصفات في طابور الفرع الحالي (مسودة/معتمدة/صرف جزئي).</p>
          {emptyHint ? <p className="mt-3 text-xs leading-relaxed text-slate-500">{emptyHint}</p> : null}
        </div>
      )}
    </section>
  );
};

export default PrescriptionQueue;
