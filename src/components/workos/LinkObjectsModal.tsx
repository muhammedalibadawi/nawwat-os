import React, { useEffect, useMemo, useState } from 'react';
import type { WorkLinkableOption, WorkObjectLinkInput, WorkRelationType } from '@/types/workos';
import { getObjectLabel, getRelationLabel } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface LinkObjectsModalProps {
  open: boolean;
  leftOptions: WorkLinkableOption[];
  rightOptions: WorkLinkableOption[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: WorkObjectLinkInput) => Promise<void> | void;
}

const relationTypes: WorkRelationType[] = ['belongs_to', 'references', 'discussed_in', 'created_from', 'fulfills'];

const LinkObjectsModal: React.FC<LinkObjectsModalProps> = ({
  open,
  leftOptions,
  rightOptions,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [leftKey, setLeftKey] = useState('');
  const [rightKey, setRightKey] = useState('');
  const [relationType, setRelationType] = useState<WorkRelationType>('references');
  const [note, setNote] = useState('');
  const leftMissing = leftOptions.length === 0;
  const rightMissing = rightOptions.length === 0;

  useEffect(() => {
    if (!open) return;
    const firstLeft = leftOptions[0];
    const firstRight = rightOptions.find((option) => option.id !== firstLeft?.id || option.type !== firstLeft?.type);
    setLeftKey(firstLeft ? `${firstLeft.type}:${firstLeft.id}` : '');
    setRightKey(firstRight ? `${firstRight.type}:${firstRight.id}` : '');
    setRelationType('references');
    setNote('');
  }, [leftOptions, open, rightOptions]);

  const leftOption = useMemo(
    () => leftOptions.find((option) => `${option.type}:${option.id}` === leftKey) ?? null,
    [leftKey, leftOptions]
  );
  const rightOption = useMemo(
    () => rightOptions.find((option) => `${option.type}:${option.id}` === rightKey) ?? null,
    [rightKey, rightOptions]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leftOption || !rightOption) return;

    await onSubmit({
      left_object_type: leftOption.type,
      left_object_id: leftOption.id,
      relation_type: relationType,
      right_object_type: rightOption.type,
      right_object_id: rightOption.id,
      metadata: note.trim() ? { note: note.trim() } : {},
    });
  };

  return (
    <WorkModalShell
      open={open}
      onClose={onClose}
      title="ربط عناصر WorkOS"
      subtitle="اربط مشروعًا أو مهمةً بمستند أو قناة حتى تبقى العلاقات واضحة داخل صفحة المشروع."
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="work-link-form"
            disabled={submitting || !leftOption || !rightOption}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الربط...' : 'حفظ الربط'}
          </button>
        </div>
      }
      maxWidthClassName="max-w-2xl"
    >
      <form id="work-link-form" onSubmit={handleSubmit} className="grid gap-4">
        {(leftMissing || rightMissing) ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {leftMissing && rightMissing
              ? 'لا توجد عناصر كافية على الجانبين للربط في هذا السياق.'
              : leftMissing
                ? 'لا توجد عناصر على الجانب الأيسر للربط حاليًا. أنشئ/أضف مهمة أو مشروعًا ضمن السياق أولًا.'
                : 'لا توجد عناصر على الجانب الأيمن للربط حاليًا. أنشئ/أضف مستندًا أو قناة ضمن السياق أولًا.'}
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">العنصر الأيسر</label>
          <select value={leftKey} onChange={(event) => setLeftKey(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="">اختر عنصرًا</option>
            {leftOptions.map((option) => (
              <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                {getObjectLabel(option.type)} - {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">نوع العلاقة</label>
          <select
            value={relationType}
            onChange={(event) => setRelationType(event.target.value as WorkRelationType)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {relationTypes.map((option) => (
              <option key={option} value={option}>
                {getRelationLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">العنصر الأيمن</label>
          <select value={rightKey} onChange={(event) => setRightKey(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="">اختر عنصرًا</option>
            {rightOptions.map((option) => (
              <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                {getObjectLabel(option.type)} - {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {leftOption ? `${getObjectLabel(leftOption.type)}: ${leftOption.label}` : 'اختر العنصر الأول'}
          {'  ←→  '}
          {rightOption ? `${getObjectLabel(rightOption.type)}: ${rightOption.label}` : 'اختر العنصر الثاني'}
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">ملاحظة الربط</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="اكتب سبب الربط أو سياقه إن احتجت."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>
      </form>
    </WorkModalShell>
  );
};

export default LinkObjectsModal;
