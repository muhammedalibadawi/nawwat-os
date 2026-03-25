import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { WorkInboxData, WorkNotification } from '@/types/workos';
import { loadInbox, markNotificationRead } from '@/services/workosService';
import { normalizeWorkOsError } from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import WorkInboxPanel from '@/components/workos/WorkInboxPanel';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import { StatusBanner } from '@/components/ui/StatusBanner';

const WorkInboxScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const [data, setData] = useState<WorkInboxData | null>(null);

  const reload = async (tenantId: string, authUserId: string) => {
    setLoading(true);
    setError('');
    try {
      const nextData = await loadInbox(tenantId, authUserId);
      setData(nextData);
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل البريد الداخلي.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id || !user.id) return;
    void reload(user.tenant_id, user.id);
  }, [user?.id, user?.tenant_id]);

  const unreadNotifications = useMemo(
    () => (data?.notifications ?? []).filter((notification) => !notification.read_at),
    [data?.notifications]
  );
  const readNotifications = useMemo(
    () => (data?.notifications ?? []).filter((notification) => Boolean(notification.read_at)),
    [data?.notifications]
  );

  const handleMarkRead = async (notification: WorkNotification) => {
    if (!data) return;
    setBusyId(notification.id);
    setError('');
    try {
      await markNotificationRead(notification.id);
      const readAt = new Date().toISOString();
      setData({
        unread_count: Math.max(0, data.unread_count - (notification.read_at ? 0 : 1)),
        notifications: data.notifications.map((entry) =>
          entry.id === notification.id
            ? {
                ...entry,
                read_at: entry.read_at ?? readAt,
                updated_at: readAt,
              }
            : entry
        ),
      });
    } catch (markError) {
      setError(normalizeWorkOsError(markError, 'تعذر تحديث حالة التنبيه.'));
    } finally {
      setBusyId('');
    }
  };

  const handleMarkAllVisibleRead = async () => {
    if (!data) return;
    if (!unreadNotifications.length) return;

    setMarkAllBusy(true);
    setError('');
    try {
      for (const notification of unreadNotifications) {
        // Sequential: keeps demo/smoke traffic small and predictable.
        await markNotificationRead(notification.id);
      }

      const readAt = new Date().toISOString();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unread_count: 0,
          notifications: prev.notifications.map((entry) =>
            entry.read_at
              ? entry
              : {
                  ...entry,
                  read_at: readAt,
                  updated_at: readAt,
                }
          ),
        };
      });
    } catch (markAllError) {
      setError(normalizeWorkOsError(markAllError, 'تعذر تعليم التنبيهات كمقروءة.'));
    } finally {
      setMarkAllBusy(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="البريد الداخلي والتنبيهات"
        subtitle="قائمة التنبيهات الحالية في WorkOS مع إمكانية تعليمها كمقروءة مباشرة من الواجهة."
      />

      {error ? (
        <div className="mt-4">
          <StatusBanner variant="error" className="rounded-2xl">
            {error}
          </StatusBanner>
        </div>
      ) : null}

      {!loading && data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">غير المقروءة</div>
            <div className="mt-2 text-2xl font-black text-[#071C3B]">{data.unread_count}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">الإجمالي</div>
            <div className="mt-2 text-2xl font-black text-[#071C3B]">{data.notifications.length}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">المقروءة</div>
            <div className="mt-2 text-2xl font-black text-[#071C3B]">{readNotifications.length}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
          ))}
        </div>
      ) : data && data.notifications.length ? (
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#071C3B]">غير المقروءة</h2>
                <p className="text-sm text-slate-500">العناصر التي تحتاج متابعة الآن.</p>
              </div>

              {unreadNotifications.length ? (
                <button
                  type="button"
                  onClick={() => void handleMarkAllVisibleRead()}
                  disabled={markAllBusy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-black text-[#071C3B] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCheck size={16} />
                  {markAllBusy ? 'جارٍ التعليم...' : 'تعليم الكل كمقروء'}
                </button>
              ) : null}
            </div>
            <WorkInboxPanel notifications={unreadNotifications} busyId={busyId} onMarkRead={handleMarkRead} />
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#071C3B]">مقروءة مؤخرًا</h2>
              <p className="text-sm text-slate-500">أحدث التنبيهات التي جرى الاطلاع عليها.</p>
            </div>
            {readNotifications.length ? (
              <WorkInboxPanel notifications={readNotifications} busyId={busyId} onMarkRead={handleMarkRead} />
            ) : (
              <WorkEmptyState title="لا توجد تنبيهات مقروءة بعد" description="بعد قراءة بعض التنبيهات ستنتقل تلقائيًا إلى هذا القسم." />
            )}
          </section>
        </div>
      ) : (
        <WorkEmptyState title="البريد الداخلي فارغ" description="لم يتم تسجيل أي إشعارات داخلية حتى الآن في مساحة العمل الحالية." />
      )}
    </div>
  );
};

export default WorkInboxScreen;
