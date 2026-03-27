import React, { useState } from 'react';
import type { WorkMessage, WorkThread } from '@/types/workos';
import { formatRelativeTime, formatWorkDate, getThreadTypeLabel } from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import WorkStatusBadge from './WorkStatusBadge';

interface WorkThreadPanelProps {
  thread: WorkThread | null;
  messages: WorkMessage[];
  loading?: boolean;
  canCreate?: boolean;
  submitting?: boolean;
  onCreateMessage?: (body: string) => Promise<void> | void;
}

const WorkThreadPanel: React.FC<WorkThreadPanelProps> = ({
  thread,
  messages,
  loading = false,
  canCreate = false,
  submitting = false,
  onCreateMessage,
}) => {
  const [draft, setDraft] = useState('');

  if (!thread) {
    return <WorkEmptyState title="اختر نقاشًا" description="اختر thread من القائمة لعرض الرسائل وآخر النشاط." />;
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#071C3B]">{thread.title || 'نقاش بدون عنوان'}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {thread.created_by_name || 'عضو فريق'} • بدأ في {formatWorkDate(thread.created_at, true)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkStatusBadge label={getThreadTypeLabel(thread.thread_type)} tone="sky" />
          <WorkStatusBadge label={thread.status === 'resolved' ? 'محلول' : thread.status === 'archived' ? 'مؤرشف' : 'مفتوح'} tone={thread.status === 'resolved' ? 'emerald' : thread.status === 'archived' ? 'slate' : 'cyan'} />
        </div>
      </div>

      {canCreate && onCreateMessage ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">إضافة رسالة بسيطة</label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="أضف متابعة قصيرة أو قرارًا أو ملاحظة للفريق."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={submitting || !draft.trim()}
              onClick={async () => {
                const body = draft.trim();
                if (!body) return;
                await onCreateMessage(body);
                setDraft('');
              }}
              className="rounded-2xl bg-[#071C3B] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0b2b59] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'جارٍ الإرسال...' : 'إرسال الرسالة'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : messages.length ? (
        <div className="mt-4 space-y-3">
          {messages.map((message) => (
            <article key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-black text-[#071C3B]">{message.author_name || 'عضو فريق'}</span>
                <span>•</span>
                <span>{formatRelativeTime(message.created_at)}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-700">{message.body || 'رسالة بدون نص قابل للعرض.'}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <WorkEmptyState title="لا توجد رسائل بعد" description="يمكن استخدام هذا النقاش كغلاف تنظيمي الآن، أو بدء أول رسالة مختصرة من نفس اللوحة." />
        </div>
      )}
    </section>
  );
};

export default WorkThreadPanel;
