import React, { useEffect, useMemo, useState } from 'react';
import type { WorkChannelFormInput, WorkProject, WorkTeamSpace } from '@/types/workos';
import { WORK_CHANNEL_TYPE_OPTIONS, WORK_VISIBILITY_OPTIONS, buildWorkSlug } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface WorkChannelModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: WorkChannelFormInput | null;
  teamSpaces: WorkTeamSpace[];
  projects: WorkProject[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: WorkChannelFormInput) => Promise<void> | void;
}

const createEmptyValue = (teamSpaces: WorkTeamSpace[]): WorkChannelFormInput => ({
  team_space_id: teamSpaces[0]?.id ?? '',
  project_id: '',
  name: '',
  slug: '',
  description: '',
  channel_type: 'team',
  visibility: 'internal',
});

const WorkChannelModal: React.FC<WorkChannelModalProps> = ({
  open,
  mode,
  initialValue,
  teamSpaces,
  projects,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<WorkChannelFormInput>(createEmptyValue(teamSpaces));

  useEffect(() => {
    if (!open) return;
    setForm(initialValue ? { ...createEmptyValue(teamSpaces), ...initialValue } : createEmptyValue(teamSpaces));
  }, [initialValue, open, teamSpaces]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => !form.team_space_id || project.team_space_id === form.team_space_id),
    [form.team_space_id, projects]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      name: form.name.trim(),
      slug: form.slug?.trim() ? buildWorkSlug(form.slug) : buildWorkSlug(form.name, 'channel'),
    });
  };

  return (
    <WorkModalShell
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'قناة جديدة' : 'تعديل القناة'}
      subtitle="أنشئ قناة خفيفة لربط النقاشات بالمشروع أو بمساحة الفريق."
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
            form="work-channel-form"
            disabled={submitting || !form.name.trim() || !form.team_space_id}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الحفظ...' : mode === 'create' ? 'إنشاء القناة' : 'حفظ التغييرات'}
          </button>
        </div>
      }
      maxWidthClassName="max-w-2xl"
    >
      <form id="work-channel-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">اسم القناة</label>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            onBlur={() =>
              setForm((current) => ({
                ...current,
                slug: current.slug?.trim() ? current.slug : buildWorkSlug(current.name, 'channel'),
              }))
            }
            placeholder="مثال: متابعة الإطلاق"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">Slug</label>
          <input
            value={form.slug ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="launch-room"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">نوع القناة</label>
          <select
            value={form.channel_type}
            onChange={(event) => setForm((current) => ({ ...current, channel_type: event.target.value as WorkChannelFormInput['channel_type'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_CHANNEL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">مساحة الفريق</label>
          <select
            value={form.team_space_id}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                team_space_id: event.target.value,
                project_id: current.project_id && projects.some((project) => project.id === current.project_id && project.team_space_id === event.target.value)
                  ? current.project_id
                  : '',
              }))
            }
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
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">المشروع المرتبط</label>
          <select
            value={form.project_id ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, project_id: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="">بدون مشروع محدد</option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name_ar || project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الرؤية</label>
          <select
            value={form.visibility}
            onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as WorkChannelFormInput['visibility'] }))}
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
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">وصف القناة</label>
          <textarea
            value={form.description ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            placeholder="اكتب وصفًا مختصرًا يوضح ما الذي يناقش داخل هذه القناة."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>
      </form>
    </WorkModalShell>
  );
};

export default WorkChannelModal;
