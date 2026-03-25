import React from 'react';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import type { PharmacyCartLine } from '@/types/pharmacy';
import ControlledDrugBadge from '@/components/pharmacy/ControlledDrugBadge';
import ExpiryBadge from '@/components/pharmacy/ExpiryBadge';
import { calculateCartTotals, formatCurrency } from '@/utils/pharmacy';

interface DispenseCartPanelProps {
  title: string;
  lines: PharmacyCartLine[];
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  footer?: React.ReactNode;
}

const iconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100';

const DispenseCartPanel: React.FC<DispenseCartPanelProps> = ({
  title,
  lines,
  onIncrease,
  onDecrease,
  onRemove,
  footer,
}) => {
  const totals = calculateCartTotals(lines);

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#071C3B] text-white">
          <ShoppingCart size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-[#071C3B]">{title}</h3>
          <p className="text-sm text-slate-500">السلة الحالية تعتمد على batch محدد ومنطق صرف آمن.</p>
        </div>
      </div>

      {lines.length ? (
        <>
          <div className="space-y-3">
            {lines.map((line) => (
              <article key={line.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#071C3B]">{line.product_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {line.generic_name ? `${line.generic_name} • ` : ''}
                      {line.batch_number ? `دفعة ${line.batch_number}` : 'بدون دفعة'}
                    </div>
                  </div>
                  <button type="button" onClick={() => onRemove(line.id)} className={iconButtonClass} title="حذف">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ExpiryBadge expiryDate={line.expiry_date} compact />
                  <ControlledDrugBadge controlled={line.controlled_drug} />
                  {line.requires_prescription ? (
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">
                      Prescription
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onDecrease(line.id)} className={iconButtonClass}>
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[42px] text-center text-sm font-black text-[#071C3B]">
                      {line.quantity.toLocaleString('ar-AE')}
                    </span>
                    <button type="button" onClick={() => onIncrease(line.id)} className={iconButtonClass}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="text-end">
                    <div className="text-xs text-slate-500">سعر الوحدة</div>
                    <div className="text-sm font-black text-[#071C3B]">{formatCurrency(line.unit_price)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-[#071C3B] p-4 text-white">
            <div className="flex items-center justify-between text-sm">
              <span>الإجمالي قبل الضريبة</span>
              <span className="font-bold">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>الضريبة</span>
              <span className="font-bold">{formatCurrency(totals.tax)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>الخصم</span>
              <span className="font-bold">{formatCurrency(totals.discount)}</span>
            </div>
            <div className="mt-3 border-t border-white/10 pt-3 text-base font-black">
              <div className="flex items-center justify-between">
                <span>الإجمالي النهائي</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {footer ? <div className="mt-4">{footer}</div> : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          السبب: لا توجد عناصر في سلة الصرف الحالية. أضف صنفًا من نتائج البحث بعد اختيار الفرع/الدفعة المناسبة.
        </div>
      )}
    </section>
  );
};

export default DispenseCartPanel;
