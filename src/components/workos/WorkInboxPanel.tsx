import React, { useMemo } from 'react';
import { BellRing, CheckCheck } from 'lucide-react';
import type { WorkNotification } from '@/types/workos';
import { formatRelativeTime, getObjectLabel } from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import { Link } from 'react-router-dom';

interface WorkInboxPanelProps {
  notifications: WorkNotification[];
  busyId?: string;
  onMarkRead: (notification: WorkNotification) => void;
}

const WorkInboxPanel: React.FC<WorkInboxPanelProps> = ({ notifications, busyId, onMarkRead }) => {
  if (!notifications.length) {
    return (
      <WorkEmptyState
        title="لا توجد تنبيهات هنا"
        description="السبب: لا توجد تنبيهات مرتبطة بمساحة العمل الحالية حتى الآن. عند وصول نشاط جديد متعلق بالمشاريع/المستندات/القنوات سيظهر هنا."
        icon={<BellRing size={24} />}
      />
    );
  }

  function getNotificationHref(notification: WorkNotification): string | null {
    const objectId = notification.object_id;
    switch (notification.object_type) {
      case 'project':
        return objectId ? `/work/projects/${objectId}` : null;
      case 'doc':
        return objectId ? `/work/docs?doc=${objectId}` : null;
      case 'task':
        return objectId ? `/work/projects?task=${objectId}` : null;
      case 'channel':
        return objectId ? `/work/channels?channel=${objectId}` : null;
      case 'team_space':
        return '/work/team-spaces';
      default:
        return null;
    }
  }

  const grouped = useMemo(() => {
    const groupKey = (n: WorkNotification) => `${n.notification_type ?? 'notice'}::${n.object_type ?? 'unknown'}`;

    const map = new Map<
      string,
      {
        key: string;
        notification_type: string;
        object_type: WorkNotification['object_type'];
        items: WorkNotification[];
      }
    >();

    for (const n of notifications) {
      const key = groupKey(n);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(n);
        continue;
      }

      map.set(key, {
        key,
        notification_type: n.notification_type || 'إشعار',
        object_type: n.object_type,
        items: [n],
      });
    }

    return Array.from(map.values());
  }, [notifications]);

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 border border-slate-200">{group.notification_type}</span>
                <span className="text-xs font-bold text-slate-500">{getObjectLabel(group.object_type)}</span>
              </div>
              <span className="text-xs font-black text-slate-500">{group.items.length} عنصر</span>
            </div>
          </div>

          <div className="space-y-3">
            {group.items.map((notification) => {
              const isRead = Boolean(notification.read_at);
              const href = getNotificationHref(notification);

              return (
                <article
                  key={notification.id}
                  className={`rounded-[22px] border p-4 shadow-sm transition ${
                    isRead ? 'border-slate-200 bg-white' : 'border-cyan-200 bg-cyan-50/60'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-black text-[#071C3B]">{notification.title}</h4>
                        {!isRead ? <span className="rounded-full bg-[#00CFFF] px-2.5 py-1 text-xs font-black text-[#071C3B]">جديد</span> : null}
                      </div>

                      <p className="mt-2 text-sm leading-7 text-slate-600 max-h-16 overflow-hidden">
                        {notification.body || 'إشعار داخلي متعلق بعنصر من عناصر WorkOS.'}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                        <span>{getObjectLabel(notification.object_type)}</span>
                        <span>{formatRelativeTime(notification.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {href ? (
                        <Link
                          to={href}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#071C3B] transition hover:bg-slate-50"
                        >
                          فتح
                        </Link>
                      ) : null}

                      {!isRead ? (
                        <button
                          type="button"
                          onClick={() => onMarkRead(notification)}
                          disabled={busyId === notification.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-[#071C3B] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCheck size={16} />
                          {busyId === notification.id ? 'جارٍ...' : 'تعليم كمقروء'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default WorkInboxPanel;
