import React from 'react';
import type { WorkThread } from '@/types/workos';
import { formatRelativeTime, getStatusTone, getThreadTypeLabel } from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import WorkStatusBadge from './WorkStatusBadge';

interface WorkThreadListProps {
  threads: WorkThread[];
  selectedThreadId?: string;
  onSelect?: (thread: WorkThread) => void;
}

const WorkThreadList: React.FC<WorkThreadListProps> = ({ threads, selectedThreadId, onSelect }) => {
  if (!threads.length) {
    return <WorkEmptyState title="لا توجد نقاشات بعد" description="عند إنشاء thread جديد أو وجود نقاشات مرتبطة بالقناة ستظهر هنا." />;
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => {
        const isSelected = selectedThreadId === thread.id;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect?.(thread)}
            className={`block w-full rounded-[22px] border p-4 text-right shadow-sm transition ${
              isSelected ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <WorkStatusBadge label={getThreadTypeLabel(thread.thread_type)} tone="sky" />
              <WorkStatusBadge label={thread.status === 'resolved' ? 'محلول' : thread.status === 'archived' ? 'مؤرشف' : 'مفتوح'} tone={getStatusTone(thread.status)} />
            </div>

            <div className="mt-2 text-sm font-black text-[#071C3B]">
              {thread.title || 'نقاش بدون عنوان'}
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {thread.message_count ?? 0} رسائل • آخر نشاط {formatRelativeTime(thread.last_message_at || thread.updated_at)}
            </div>

            {thread.latest_message_preview ? (
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{thread.latest_message_preview}</p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default WorkThreadList;
