import React, { useState } from 'react';

interface InsuranceClaimModalProps {
  open: boolean;
  dispenseId?: string | null;
  patientName?: string | null;
  suggestedAmount?: number;
  onClose: () => void;
  onSubmit: (input: {
    dispenseId: string;
    insurerName: string;
    policyNumber: string;
    claimedAmount: number;
    submissionPayload: Record<string, unknown>;
  }) => Promise<void> | void;
}

const InsuranceClaimModal: React.FC<InsuranceClaimModalProps> = ({
  open,
  dispenseId,
  patientName,
  suggestedAmount = 0,
  onClose,
  onSubmit,
}) => {
  const [insurerName, setInsurerName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [claimedAmount, setClaimedAmount] = useState(suggestedAmount);
  const [notes, setNotes] = useState('');

  if (!open || !dispenseId) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" dir="rtl">
      <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-[#071C3B]">إنشاء مطالبة تأمين</h3>
        <p className="mt-1 text-sm text-slate-500">لعملية الصرف الحالية {patientName ? `للمريض ${patientName}` : ''}</p>

        <div className="mt-5 grid gap-4">
          <input
            value={insurerName}
            onChange={(event) => setInsurerName(event.target.value)}
            placeholder="اسم شركة التأمين"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
          <input
            value={policyNumber}
            onChange={(event) => setPolicyNumber(event.target.value)}
            placeholder="رقم الوثيقة"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
          <input
            type="number"
            value={claimedAmount}
            onChange={(event) => setClaimedAmount(Number(event.target.value))}
            placeholder="القيمة المطالب بها"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="ملاحظات داخلية"
            rows={3}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-2.5 font-bold text-slate-600">
            إلغاء
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                dispenseId,
                insurerName,
                policyNumber,
                claimedAmount,
                submissionPayload: { notes },
              })
            }
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 font-bold text-white"
          >
            حفظ المطالبة
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsuranceClaimModal;
