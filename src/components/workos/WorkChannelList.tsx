import React from 'react';
import { Hash, Layers3, MessageCircle, Pencil } from 'lucide-react';
import type { WorkChannel } from '@/types/workos';
import { formatRelativeTime } from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import WorkStatusBadge from './WorkStatusBadge';

interface WorkChannelListProps {
  channels: WorkChannel[];
  emptyTitle?: string;
  emptyDescription?: string;
  canManage?: boolean;
  busyId?: string;
  onOpen?: (channel: WorkChannel) => void;
  onEdit?: (channel: WorkChannel) => void;
  onArchive?: (channel: WorkChannel) => void;
}

const WorkChannelList: React.FC<WorkChannelListProps> = ({
  channels,
  emptyTitle = 'لا توجد قنوات في هذا العرض',
  emptyDescription = 'ستظهر هنا القنوات المرتبطة بمساحة العمل أو المشروع عند توفرها.',
  canManage = false,
  busyId,
  onOpen,
  onEdit,
  onArchive,
}) => {
  if (!channels.length) {
    return <WorkEmptyState title={emptyTitle} description={emptyDescription} icon={<Hash size={24} />} />;
  }

  return (
    <div className="space-y-3">
      {channels.map((channel) => (
        <article key={channel.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-black text-[#071C3B]">#{channel.name}</h4>
                <WorkStatusBadge label={channel.channel_type} tone={channel.channel_type === 'announcement' ? 'amber' : 'cyan'} />
                <WorkStatusBadge label={channel.visibility === 'private' ? 'خاصة' : 'داخلية'} tone={channel.visibility === 'private' ? 'slate' : 'sky'} />
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                {channel.description || 'قناة مخصصة لتنسيق العمل ومتابعة النقاشات الداخلية.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(channel)}
                  className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100"
                >
                  فتح
                </button>
              ) : null}
              {canManage && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(channel)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={14} />
                  تعديل
                </button>
              ) : null}
              {canManage && onArchive ? (
                <button
                  type="button"
                  onClick={() => onArchive(channel)}
                  disabled={busyId === channel.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === channel.id ? 'جارٍ...' : 'أرشفة'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Layers3 size={14} />
              {channel.project_name || channel.team_space_name || 'بدون سياق محدد'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle size={14} />
              {channel.thread_count ?? 0} نقاشات
            </span>
            <span>آخر رسالة {formatRelativeTime(channel.last_message_at || channel.updated_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
};

export default WorkChannelList;
