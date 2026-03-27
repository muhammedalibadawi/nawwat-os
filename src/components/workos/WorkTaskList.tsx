import React from 'react';
import { Clock3, FolderKanban, Pencil, User } from 'lucide-react';
import type { WorkProjectPriority, WorkTask, WorkTaskStatus } from '@/types/workos';
import { formatWorkDate, getPriorityLabel, getPriorityTone, getTaskStatusLabel } from '@/utils/workos';
import WorkStatusBadge from './WorkStatusBadge';
import WorkEmptyState from './WorkEmptyState';
import WorkTaskQuickActions from './WorkTaskQuickActions';

interface WorkTaskListProps {
  tasks: WorkTask[];
  emptyTitle?: string;
  emptyDescription?: string;
  canManage?: boolean;
  busyId?: string;
  quickActionBusyId?: string;
  onOpen?: (task: WorkTask) => void;
  onEdit?: (task: WorkTask) => void;
  onArchive?: (task: WorkTask) => void;
  onStatusChange?: (task: WorkTask, status: WorkTaskStatus) => void;
  onPriorityChange?: (task: WorkTask, priority: WorkProjectPriority) => void;
}

const WorkTaskList: React.FC<WorkTaskListProps> = ({
  tasks,
  emptyTitle = 'لا توجد مهام في هذا العرض',
  emptyDescription = 'عند توفر مهام مرتبطة بمساحة العمل أو المشروع ستظهر هنا مع الحالة والأولوية.',
  canManage = false,
  busyId,
  quickActionBusyId,
  onOpen,
  onEdit,
  onArchive,
  onStatusChange,
  onPriorityChange,
}) => {
  if (!tasks.length) {
    return <WorkEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article key={task.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-black text-[#071C3B]">{task.title}</h4>
                <WorkStatusBadge label={getTaskStatusLabel(task.status)} tone={task.status} />
                <WorkStatusBadge label={getPriorityLabel(task.priority)} tone={getPriorityTone(task.priority)} />
                {task.is_overdue ? <WorkStatusBadge label="متأخرة" tone="rose" /> : null}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                {task.description || 'لا يوجد وصف إضافي لهذه المهمة حتى الآن.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{task.task_type}</div>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100"
                >
                  فتح
                </button>
              ) : null}
              {canManage && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={14} />
                  تعديل
                </button>
              ) : null}
            </div>
          </div>

          {canManage && (onStatusChange || onPriorityChange || onArchive) ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <WorkTaskQuickActions
                task={task}
                busy={busyId === task.id || quickActionBusyId === task.id}
                onStatusChange={onStatusChange}
                onPriorityChange={onPriorityChange}
                onArchive={onArchive}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <FolderKanban size={14} />
              {task.project_name || task.team_space_name || 'بدون سياق مشروع'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User size={14} />
              {task.assignee_name || 'غير مسندة'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} />
              الاستحقاق {formatWorkDate(task.due_at, true)}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
};

export default WorkTaskList;
