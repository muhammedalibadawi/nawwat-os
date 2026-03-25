import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { WorkDoc, WorkDocBlock, WorkDocFormInput, WorkDocsResponse, WorkSavedView } from '@/types/workos';
import {
  addDocBlock,
  archiveSavedView,
  archiveWorkObject,
  createDoc,
  loadDocBlocks,
  loadDocs,
  saveWorkSavedView,
  updateDoc,
} from '@/services/workosService';
import { canContributeWorkRole, isWorkAdminRole, normalizeWorkOsError } from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import WorkDocList from '@/components/workos/WorkDocList';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import WorkDocModal from '@/components/workos/WorkDocModal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import ArchiveWorkObjectDialog from '@/components/workos/ArchiveWorkObjectDialog';
import WorkDocBlockViewer from '@/components/workos/WorkDocBlockViewer';
import WorkSavedViewsPanel from '@/components/workos/WorkSavedViewsPanel';

const WorkDocsScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [archiveBusyId, setArchiveBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [data, setData] = useState<WorkDocsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [teamSpaceId, setTeamSpaceId] = useState(searchParams.get('teamSpace') || '');
  const [projectId, setProjectId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<WorkDoc | null>(null);
  const [archivingDoc, setArchivingDoc] = useState<WorkDoc | null>(null);
  const [selectedDocId, setSelectedDocId] = useState(searchParams.get('doc') || '');
  const [docBlocks, setDocBlocks] = useState<WorkDocBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [archivingViewId, setArchivingViewId] = useState('');
  const hasFilters = Boolean(query.trim() || teamSpaceId || projectId);
  const teamSpacesCount = data?.team_spaces?.length ?? 0;

  const canContribute = canContributeWorkRole(user?.role);
  const canArchive = isWorkAdminRole(user?.role);

  const selectedDoc = useMemo(
    () => data?.docs.find((doc) => doc.id === selectedDocId) ?? data?.docs[0] ?? null,
    [data?.docs, selectedDocId]
  );

  const reload = async (tenantId: string, nextQuery: string, nextTeamSpaceId: string, nextProjectId: string) => {
    setLoading(true);
    setError('');
    try {
      const nextData = await loadDocs(tenantId, {
        query: nextQuery,
        team_space_id: nextTeamSpaceId || undefined,
        project_id: nextProjectId || undefined,
      });
      setData(nextData);
      setSelectedDocId((current) => {
        if (current && nextData.docs.some((doc) => doc.id === current)) return current;
        if (searchParams.get('doc') && nextData.docs.some((doc) => doc.id === searchParams.get('doc'))) {
          return searchParams.get('doc') || '';
        }
        return nextData.docs[0]?.id ?? '';
      });
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل المستندات.'));
    } finally {
      setLoading(false);
    }
  };

  const reloadBlocks = async (tenantId: string, docId: string) => {
    setBlocksLoading(true);
    try {
      const nextBlocks = await loadDocBlocks(tenantId, docId);
      setDocBlocks(nextBlocks);
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل كتل المستند.'));
      setDocBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id) return;
    void reload(user.tenant_id, query, teamSpaceId, projectId);
  }, [projectId, query, teamSpaceId, user?.tenant_id]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedDoc?.id) {
      setDocBlocks([]);
      return;
    }
    void reloadBlocks(user.tenant_id, selectedDoc.id);
  }, [selectedDoc?.id, user?.tenant_id]);

  const handleSave = async (value: WorkDocFormInput) => {
    if (!user?.tenant_id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const saved = editingDoc
        ? await updateDoc(user.tenant_id, editingDoc.id, value)
        : await createDoc(user.tenant_id, value);
      setSuccess(editingDoc ? 'تم تحديث المستند بنجاح.' : 'تم إنشاء المستند بنجاح.');
      setModalOpen(false);
      setEditingDoc(null);
      await reload(user.tenant_id, query, teamSpaceId, projectId);
      setSelectedDocId(saved.id);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر حفظ المستند.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (reason?: string) => {
    if (!user?.tenant_id || !archivingDoc) return;
    setArchiveBusyId(archivingDoc.id);
    setError('');
    setSuccess('');
    try {
      await archiveWorkObject('doc', archivingDoc.id, reason ?? 'Archived from WorkDocsScreen');
      setSuccess('تمت أرشفة المستند بنجاح.');
      setArchivingDoc(null);
      await reload(user.tenant_id, query, teamSpaceId, projectId);
    } catch (archiveError) {
      setError(normalizeWorkOsError(archiveError, 'تعذر أرشفة المستند المطلوب.'));
    } finally {
      setArchiveBusyId('');
    }
  };

  const handleAddBlock = async (text: string) => {
    if (!user?.tenant_id || !selectedDoc) return;
    setBlockSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await addDocBlock(user.tenant_id, selectedDoc.id, text);
      setSuccess('تمت إضافة كتلة جديدة إلى المستند.');
      await reloadBlocks(user.tenant_id, selectedDoc.id);
      await reload(user.tenant_id, query, teamSpaceId, projectId);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر إضافة الكتلة الجديدة.'));
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleSaveView = async (name: string) => {
    if (!user?.tenant_id) return;
    setSavingView(true);
    setError('');
    setSuccess('');
    try {
      await saveWorkSavedView(user.tenant_id, {
        name,
        view_type: 'doc',
        team_space_id: teamSpaceId || null,
        project_id: projectId || null,
        filters: {
          query: query.trim() || null,
          team_space_id: teamSpaceId || null,
          project_id: projectId || null,
        },
      });
      setSuccess('تم حفظ العرض الحالي بنجاح.');
      await reload(user.tenant_id, query, teamSpaceId, projectId);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر حفظ العرض الحالي.'));
    } finally {
      setSavingView(false);
    }
  };

  const handleApplySavedView = (view: WorkSavedView) => {
    const filters = view.filters ?? {};
    setQuery(typeof filters.query === 'string' ? filters.query : '');
    setTeamSpaceId(typeof filters.team_space_id === 'string' ? filters.team_space_id : '');
    setProjectId(typeof filters.project_id === 'string' ? filters.project_id : '');
    setSuccess(`تم فتح العرض المحفوظ: ${view.name}`);
  };

  const handleArchiveSavedView = async (view: WorkSavedView) => {
    setArchivingViewId(view.id);
    setError('');
    setSuccess('');
    try {
      await archiveSavedView(view.id, 'Archived from WorkDocsScreen');
      setSuccess('تمت أرشفة العرض المحفوظ.');
      if (user?.tenant_id) {
        await reload(user.tenant_id, query, teamSpaceId, projectId);
      }
    } catch (archiveError) {
      setError(normalizeWorkOsError(archiveError, 'تعذر أرشفة العرض المحفوظ.'));
    } finally {
      setArchivingViewId('');
    }
  };

  const initialValue = editingDoc
    ? {
        team_space_id: editingDoc.team_space_id,
        project_id: editingDoc.project_id ?? '',
        title: editingDoc.title,
        slug: editingDoc.slug ?? '',
        summary: editingDoc.summary ?? '',
        doc_type: editingDoc.doc_type,
        status: editingDoc.status,
        visibility: editingDoc.visibility,
        initial_block_text: '',
      }
    : null;

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="المستندات"
        subtitle="قائمة WorkOS للمستندات مع معاينة فعلية للكتل وحفظ عروض بسيطة بدون محرر ثقيل."
        actions={
          canContribute && teamSpacesCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setEditingDoc(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <Plus size={16} />
              مستند جديد
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

      {!loading && data && teamSpacesCount === 0 ? (
        <StatusBanner variant="warning" className="rounded-2xl">
          السبب: لا توجد مساحات فريق مهيأة في WorkOS لهذا tenant/مساحة العمل بعد. لإنشاء مستندات، ابدأ من{' '}
          <Link to="/work/team-spaces" className="font-black underline underline-offset-2">
            مساحات الفرق
          </Link>
          ، ثم عد إلى هذه الشاشة.
        </StatusBanner>
      ) : null}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 right-4 my-auto text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بعنوان المستند"
              className="w-full rounded-2xl border border-slate-200 py-3 pr-11 pl-4"
            />
          </div>
          <select value={teamSpaceId} onChange={(event) => setTeamSpaceId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="">كل المساحات</option>
            {(data?.team_spaces ?? []).map((space) => (
              <option key={space.id} value={space.id}>
                {space.name_ar || space.name}
              </option>
            ))}
          </select>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
            <option value="">كل المشاريع</option>
            {(data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name_ar || project.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="space-y-6">
          {searchParams.get('doc') ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">
              وصلت إلى هذه الشاشة مع مرجع لمستند محدد. يمكنك الآن فتحه من القائمة أو متابعة تعديل بياناته الأساسية.
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
              ))}
            </div>
          ) : data && data.docs.length ? (
            <WorkDocList
              docs={data.docs}
              canManage={canContribute}
              busyId={archiveBusyId}
              onOpen={(doc) => setSelectedDocId(doc.id)}
              onEdit={(doc) => {
                setEditingDoc(doc);
                setModalOpen(true);
              }}
              onArchive={canArchive ? (doc) => setArchivingDoc(doc) : undefined}
            />
          ) : (
            <WorkEmptyState
              title={
                teamSpacesCount === 0
                  ? 'لا توجد مستندات لأن مساحات الفرق غير موجودة'
                  : hasFilters
                    ? 'لا توجد مستندات مطابقة للفلاتر'
                    : 'لا توجد مستندات بعد'
              }
              description={
                teamSpacesCount === 0
                  ? 'لإنشاء مستند تحتاج على الأقل مساحة فريق واحدة. اذهب إلى مساحات الفرق ثم أنشئ مساحة وأعد المحاولة.'
                  : hasFilters
                    ? 'غيّر كلمات البحث أو الفلاتر (المساحة/المشروع) لعرض نتائج أوسع.'
                    : 'لم يتم إنشاء مستندات بعد في مساحة العمل الحالية. هذا طبيعي في بيئة جديدة قبل إضافة بيانات تجريبية.'
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <WorkSavedViewsPanel
            views={data?.saved_views ?? []}
            saving={savingView}
            archivingId={archivingViewId}
            onSave={handleSaveView}
            onApply={handleApplySavedView}
            onArchive={handleArchiveSavedView}
          />

          <WorkDocBlockViewer
            doc={selectedDoc}
            blocks={docBlocks}
            loading={blocksLoading}
            canAddBlock={canContribute}
            submitting={blockSubmitting}
            onAddBlock={handleAddBlock}
          />
        </div>
      </div>

      <WorkDocModal
        open={modalOpen}
        mode={editingDoc ? 'edit' : 'create'}
        initialValue={initialValue}
        teamSpaces={data?.team_spaces ?? []}
        projects={data?.projects ?? []}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          setEditingDoc(null);
        }}
        onSubmit={handleSave}
      />

      <ArchiveWorkObjectDialog
        open={Boolean(archivingDoc)}
        objectType="doc"
        objectLabel={archivingDoc?.title || ''}
        submitting={Boolean(archiveBusyId)}
        onClose={() => {
          if (archiveBusyId) return;
          setArchivingDoc(null);
        }}
        onConfirm={handleArchive}
      />
    </div>
  );
};

export default WorkDocsScreen;
