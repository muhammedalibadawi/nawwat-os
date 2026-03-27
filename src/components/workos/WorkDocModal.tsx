import React, { useEffect, useMemo, useState } from 'react';
import type { WorkDocFormInput, WorkProject, WorkTeamSpace } from '@/types/workos';
import { WORK_DOC_STATUS_OPTIONS, WORK_DOC_TYPE_OPTIONS, WORK_VISIBILITY_OPTIONS, buildWorkSlug } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface WorkDocModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: WorkDocFormInput | null;
  teamSpaces: WorkTeamSpace[];
  projects: WorkProject[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: WorkDocFormInput) => Promise<void> | void;
}

const createEmptyValue = (teamSpaces: WorkTeamSpace[]): WorkDocFormInput => ({
  team_space_id: teamSpaces[0]?.id ?? '',
  project_id: '',
  title: '',
  slug: '',
  summary: '',
  doc_type: 'page',
  status: 'draft',
  visibility: 'internal',
  initial_block_text: '',
});

const WorkDocModal: React.FC<WorkDocModalProps> = ({
  open,
  mode,
  initialValue,
  teamSpaces,
  projects,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<WorkDocFormInput>(createEmptyValue(teamSpaces));

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
      title: form.title.trim(),
      slug: form.slug?.trim() ? buildWorkSlug(form.slug) : buildWorkSlug(form.title, 'doc'),
    });
  };

  return (
    <WorkModalShell
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'مستند جديد' : 'تعديل المستند'}
      subtitle="إنشاء مستند WorkOS بسيط مع بياناته الأساسية وربطه بمشروع أو مساحة فريق."
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
            form="work-doc-form"
            disabled={submitting || !form.title.trim() || !form.team_space_id}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الحفظ...' : mode === 'create' ? 'إنشاء المستند' : 'حفظ التغييرات'}
          </button>
        </div>
      }
    >
      <form id="work-doc-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">العنوان</label>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            onBlur={() =>
              setForm((current) => ({
                ...current,
                slug: current.slug?.trim() ? current.slug : buildWorkSlug(current.title, 'doc'),
              }))
            }
            placeholder="مثال: قرار اعتماد خطة الربع الثاني"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">Slug</label>
          <input
            value={form.slug ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="q2-decision"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">نوع المستند</label>
          <select
            value={form.doc_type}
            onChange={(event) => setForm((current) => ({ ...current, doc_type: event.target.value as WorkDocFormInput['doc_type'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_DOC_TYPE_OPTIONS.map((option) => (
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
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الحالة</label>
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as WorkDocFormInput['status'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_DOC_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الرؤية</label>
          <select
            value={form.visibility}
            onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as WorkDocFormInput['visibility'] }))}
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
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">ملخص المستند</label>
          <textarea
            value={form.summary ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
            rows={4}
            placeholder="ملخص سريع يوضح محتوى المستند أو الغرض منه."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        {mode === 'create' ? (
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-bold text-[#071C3B]">كتلة افتتاحية بسيطة</label>
            <textarea
              value={form.initial_block_text ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, initial_block_text: event.target.value }))}
              rows={3}
              placeholder="يمكنك إضافة سطر افتتاحي بسيط بدل ترك المستند فارغًا."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </div>
        ) : null}
      </form>
    </WorkModalShell>
  );
};

export default WorkDocModal;
