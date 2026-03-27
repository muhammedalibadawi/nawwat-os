import React from 'react';
import { FolderKanban, MessageSquare, Pencil, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkTeamSpace } from '@/types/workos';
import { formatRelativeTime } from '@/utils/workos';

interface TeamSpaceCardProps {
  teamSpace: WorkTeamSpace;
  canManage?: boolean;
  onEdit?: (teamSpace: WorkTeamSpace) => void;
}

const TeamSpaceCard: React.FC<TeamSpaceCardProps> = ({ teamSpace, canManage = false, onEdit }) => {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-[#071C3B]"
            style={{ backgroundColor: `${teamSpace.color}20` }}
          >
            {teamSpace.icon ? teamSpace.icon.slice(0, 2) : 'WS'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#071C3B]">{teamSpace.name_ar || teamSpace.name}</h3>
              {teamSpace.is_default ? (
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-900">افتراضية</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {teamSpace.description || 'مساحة عمل تجمع المشاريع والمستندات والقنوات التابعة للفريق.'}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          {teamSpace.visibility === 'private' ? 'خاصة' : 'داخلية'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
            <FolderKanban size={14} />
            المشاريع
          </div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{teamSpace.project_count ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
            <ScrollText size={14} />
            المستندات
          </div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{teamSpace.doc_count ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
            <MessageSquare size={14} />
            القنوات
          </div>
          <div className="mt-2 text-xl font-black text-[#071C3B]">{teamSpace.channel_count ?? 0}</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">آخر تحديث {formatRelativeTime(teamSpace.updated_at)}</span>
        <div className="flex flex-wrap gap-2">
          {canManage && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(teamSpace)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil size={14} />
              تعديل
            </button>
          ) : null}
          <Link
            to={`/work/projects?teamSpace=${teamSpace.id}`}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            المشاريع
          </Link>
          <Link
            to={`/work/docs?teamSpace=${teamSpace.id}`}
            className="rounded-2xl bg-[#071C3B] px-4 py-2 text-sm font-black text-white transition hover:brightness-110"
          >
            فتح المحتوى
          </Link>
        </div>
      </div>
    </article>
  );
};

export default TeamSpaceCard;
