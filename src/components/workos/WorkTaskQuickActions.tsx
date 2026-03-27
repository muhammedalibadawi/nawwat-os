import React from 'react';
import type { WorkProjectPriority, WorkTask, WorkTaskStatus } from '@/types/workos';
import { WORK_PRIORITY_OPTIONS, WORK_TASK_STATUS_OPTIONS } from '@/utils/workos';

interface WorkTaskQuickActionsProps {
  task: WorkTask;
  busy?: boolean;
  disabled?: boolean;
  onStatusChange?: (task: WorkTask, status: WorkTaskStatus) => void;
  onPriorityChange?: (task: WorkTask, priority: WorkProjectPriority) => void;
  onArchive?: (task: WorkTask) => void;
}

const WorkTaskQuickActions: React.FC<WorkTaskQuickActionsProps> = ({
  task,
  busy = false,
  disabled = false,
  onStatusChange,
  onPriorityChange,
  onArchive,
}) => {
  if (!onStatusChange && !onPriorityChange && !onArchive) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onStatusChange ? (
        <select
          value={task.status}
          disabled={disabled || busy}
          onChange={(event) => onStatusChange(task, event.target.value as WorkTaskStatus)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
        >
          {WORK_TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {onPriorityChange ? (
        <select
          value={task.priority}
          disabled={disabled || busy}
          onChange={(event) => onPriorityChange(task, event.target.value as WorkProjectPriority)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
        >
          {WORK_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {onArchive ? (
        <button
          type="button"
          onClick={() => onArchive(task)}
          disabled={disabled || busy}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'جارٍ...' : 'أرشفة'}
        </button>
      ) : null}
    </div>
  );
};

export default WorkTaskQuickActions;
