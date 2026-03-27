import React, { useEffect, useState } from 'react';
import type { WorkProjectFormInput, WorkTeamSpace, WorkUserOption } from '@/types/workos';
import { WORK_PRIORITY_OPTIONS, WORK_PROJECT_STATUS_OPTIONS, WORK_VISIBILITY_OPTIONS } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface ProjectModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: WorkProjectFormInput | null;
  teamSpaces: WorkTeamSpace[];
  users: WorkUserOption[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: WorkProjectFormInput) => Promise<void> | void;
}

const createEmptyValue = (teamSpaces: WorkTeamSpace[]): WorkProjectFormInput => ({
  team_space_id: teamSpaces[0]?.id ?? '',
  name: '',
  description: '',
  status: 'planning',
  priority: 'medium',
  owner_user_id: '',
  lead_user_id: '',
  start_date: '',
  due_date: '',
  visibility: 'internal',
});

const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  mode,
  initialValue,
  teamSpaces,
  users,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<WorkProjectFormInput>(createEmptyValue(teamSpaces));

  useEffect(() => {
    if (!open) return;
    setForm(initialValue ? { ...createEmptyValue(teamSpaces), ...initialValue } : createEmptyValue(teamSpaces));
  }, [initialValue, open, teamSpaces]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      name: form.name.trim(),
    });
  };

  return (
    <WorkModalShell
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'مشروع جديد' : 'تعديل المشروع'}
      subtitle="أدخل المعلومات الأساسية للمشروع ثم اربطه بمساحة الفريق المناسبة."
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
            form="work-project-form"
            disabled={submitting || !form.name.trim() || !form.team_space_id}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الحفظ...' : mode === 'create' ? 'إنشاء المشروع' : 'حفظ التغييرات'}
          </button>
        </div>
      }
    >
      <form id="work-project-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">اسم المشروع</label>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="مثال: إطلاق مركز العمليات"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">مساحة الفريق</label>
          <select
            value={form.team_space_id}
            onChange={(event) => setForm((current) => ({ ...current, team_space_id: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="">اختر مساحة</option>
            {teamSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name_ar || space.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الرؤية</label>
          <select
            value={form.visibility ?? 'internal'}
            onChange={(event) =>
              setForm((current) => ({ ...current, visibility: event.target.value as WorkProjectFormInput['visibility'] }))
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
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الوصف</label>
          <textarea
            value={form.description ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            placeholder="ملخص سريع عن هدف المشروع ومخرجاته."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الحالة</label>
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as WorkProjectFormInput['status'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الأولوية</label>
          <select
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as WorkProjectFormInput['priority'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">مالك المشروع</label>
          <select
            value={form.owner_user_id ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, owner_user_id: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="">بدون مالك محدد</option>
            {users.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">قائد المتابعة</label>
          <select
            value={form.lead_user_id ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, lead_user_id: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="">بدون قائد متابعة</option>
            {users.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">تاريخ البداية</label>
          <input
            type="date"
            value={form.start_date ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">تاريخ الاستحقاق</label>
          <input
            type="date"
            value={form.due_date ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>
      </form>
    </WorkModalShell>
  );
};

export default ProjectModal;
