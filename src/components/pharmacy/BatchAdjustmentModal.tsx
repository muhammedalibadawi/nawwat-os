import React, { useState } from 'react';
import type { PharmacyAdjustBatchInput, PharmacyBatch } from '@/types/pharmacy';

interface BatchAdjustmentModalProps {
  open: boolean;
  batch?: PharmacyBatch | null;
  onClose: () => void;
  onSubmit: (input: PharmacyAdjustBatchInput) => Promise<void> | void;
}

const BatchAdjustmentModal: React.FC<BatchAdjustmentModalProps> = ({ open, batch, onClose, onSubmit }) => {
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [movementType, setMovementType] = useState<PharmacyAdjustBatchInput['movement_type']>('adjustment');
  const [note, setNote] = useState('');

  if (!open || !batch) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-[#071C3B]">تعديل مخزون دفعة</h3>
        <p className="mt-1 text-sm text-slate-500">دفعة {batch.batch_number} • المتاح الحالي {batch.available_qty.toLocaleString('ar-AE')}</p>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">نوع الحركة</label>
            <select
              value={movementType}
              onChange={(event) => setMovementType(event.target.value as PharmacyAdjustBatchInput['movement_type'])}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="adjustment">تعديل يدوي</option>
              <option value="damage">تلف</option>
              <option value="reserve">حجز</option>
              <option value="release">فك حجز</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">الكمية</label>
            <input
              type="number"
              value={adjustmentQty}
              onChange={(event) => setAdjustmentQty(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">ملاحظة التدقيق</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-2.5 font-bold text-slate-600">
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ batch_id: batch.id, adjustment_qty: adjustmentQty, movement_type: movementType, note })}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 font-bold text-white"
          >
            حفظ التعديل
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchAdjustmentModal;
