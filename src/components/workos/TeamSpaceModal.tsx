import React, { useEffect, useState } from 'react';
import type { WorkTeamSpaceFormInput } from '@/types/workos';
import { WORK_VISIBILITY_OPTIONS, buildWorkSlug } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface TeamSpaceModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: WorkTeamSpaceFormInput | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: WorkTeamSpaceFormInput) => Promise<void> | void;
}

const emptyValue: WorkTeamSpaceFormInput = {
  name: '',
  slug: '',
  description: '',
  visibility: 'internal',
  is_default: false,
  is_active: true,
  color: '#00CFFF',
};

const TeamSpaceModal: React.FC<TeamSpaceModalProps> = ({
  open,
  mode,
  initialValue,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<WorkTeamSpaceFormInput>(emptyValue);

  useEffect(() => {
    if (!open) return;
    setForm(initialValue ? { ...emptyValue, ...initialValue } : emptyValue);
  }, [initialValue, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      name: form.name.trim(),
      slug: form.slug?.trim() ? buildWorkSlug(form.slug) : buildWorkSlug(form.name, 'space'),
    });
  };

  return (
    <WorkModalShell
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'مساحة فريق جديدة' : 'تعديل مساحة الفريق'}
      subtitle="نموذج خفيف لإنشاء أو تحديث المساحة الأساسية التي تجمع المشاريع والمستندات والقنوات."
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
            form="work-team-space-form"
            disabled={submitting || !form.name.trim()}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الحفظ...' : mode === 'create' ? 'إنشاء المساحة' : 'حفظ التغييرات'}
          </button>
        </div>
      }
      maxWidthClassName="max-w-2xl"
    >
      <form id="work-team-space-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">اسم المساحة</label>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            onBlur={() =>
              setForm((current) => ({
                ...current,
                slug: current.slug?.trim() ? current.slug : buildWorkSlug(current.name, 'space'),
              }))
            }
            placeholder="مثال: فريق العمليات"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">Slug</label>
          <input
            value={form.slug ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="team-ops"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الرؤية</label>
          <select
            value={form.visibility}
            onChange={(event) =>
              setForm((current) => ({ ...current, visibility: event.target.value as WorkTeamSpaceFormInput['visibility'] }))
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">وصف مختصر</label>
          <textarea
            value={form.description ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            placeholder="ما الغرض من هذه المساحة؟ وما نوع العمل المتوقع داخلها؟"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">اللون</label>
          <input
            value={form.color ?? '#00CFFF'}
            onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
            placeholder="#00CFFF"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(form.is_default)}
            onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          اجعلها المساحة الافتراضية
        </label>

        <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={form.is_active !== false}
            onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          المساحة نشطة وقابلة للاستخدام الآن
        </label>
      </form>
    </WorkModalShell>
  );
};

export default TeamSpaceModal;
