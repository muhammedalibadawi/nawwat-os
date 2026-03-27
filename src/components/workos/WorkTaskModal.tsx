import React, { useEffect, useState } from 'react';
import type { WorkTaskFormInput, WorkUserOption } from '@/types/workos';
import { WORK_PRIORITY_OPTIONS, WORK_TASK_STATUS_OPTIONS, WORK_TASK_TYPE_OPTIONS } from '@/utils/workos';
import WorkModalShell from './WorkModalShell';

interface WorkTaskModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue: WorkTaskFormInput;
  users: WorkUserOption[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: WorkTaskFormInput) => Promise<void> | void;
}

const WorkTaskModal: React.FC<WorkTaskModalProps> = ({
  open,
  mode,
  initialValue,
  users,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<WorkTaskFormInput>(initialValue);

  useEffect(() => {
    if (!open) return;
    setForm(initialValue);
  }, [initialValue, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      title: form.title.trim(),
    });
  };

  return (
    <WorkModalShell
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'مهمة جديدة' : 'تعديل المهمة'}
      subtitle="أضف مهمة تنفيذية بسيطة ضمن المشروع الحالي أو عدّل حالتها وأولويتها."
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
            form="work-task-form"
            disabled={submitting || !form.title.trim()}
            className="rounded-2xl bg-[#071C3B] px-5 py-2.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'جارٍ الحفظ...' : mode === 'create' ? 'إنشاء المهمة' : 'حفظ التغييرات'}
          </button>
        </div>
      }
      maxWidthClassName="max-w-2xl"
    >
      <form id="work-task-form" onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">عنوان المهمة</label>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="مثال: مراجعة المستند النهائي"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الوصف</label>
          <textarea
            value={form.description ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            placeholder="أضف تفاصيل سريعة تساعد الفريق على التنفيذ."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">نوع المهمة</label>
          <select
            value={form.task_type}
            onChange={(event) => setForm((current) => ({ ...current, task_type: event.target.value as WorkTaskFormInput['task_type'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_TASK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">الحالة</label>
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as WorkTaskFormInput['status'] }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            {WORK_TASK_STATUS_OPTIONS.map((option) => (
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
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as WorkTaskFormInput['priority'] }))}
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
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">المكلّف</label>
          <select
            value={form.assignee_user_id ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, assignee_user_id: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="">بدون تكليف</option>
            {users.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">موعد الاستحقاق</label>
          <input
            type="datetime-local"
            value={form.due_at ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          />
        </div>
      </form>
    </WorkModalShell>
  );
};

export default WorkTaskModal;
