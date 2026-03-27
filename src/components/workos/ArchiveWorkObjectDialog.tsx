import React, { useState } from 'react';
import type { WorkObjectType } from '@/types/workos';
import { getObjectLabel } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface ArchiveWorkObjectDialogProps {
  open: boolean;
  objectType: WorkObjectType;
  objectLabel: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
}

const ArchiveWorkObjectDialog: React.FC<ArchiveWorkObjectDialogProps> = ({
  open,
  objectType,
  objectLabel,
  submitting = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  return (
    <WorkModalShell
      open={open}
      onClose={() => {
        setReason('');
        onClose();
      }}
      title={`أرشفة ${getObjectLabel(objectType)}`}
      subtitle="الأرشفة هنا خفيفة وآمنة، لكنها ستخفي العنصر من القوائم الرئيسية داخل WorkOS."
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setReason('');
              onClose();
            }}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            تراجع
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm(reason.trim() || undefined);
              setReason('');
            }}
            disabled={submitting}
            className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الأرشفة...' : 'تأكيد الأرشفة'}
          </button>
        </div>
      }
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-900">
          أنت على وشك أرشفة: <span className="font-black">{objectLabel}</span>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">سبب الأرشفة</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="سبب اختياري يساعد الفريق لاحقًا على فهم سبب إخفاء هذا العنصر."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>
      </div>
    </WorkModalShell>
  );
};

export default ArchiveWorkObjectDialog;
