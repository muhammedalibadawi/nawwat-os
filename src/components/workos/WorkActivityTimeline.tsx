import React from 'react';
import type { WorkActivity } from '@/types/workos';
import {
  formatRelativeTime,
  formatWorkDate,
  getActivityTypeLabel,
  getObjectLabel,
  getStatusTone,
  groupActivitiesByDay,
} from '@/utils/workos';
import WorkEmptyState from './WorkEmptyState';
import WorkStatusBadge from './WorkStatusBadge';

interface WorkActivityTimelineProps {
  activities: WorkActivity[];
  emptyTitle?: string;
  emptyDescription?: string;
}

const WorkActivityTimeline: React.FC<WorkActivityTimelineProps> = ({
  activities,
  emptyTitle = 'لا يوجد نشاط بعد',
  emptyDescription = 'عند تسجيل عمليات جديدة داخل هذا السياق ستظهر هنا بترتيب زمني واضح.',
}) => {
  if (!activities.length) {
    return <WorkEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const groups = groupActivitiesByDay(activities);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{group.label}</div>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-3">
            {group.items.map((activity) => (
              <article key={activity.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <WorkStatusBadge label={getActivityTypeLabel(activity.activity_type)} tone={getStatusTone(activity.object_type ?? activity.activity_type)} />
                      {activity.object_type ? (
                        <span className="text-xs font-bold text-slate-500">{getObjectLabel(activity.object_type)}</span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm font-bold leading-7 text-[#071C3B]">
                      {activity.summary || getActivityTypeLabel(activity.activity_type)}
                    </p>

                    <div className="mt-2 text-xs text-slate-500">
                      {(activity.actor_name || 'عضو فريق')} • {formatWorkDate(activity.created_at, true)} • {formatRelativeTime(activity.created_at)}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default WorkActivityTimeline;
