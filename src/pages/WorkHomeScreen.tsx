import React, { useEffect, useState } from 'react';
import { Activity, BellRing, FolderKanban, Layers3, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { WorkHomeData } from '@/types/workos';
import { loadWorkHome } from '@/services/workosService';
import { formatRelativeTime, formatWorkDate, getObjectLabel, normalizeWorkOsError } from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import WorkTaskList from '@/components/workos/WorkTaskList';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import { StatusBanner } from '@/components/ui/StatusBanner';

const WorkHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<WorkHomeData | null>(null);

  useEffect(() => {
    if (!user?.tenant_id || !user.id) return;

    void (async () => {
      setLoading(true);
      setError('');
      try {
        const nextData = await loadWorkHome(user.tenant_id, user.id);
        setData(nextData);
      } catch (loadError) {
        setError(normalizeWorkOsError(loadError, 'تعذر تحميل الصفحة الرئيسية لقطاع WorkOS.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, user?.tenant_id]);

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="Work OS"
        subtitle="طبقة العمل المشتركة فوق NawwatOS لعرض مهامك الحالية، النشاط الأحدث، وروابط الانطلاق السريعة بدون تعقيد إضافي."
      />

      {error ? (
        <div className="mt-4">
          <StatusBanner variant="error" className="rounded-2xl">
            {error}
          </StatusBanner>
        </div>
      ) : null}
      {!loading && data && data.summary.team_space_count === 0 && data.summary.project_count === 0 ? (
        <StatusBanner variant="warning" className="rounded-2xl">
          بيئة WorkOS الحالية لا تحتوي بيانات بعد (مساحات/مشاريع). هذا ليس عطلًا Runtime؛ ابدأ ببيانات تجريبية بسيطة لتمرير smoke test يدوي.
        </StatusBanner>
      ) : null}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[24px] bg-slate-100" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <Layers3 size={20} />
              </div>
              <div className="mt-3 text-2xl font-black text-[#071C3B]">{data.summary.team_space_count}</div>
              <div className="mt-1 text-sm text-slate-500">مساحات الفرق</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <FolderKanban size={20} />
              </div>
              <div className="mt-3 text-2xl font-black text-[#071C3B]">{data.summary.project_count}</div>
              <div className="mt-1 text-sm text-slate-500">مشاريع جارية</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <Activity size={20} />
              </div>
              <div className="mt-3 text-2xl font-black text-[#071C3B]">{data.summary.open_task_count}</div>
              <div className="mt-1 text-sm text-slate-500">مهام مفتوحة</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <ScrollText size={20} />
              </div>
              <div className="mt-3 text-2xl font-black text-[#071C3B]">{data.summary.doc_count}</div>
              <div className="mt-1 text-sm text-slate-500">مستندات</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <BellRing size={20} />
              </div>
              <div className="mt-3 text-2xl font-black text-[#071C3B]">{data.summary.unread_notification_count}</div>
              <div className="mt-1 text-sm text-slate-500">تنبيهات غير مقروءة</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00CFFF]/15 text-[#071C3B]">
                <Activity size={20} />
              </div>
              <div className="mt-3 text-2xl font-black text-[#071C3B]">{data.summary.channel_count}</div>
              <div className="mt-1 text-sm text-slate-500">قنوات عمل</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#071C3B]">My Work</h2>
                  <p className="text-sm text-slate-500">المهام المرتبطة بك مباشرة عبر المشاريع ومساحات الفرق.</p>
                </div>
                <Link to="/work/projects" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  كل المشاريع
                </Link>
              </div>
              <WorkTaskList
                tasks={data.my_work}
                emptyTitle="لا توجد مهام مرتبطة بك حاليًا"
                emptyDescription="عند إسناد مهام لك أو تسجيلك كمبلّغ في أي مشروع ستظهر هنا مباشرة."
              />
            </section>

            <div className="space-y-6">
              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-[#071C3B]">روابط سريعة</h2>
                <div className="mt-4 grid gap-3">
                  {data.quick_links.map((link) => (
                    <Link key={link.href} to={link.href} className="rounded-2xl border border-slate-200 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/40">
                      <div className="text-sm font-black text-[#071C3B]">{link.label}</div>
                      <div className="mt-1 text-sm text-slate-500">{link.description}</div>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-[#071C3B]">النشاط الأخير</h2>
                    <p className="text-sm text-slate-500">آخر الأحداث المسجلة في مساحة العمل الحالية.</p>
                  </div>
                  <Link to="/work/inbox" className="text-sm font-bold text-cyan-900">
                    فتح البريد
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {data.recent_activity.length ? (
                    data.recent_activity.map((activityItem) => (
                      <article key={activityItem.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-[#071C3B]">{activityItem.summary || activityItem.activity_type}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                            {getObjectLabel(activityItem.object_type)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-bold text-slate-500">
                          {activityItem.actor_name || 'عضو فريق'} • {formatRelativeTime(activityItem.created_at)} • {formatWorkDate(activityItem.created_at, true)}
                        </div>
                      </article>
                    ))
                  ) : (
                    <WorkEmptyState
                      title="لا يوجد نشاط حديث"
                      description="عند إنشاء مشاريع أو ربط عناصر أو تسجيل أنشطة في WorkOS ستبدأ هذه القائمة بالظهور."
                    />
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : (
        <WorkEmptyState
          title="لم يتم تحميل بيانات WorkOS بعد"
          description="إذا كانت مساحة العمل فارغة تمامًا فسيظهر هذا العرض حتى تبدأ بإضافة مشاريع أو قنوات أو مستندات."
        />
      )}
    </div>
  );
};

export default WorkHomeScreen;
