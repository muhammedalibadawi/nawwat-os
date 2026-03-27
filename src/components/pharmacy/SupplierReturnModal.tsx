import React, { useMemo, useState } from 'react';
import type { PharmacyBatch, PharmacySupplierOption, PharmacySupplierReturnInput } from '@/types/pharmacy';

interface SupplierReturnModalProps {
  open: boolean;
  branchId: string;
  suppliers: PharmacySupplierOption[];
  selectedBatch?: PharmacyBatch | null;
  onClose: () => void;
  onSubmit: (input: PharmacySupplierReturnInput) => Promise<void> | void;
}

const SupplierReturnModal: React.FC<SupplierReturnModalProps> = ({
  open,
  branchId,
  suppliers,
  selectedBatch,
  onClose,
  onSubmit,
}) => {
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');

  const effectiveSupplierId = useMemo(() => supplierId || selectedBatch?.supplier_id || '', [selectedBatch?.supplier_id, supplierId]);

  if (!open || !selectedBatch) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-[#071C3B]">مرتجع إلى المورد</h3>
        <p className="mt-1 text-sm text-slate-500">دفعة {selectedBatch.batch_number} • المتاح الحالي {selectedBatch.available_qty.toLocaleString('ar-AE')}</p>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">المورد</label>
            <select
              value={effectiveSupplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">اختر المورد</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">الكمية</label>
            <input
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">سبب المرتجع</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
            onClick={() =>
              onSubmit({
                branch_id: branchId,
                supplier_id: effectiveSupplierId,
                reason,
                lines: [{ batch_id: selectedBatch.id, quantity, reason }],
              })
            }
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 font-bold text-white"
          >
            إنشاء المرتجع
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierReturnModal;
