import React from 'react';
import { FileText, Layers3, Pencil, Shapes } from 'lucide-react';
import type { WorkDoc } from '@/types/workos';
import { formatRelativeTime, getDocStatusLabel } from '@/utils/workos';
import WorkStatusBadge from './WorkStatusBadge';
import WorkEmptyState from './WorkEmptyState';

interface WorkDocListProps {
  docs: WorkDoc[];
  emptyTitle?: string;
  emptyDescription?: string;
  canManage?: boolean;
  busyId?: string;
  onOpen?: (doc: WorkDoc) => void;
  onEdit?: (doc: WorkDoc) => void;
  onArchive?: (doc: WorkDoc) => void;
}

const WorkDocList: React.FC<WorkDocListProps> = ({
  docs,
  emptyTitle = 'لا توجد مستندات حالية',
  emptyDescription = 'عند إضافة صفحات أو ملاحظات أو قرارات داخل WorkOS ستظهر هنا.',
  canManage = false,
  busyId,
  onOpen,
  onEdit,
  onArchive,
}) => {
  if (!docs.length) {
    return <WorkEmptyState title={emptyTitle} description={emptyDescription} icon={<FileText size={24} />} />;
  }

  return (
    <div className="space-y-3">
      {docs.map((doc) => (
        <article key={doc.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-black text-[#071C3B]">{doc.title}</h4>
                <WorkStatusBadge label={getDocStatusLabel(doc.status)} tone={doc.status} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{doc.doc_type}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                {doc.summary || 'هذا المستند لا يحتوي ملخصًا بعد. سيظهر هنا وصف مختصر عند توفره في البيانات الأساسية.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(doc)}
                  className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100"
                >
                  فتح
                </button>
              ) : null}
              {canManage && onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(doc)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={14} />
                  تعديل
                </button>
              ) : null}
              {canManage && onArchive ? (
                <button
                  type="button"
                  onClick={() => onArchive(doc)}
                  disabled={busyId === doc.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === doc.id ? 'جارٍ...' : 'أرشفة'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Layers3 size={14} />
              {doc.project_name || doc.team_space_name || 'بدون سياق محدد'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shapes size={14} />
              {doc.block_count ?? 0} كتلة
            </span>
            <span>آخر تحديث {formatRelativeTime(doc.updated_at)}</span>
          </div>
        </article>
      ))}
    </div>
  );
};

export default WorkDocList;
