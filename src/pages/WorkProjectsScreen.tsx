import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { WorkProject, WorkProjectFormInput, WorkProjectStatus, WorkProjectsResponse, WorkUserOption } from '@/types/workos';
import { archiveWorkObject, createProject, loadProjects, loadWorkUsers, updateProject } from '@/services/workosService';
import { getProjectStatusLabel, isWorkAdminRole, normalizeWorkOsError } from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import ProjectCard from '@/components/workos/ProjectCard';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import ProjectModal from '@/components/workos/ProjectModal';
import ArchiveWorkObjectDialog from '@/components/workos/ArchiveWorkObjectDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';

const WorkProjectsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [archiveBusyId, setArchiveBusyId] = useState('');
  const [data, setData] = useState<WorkProjectsResponse | null>(null);
  const [users, setUsers] = useState<WorkUserOption[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WorkProjectStatus | 'all'>('all');
  const [teamSpaceId, setTeamSpaceId] = useState(searchParams.get('teamSpace') || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<WorkProject | null>(null);
  const [archivingProject, setArchivingProject] = useState<WorkProject | null>(null);

  const canManage = isWorkAdminRole(user?.role);

  const reload = async (
    tenantId: string,
    nextQuery: string,
    nextStatus: WorkProjectStatus | 'all',
    nextTeamSpaceId: string
  ) => {
    setLoading(true);
    setError('');
    try {
      const [nextData, nextUsers] = await Promise.all([
        loadProjects(tenantId, {
          query: nextQuery,
          status: nextStatus,
          team_space_id: nextTeamSpaceId || undefined,
        }),
        loadWorkUsers(tenantId),
      ]);
      setData(nextData);
      setUsers(nextUsers);
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل المشاريع.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    void reload(user.tenant_id, query, status, teamSpaceId);
  }, [query, status, teamSpaceId, user?.tenant_id]);

  const totalOpenTasks = useMemo(
    () => (data?.projects ?? []).reduce((sum, project) => sum + Number(project.open_tasks ?? 0), 0),
    [data?.projects]
  );
  const hasFilters = Boolean(query.trim() || teamSpaceId || status !== 'all');

  const handleSave = async (value: WorkProjectFormInput) => {
    if (!user?.tenant_id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (editingProject) {
        await updateProject(user.tenant_id, editingProject.id, value);
        setSuccess('تم تحديث المشروع بنجاح.');
      } else {
        const created = await createProject(user.tenant_id, value);
        setSuccess('تم إنشاء المشروع بنجاح.');
        navigate(`/work/projects/${created.id}`);
      }
      setModalOpen(false);
      setEditingProject(null);
      await reload(user.tenant_id, query, status, teamSpaceId);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر حفظ المشروع.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (reason?: string) => {
    if (!user?.tenant_id || !archivingProject) return;
    setArchiveBusyId(archivingProject.id);
    setError('');
    setSuccess('');
    try {
      await archiveWorkObject('project', archivingProject.id, reason ?? 'Archived from WorkProjectsScreen');
      setSuccess('تمت أرشفة المشروع بنجاح.');
      setArchivingProject(null);
      await reload(user.tenant_id, query, status, teamSpaceId);
    } catch (archiveError) {
      setError(normalizeWorkOsError(archiveError, 'تعذر أرشفة المشروع المطلوب.'));
    } finally {
      setArchiveBusyId('');
    }
  };

  const initialValue = editingProject
    ? {
        team_space_id: editingProject.team_space_id,
        name: editingProject.name,
        description: editingProject.description ?? '',
        status: editingProject.status,
        priority: editingProject.priority,
        owner_user_id: editingProject.owner_user_id ?? '',
        lead_user_id: editingProject.lead_user_id ?? '',
        start_date: editingProject.start_date ?? '',
        due_date: editingProject.due_date ?? '',
        visibility: editingProject.visibility,
      }
    : null;

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="المشاريع"
        subtitle="إدارة المشاريع الأساسية داخل WorkOS مع القدرة على الإنشاء والتعديل والأرشفة دون تعقيد إضافي."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <Plus size={16} />
              مشروع جديد
            </button>
          ) : null
        }
      />

      {(success || error) && (
        <div className="mt-4 space-y-2">
          {success ? <StatusBanner variant="success" className="rounded-2xl">{success}</StatusBanner> : null}
          {error ? <StatusBanner variant="error" className="rounded-2xl">{error}</StatusBanner> : null}
        </div>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 right-4 my-auto text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم المشروع"
              className="w-full rounded-2xl border border-slate-200 py-3 pr-11 pl-4"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as WorkProjectStatus | 'all')}
            className="rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="all">كل الحالات</option>
            {(['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'] as const).map((entry) => (
              <option key={entry} value={entry}>
                {getProjectStatusLabel(entry)}
              </option>
            ))}
          </select>
          <select
            value={teamSpaceId}
            onChange={(event) => setTeamSpaceId(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="">كل المساحات</option>
            {(data?.team_spaces ?? []).map((space) => (
              <option key={space.id} value={space.id}>
                {space.name_ar || space.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!loading && data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">المشاريع الظاهرة</div>
            <div className="mt-2 text-2xl font-black text-[#071C3B]">{data.projects.length}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">إجمالي المهام المفتوحة</div>
            <div className="mt-2 text-2xl font-black text-[#071C3B]">{totalOpenTasks}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">عدد المساحات المغطاة</div>
            <div className="mt-2 text-2xl font-black text-[#071C3B]">{data.team_spaces.length}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-[24px] bg-slate-100" />
          ))}
        </div>
      ) : data && data.projects.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {data.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManage}
              onEdit={(selectedProject) => {
                setEditingProject(selectedProject);
                setModalOpen(true);
              }}
              onArchive={(selectedProject) => setArchivingProject(selectedProject)}
              busy={archiveBusyId === project.id}
            />
          ))}
        </div>
      ) : (
        <WorkEmptyState
          title={hasFilters ? 'لا توجد مشاريع مطابقة للفلاتر' : 'لا توجد مشاريع بعد'}
          description={
            hasFilters
              ? 'جرّب تخفيف الفلاتر (الحالة/المساحة/البحث) أو اختيار مساحة فريق مختلفة.'
              : data?.team_spaces?.length
                ? 'مساحات الفرق موجودة لكن لا توجد مشاريع مسجلة بعد في هذه المساحة المستأجرة.'
                : 'لا توجد مساحات فرق أو مشاريع بعد. ابدأ بمساحة فريق أولًا ثم أضف مشروعًا تجريبيًا.'
          }
        />
      )}

      <ProjectModal
        open={modalOpen}
        mode={editingProject ? 'edit' : 'create'}
        initialValue={initialValue}
        teamSpaces={data?.team_spaces ?? []}
        users={users}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleSave}
      />

      <ArchiveWorkObjectDialog
        open={Boolean(archivingProject)}
        objectType="project"
        objectLabel={archivingProject?.name_ar || archivingProject?.name || ''}
        submitting={Boolean(archiveBusyId)}
        onClose={() => {
          if (archiveBusyId) return;
          setArchivingProject(null);
        }}
        onConfirm={handleArchive}
      />
    </div>
  );
};

export default WorkProjectsScreen;
