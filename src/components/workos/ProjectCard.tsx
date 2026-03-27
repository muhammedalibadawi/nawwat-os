import React from 'react';
import { CalendarDays, FolderOpenDot, Layers3, Link as LinkIcon, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkProject } from '@/types/workos';
import { formatWorkDate, getPriorityLabel, getPriorityTone, getProjectStatusLabel } from '@/utils/workos';
import WorkStatusBadge from './WorkStatusBadge';

interface ProjectCardProps {
  project: WorkProject;
  onArchive?: (project: WorkProject) => void;
  onEdit?: (project: WorkProject) => void;
  canManage?: boolean;
  busy?: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onArchive,
  onEdit,
  canManage = false,
  busy = false,
}) => {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-[#071C3B]">{project.name_ar || project.name}</h3>
            <WorkStatusBadge label={getProjectStatusLabel(project.status)} tone={project.status} />
            <WorkStatusBadge label={getPriorityLabel(project.priority)} tone={getPriorityTone(project.priority)} />
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            {project.description || 'لا يوجد وصف بعد لهذا المشروع. سيظهر هنا وصف مختصر عند توفره في البيانات الأساسية.'}
          </p>
        </div>
        {project.project_key ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{project.project_key}</span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-500">المهام المفتوحة</div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{project.open_tasks ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-500">الأعضاء</div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{project.member_count ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-500">المستندات</div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{project.doc_count ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-500">القنوات</div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{project.channel_count ?? 0}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Layers3 size={14} />
          {project.team_space_name_ar || project.team_space_name || 'بدون مساحة محددة'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FolderOpenDot size={14} />
          {project.owner_name || 'بدون مالك محدد'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} />
          الاستحقاق {formatWorkDate(project.due_date)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          آخر نشاط {project.last_activity_at ? formatWorkDate(project.last_activity_at, true) : 'لا يوجد بعد'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/work/projects/${project.id}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#071C3B] px-4 py-2 text-sm font-black text-white transition hover:brightness-110"
          >
            <LinkIcon size={14} />
            صفحة المشروع
          </Link>
          {canManage && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(project)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil size={14} />
              تعديل
            </button>
          ) : null}
          {canManage && onArchive ? (
            <button
              type="button"
              onClick={() => onArchive(project)}
              disabled={busy}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'جارٍ...' : 'أرشفة'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default ProjectCard;
