import React, { useState } from 'react';
import type { WorkDoc, WorkDocBlock } from '@/types/workos';
import { formatRelativeTime, getDocBlockLabel, getDocBlockText } from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import WorkStatusBadge from './WorkStatusBadge';

interface WorkDocBlockViewerProps {
  doc: WorkDoc | null;
  blocks: WorkDocBlock[];
  loading?: boolean;
  canAddBlock?: boolean;
  submitting?: boolean;
  onAddBlock?: (text: string) => Promise<void> | void;
}

const WorkDocBlockViewer: React.FC<WorkDocBlockViewerProps> = ({
  doc,
  blocks,
  loading = false,
  canAddBlock = false,
  submitting = false,
  onAddBlock,
}) => {
  const [draft, setDraft] = useState('');

  if (!doc) {
    return <WorkEmptyState title="اختر مستندًا" description="اختر مستندًا من القائمة لعرض كتل المحتوى الخاصة به." />;
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#071C3B]">{doc.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {doc.summary || 'عرض مبسط لكتل المستند الحالية بدون محرر غني في هذه المرحلة.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkStatusBadge label={doc.doc_type} tone="sky" />
          <WorkStatusBadge label={`${blocks.length} كتلة`} tone="slate" />
        </div>
      </div>

      {canAddBlock && onAddBlock ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">إضافة كتلة بسيطة</label>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="أدخل فقرة أو ملاحظة قصيرة لإضافتها إلى المستند."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={submitting || !draft.trim()}
              onClick={async () => {
                const text = draft.trim();
                if (!text) return;
                await onAddBlock(text);
                setDraft('');
              }}
              className="rounded-2xl bg-[#071C3B] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0b2b59] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'جارٍ الحفظ...' : 'إضافة الكتلة'}
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
      ) : blocks.length ? (
        <div className="mt-4 space-y-3">
          {blocks.map((block) => (
            <article key={block.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <WorkStatusBadge label={getDocBlockLabel(block)} tone={block.block_type === 'heading' ? 'sky' : block.block_type === 'todo' ? 'amber' : 'slate'} />
                <span className="text-xs font-bold text-slate-500">آخر تحديث {formatRelativeTime(block.updated_at)}</span>
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">{getDocBlockText(block)}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <WorkEmptyState title="المستند بلا كتل" description="يمكنك البدء بإضافة فقرة أولى أو استخدام هذا المستند كحاوية تنظيمية فقط." />
        </div>
      )}
    </section>
  );
};

export default WorkDocBlockViewer;
