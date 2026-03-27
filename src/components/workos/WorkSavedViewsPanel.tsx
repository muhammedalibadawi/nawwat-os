import React, { useState } from 'react';
import type { WorkSavedView } from '@/types/workos';
import { formatRelativeTime, getSavedViewScopeLabel } from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import WorkStatusBadge from './WorkStatusBadge';

interface WorkSavedViewsPanelProps {
  title?: string;
  views: WorkSavedView[];
  loading?: boolean;
  saving?: boolean;
  archivingId?: string;
  onSave?: (name: string) => Promise<void> | void;
  onApply?: (view: WorkSavedView) => void;
  onArchive?: (view: WorkSavedView) => void;
}

const WorkSavedViewsPanel: React.FC<WorkSavedViewsPanelProps> = ({
  title = 'العروض المحفوظة',
  views,
  loading = false,
  saving = false,
  archivingId = '',
  onSave,
  onApply,
  onArchive,
}) => {
  const [name, setName] = useState('');

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#071C3B]">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">احفظ الفلاتر الحالية كعرض خفيف يمكن الرجوع إليه بسرعة.</p>
        </div>
      </div>

      {onSave ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-bold text-[#071C3B]">اسم العرض</label>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: مستندات مشروع الافتتاح"
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={async () => {
                const value = name.trim();
                if (!value) return;
                await onSave(value);
                setName('');
              }}
              className="rounded-2xl bg-[#071C3B] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0b2b59] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ العرض'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : views.length ? (
        <div className="mt-4 space-y-3">
          {views.map((view) => (
            <article key={view.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-black text-[#071C3B]">{view.name}</div>
                    <WorkStatusBadge label={getSavedViewScopeLabel(view.scope_type)} tone="slate" />
                    {view.is_shared ? <WorkStatusBadge label="مشترك" tone="sky" /> : null}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">آخر تحديث {formatRelativeTime(view.updated_at)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onApply ? (
                    <button
                      type="button"
                      onClick={() => onApply(view)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      فتح
                    </button>
                  ) : null}
                  {onArchive ? (
                    <button
                      type="button"
                      disabled={archivingId === view.id}
                      onClick={() => onArchive(view)}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {archivingId === view.id ? 'جارٍ...' : 'أرشفة'}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <WorkEmptyState title="لا توجد عروض محفوظة بعد" description="بعد حفظ أول فلتر أو بحث سيظهر هنا ليسهّل الرجوع إلى نفس السياق لاحقًا." />
        </div>
      )}
    </section>
  );
};

export default WorkSavedViewsPanel;
