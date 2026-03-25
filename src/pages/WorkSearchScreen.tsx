import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { WorkSearchData, WorkSearchResult } from '@/types/workos';
import { lightweightSearch } from '@/services/workosService';
import {
  formatRelativeTime,
  getDocStatusLabel,
  getObjectLabel,
  getProjectStatusLabel,
  getTaskStatusLabel,
  normalizeWorkOsError,
  WORK_CHANNEL_TYPE_OPTIONS,
} from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import WorkStatusBadge from '@/components/workos/WorkStatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';

const WorkSearchScreen: React.FC = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<WorkSearchData>({ query: '', results: [] });

  useEffect(() => {
    if (!user?.tenant_id) return;

    if (query.trim().length < 2) {
      setData({ query, results: [] });
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const nextData = await lightweightSearch(user.tenant_id, query);
        setData(nextData);
      } catch (searchError) {
        setError(normalizeWorkOsError(searchError, 'تعذر تنفيذ البحث داخل WorkOS.'));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, user?.tenant_id]);

  const kindLabelMap: Record<WorkSearchResult['kind'], string> = {
    project: 'مشروع',
    doc: 'مستند',
    task: 'مهمة',
    channel: 'قناة',
  };

  const kindToneMap: Record<WorkSearchResult['kind'], string> = {
    project: 'sky',
    doc: 'cyan',
    task: 'amber',
    channel: 'emerald',
  };

  const grouped = useMemo(() => {
    const buckets: Record<WorkSearchResult['kind'], WorkSearchResult[]> = {
      project: [],
      doc: [],
      task: [],
      channel: [],
    };

    for (const result of data.results) {
      buckets[result.kind].push(result);
    }

    return buckets;
  }, [data.results]);

  const kindOrder: Array<WorkSearchResult['kind']> = ['project', 'doc', 'task', 'channel'];

  function getStatusBadge(result: WorkSearchResult) {
    if (!result.status) return null;

    if (result.kind === 'project') {
      return <WorkStatusBadge label={getProjectStatusLabel(result.status as never)} tone={result.status} />;
    }
    if (result.kind === 'doc') {
      return <WorkStatusBadge label={getDocStatusLabel(result.status as never)} tone={result.status} />;
    }
    if (result.kind === 'task') {
      return <WorkStatusBadge label={getTaskStatusLabel(result.status as never)} tone={result.status} />;
    }

    if (result.kind === 'channel') {
      const match = WORK_CHANNEL_TYPE_OPTIONS.find((opt) => opt.value === result.status);
      const label = match?.label ?? result.status;
      return <WorkStatusBadge label={label} tone="slate" />;
    }

    return null;
  }

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="البحث"
        subtitle="بحث خفيف ومباشر في المشاريع والمستندات والمهام والقنوات، تمهيدًا لطبقة بحث أعمق في مرحلة لاحقة."
      />

      {error ? (
        <div className="mt-4">
          <StatusBanner variant="error" className="rounded-2xl">
            {error}
          </StatusBanner>
        </div>
      ) : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 right-4 my-auto text-slate-400" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث بالمسمى أو العنوان داخل WorkOS"
            className="w-full rounded-2xl border border-slate-200 py-3 pr-11 pl-4"
          />
        </div>
        <p className="mt-3 text-sm text-slate-500">اكتب حرفين على الأقل لبدء البحث داخل WorkOS (بدون full-text الآن).</p>
      </section>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[24px] bg-slate-100" />
          ))}
        </div>
      ) : query.trim().length < 2 ? (
        <WorkEmptyState
          title="ابدأ بكتابة كلمة بحث"
          description="السبب: لا يمكن بدء البحث بعد لأن شرط البحث الحالي قصير (أقل من حرفين). ابدأ بكتابة حرفين على الأقل، وسنعرض النتائج حسب النوع: مشروع/مستند/مهمة/قناة."
        />
      ) : data.results.length ? (
        <div className="space-y-6">
          {kindOrder.map((kind) => {
            const items = grouped[kind];
            if (!items.length) return null;

            return (
              <section key={kind} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#071C3B]">النتائج: {kindLabelMap[kind]}</h3>
                  <WorkStatusBadge label={`${items.length}`} tone={kindToneMap[kind]} />
                </div>

                <div className="space-y-3">
                  {items.map((result) => (
                    <Link
                      key={`${result.kind}-${result.id}`}
                      to={result.href}
                      className="block rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/30"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-[#071C3B]">{result.title}</h4>
                          <WorkStatusBadge label={kindLabelMap[result.kind]} tone={kindToneMap[result.kind]} />
                          {getStatusBadge(result)}
                        </div>

                        <p className="text-sm text-slate-500 truncate">{result.subtitle || getObjectLabel(result.kind)}</p>
                        <div className="text-xs font-bold text-slate-500">آخر تحديث {formatRelativeTime(result.updated_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <WorkEmptyState
          title="لا توجد نتائج مطابقة"
          description="السبب: لا توجد نتائج مطابقة لشرط البحث الحالي داخل المشاريع/المستندات/المهام/القنوات. جرّب تغيير الكلمة أو استخدام جزء أقرب."
        />
      )}
    </div>
  );
};

export default WorkSearchScreen;
