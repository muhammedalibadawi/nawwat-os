import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Archive, Link2, Pencil, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type {
  WorkChannel,
  WorkDoc,
  WorkDocBlock,
  WorkLinkableOption,
  WorkMessage,
  WorkObjectType,
  WorkProjectDetailData,
  WorkProjectFormInput,
  WorkTask,
  WorkTaskFormInput,
  WorkTeamSpace,
  WorkThread,
  WorkUserOption,
} from '@/types/workos';
import {
  addDocBlock,
  archiveWorkObject,
  createMessage,
  createTask,
  linkWorkObjects,
  loadChannelThreads,
  loadDocBlocks,
  loadProjectActivity,
  loadProjectDetails,
  loadTeamSpaces,
  loadThreadMessages,
  loadWorkUsers,
  updateProject,
  updateTask,
  updateWorkTaskQuickFields,
} from '@/services/workosService';
import {
  canContributeWorkRole,
  formatWorkDate,
  getObjectLabel,
  getPriorityLabel,
  getPriorityTone,
  getProjectStatusLabel,
  getRelationLabel,
  isWorkAdminRole,
  normalizeWorkOsError,
} from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import WorkTaskList from '@/components/workos/WorkTaskList';
import WorkDocList from '@/components/workos/WorkDocList';
import WorkChannelList from '@/components/workos/WorkChannelList';
import WorkStatusBadge from '@/components/workos/WorkStatusBadge';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import { StatusBanner } from '@/components/ui/StatusBanner';
import ProjectModal from '@/components/workos/ProjectModal';
import WorkTaskModal from '@/components/workos/WorkTaskModal';
import LinkObjectsModal from '@/components/workos/LinkObjectsModal';
import ArchiveWorkObjectDialog from '@/components/workos/ArchiveWorkObjectDialog';
import WorkActivityTimeline from '@/components/workos/WorkActivityTimeline';
import WorkDocBlockViewer from '@/components/workos/WorkDocBlockViewer';
import WorkThreadList from '@/components/workos/WorkThreadList';
import WorkThreadPanel from '@/components/workos/WorkThreadPanel';

interface ArchiveTarget {
  type: WorkObjectType;
  id: string;
  label: string;
}

const WorkProjectDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [quickTaskBusyId, setQuickTaskBusyId] = useState('');
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [data, setData] = useState<WorkProjectDetailData | null>(null);
  const [activityItems, setActivityItems] = useState<WorkProjectDetailData['activities']>([]);
  const [teamSpaces, setTeamSpaces] = useState<WorkTeamSpace[]>([]);
  const [users, setUsers] = useState<WorkUserOption[]>([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [docBlocks, setDocBlocks] = useState<WorkDocBlock[]>([]);
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [messages, setMessages] = useState<WorkMessage[]>([]);

  const canManageProject = isWorkAdminRole(user?.role);
  const canContribute = canContributeWorkRole(user?.role);

  const selectedDoc = useMemo(
    () => data?.docs.find((doc) => doc.id === selectedDocId) ?? data?.docs[0] ?? null,
    [data?.docs, selectedDocId]
  );
  const selectedChannel = useMemo(
    () => data?.channels.find((channel) => channel.id === selectedChannelId) ?? data?.channels[0] ?? null,
    [data?.channels, selectedChannelId]
  );
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [selectedThreadId, threads]
  );

  const reload = async (tenantId: string, projectId: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [nextData, nextTeamSpaces, nextUsers, nextActivity] = await Promise.all([
        loadProjectDetails(tenantId, projectId),
        loadTeamSpaces(tenantId),
        loadWorkUsers(tenantId),
        loadProjectActivity(tenantId, projectId),
      ]);
      setData(nextData);
      setActivityItems(nextActivity.length ? nextActivity : nextData.activities);
      setTeamSpaces(nextTeamSpaces);
      setUsers(nextUsers);
      setSelectedDocId((current) => (current && nextData.docs.some((doc) => doc.id === current) ? current : nextData.docs[0]?.id ?? ''));
      setSelectedChannelId((current) =>
        current && nextData.channels.some((channel) => channel.id === current) ? current : nextData.channels[0]?.id ?? ''
      );
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل صفحة المشروع.'));
    } finally {
      setLoading(false);
    }
  };

  const reloadDocBlocks = async (tenantId: string, docId: string) => {
    setBlocksLoading(true);
    setSuccess('');
    try {
      const nextBlocks = await loadDocBlocks(tenantId, docId);
      setDocBlocks(nextBlocks);
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل كتل المستند المرتبط.'));
      setDocBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  };

  const reloadThreads = async (tenantId: string, channelId: string) => {
    setThreadsLoading(true);
    setSuccess('');
    try {
      const nextThreads = await loadChannelThreads(tenantId, channelId);
      setThreads(nextThreads);
      setSelectedThreadId((current) => (current && nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0]?.id ?? ''));
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل نقاشات القناة المرتبطة.'));
      setThreads([]);
      setSelectedThreadId('');
    } finally {
      setThreadsLoading(false);
    }
  };

  const reloadMessages = async (tenantId: string, threadId: string) => {
    setMessagesLoading(true);
    setSuccess('');
    try {
      const nextMessages = await loadThreadMessages(tenantId, threadId);
      setMessages(nextMessages);
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل رسائل النقاش.'));
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.tenant_id || !id) return;
    void reload(user.tenant_id, id);
  }, [id, user?.tenant_id]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedDoc?.id) {
      setDocBlocks([]);
      return;
    }
    void reloadDocBlocks(user.tenant_id, selectedDoc.id);
  }, [selectedDoc?.id, user?.tenant_id]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedChannel?.id) {
      setThreads([]);
      setSelectedThreadId('');
      return;
    }
    void reloadThreads(user.tenant_id, selectedChannel.id);
  }, [selectedChannel?.id, user?.tenant_id]);

  useEffect(() => {
    if (!user?.tenant_id || !selectedThread?.id) {
      setMessages([]);
      return;
    }
    void reloadMessages(user.tenant_id, selectedThread.id);
  }, [selectedThread?.id, user?.tenant_id]);

  const projectInitialValue: WorkProjectFormInput | null = data
    ? {
        team_space_id: data.project.team_space_id,
        name: data.project.name,
        description: data.project.description ?? '',
        status: data.project.status,
        priority: data.project.priority,
        owner_user_id: data.project.owner_user_id ?? '',
        lead_user_id: data.project.lead_user_id ?? '',
        start_date: data.project.start_date ?? '',
        due_date: data.project.due_date ?? '',
        visibility: data.project.visibility,
      }
    : null;

  const taskInitialValue: WorkTaskFormInput = editingTask
    ? {
        team_space_id: editingTask.team_space_id,
        project_id: editingTask.project_id ?? data?.project.id ?? '',
        title: editingTask.title,
        description: editingTask.description ?? '',
        task_type: editingTask.task_type,
        status: editingTask.status,
        priority: editingTask.priority,
        assignee_user_id: editingTask.assignee_user_id ?? '',
        due_at: editingTask.due_at ? editingTask.due_at.slice(0, 16) : '',
      }
    : {
        team_space_id: data?.project.team_space_id ?? '',
        project_id: data?.project.id ?? '',
        title: '',
        description: '',
        task_type: 'task',
        status: 'todo',
        priority: 'medium',
        assignee_user_id: '',
        due_at: '',
      };

  const linkLeftOptions = useMemo<WorkLinkableOption[]>(() => {
    if (!data) return [];
    return [
      {
        id: data.project.id,
        type: 'project',
        label: data.project.name_ar || data.project.name,
        subtitle: 'المشروع الحالي',
      },
      ...data.tasks.map((task) => ({
        id: task.id,
        type: 'task' as const,
        label: task.title,
        subtitle: 'مهمة مرتبطة بالمشروع',
      })),
    ];
  }, [data]);

  const linkRightOptions = useMemo<WorkLinkableOption[]>(() => {
    if (!data) return [];
    return [
      ...data.docs.map((doc) => ({
        id: doc.id,
        type: 'doc' as const,
        label: doc.title,
        subtitle: doc.doc_type,
      })),
      ...data.channels.map((channel: WorkChannel) => ({
        id: channel.id,
        type: 'channel' as const,
        label: `#${channel.name}`,
        subtitle: channel.channel_type,
      })),
    ];
  }, [data]);

  const handleSaveProject = async (value: WorkProjectFormInput) => {
    if (!user?.tenant_id || !data) return;
    setSavingProject(true);
    setError('');
    setSuccess('');
    try {
      await updateProject(user.tenant_id, data.project.id, value);
      setSuccess('تم تحديث المشروع بنجاح.');
      setProjectModalOpen(false);
      await reload(user.tenant_id, data.project.id);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر تحديث المشروع الحالي.'));
    } finally {
      setSavingProject(false);
    }
  };

  const handleSaveTask = async (value: WorkTaskFormInput) => {
    if (!user?.tenant_id || !data) return;
    setSavingTask(true);
    setError('');
    setSuccess('');
    try {
      if (editingTask) {
        await updateTask(user.tenant_id, editingTask.id, value);
        setSuccess('تم تحديث المهمة بنجاح.');
      } else {
        await createTask(user.tenant_id, value);
        setSuccess('تم إنشاء المهمة بنجاح.');
      }
      setTaskModalOpen(false);
      setEditingTask(null);
      await reload(user.tenant_id, data.project.id);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر حفظ المهمة.'));
    } finally {
      setSavingTask(false);
    }
  };

  const handleTaskQuickUpdate = async (task: WorkTask, patch: { status?: WorkTask['status']; priority?: WorkTask['priority'] }) => {
    if (!user?.tenant_id || !data) return;
    setQuickTaskBusyId(task.id);
    setError('');
    setSuccess('');
    try {
      await updateWorkTaskQuickFields(user.tenant_id, task.id, patch);
      setSuccess('تم تحديث المهمة بسرعة.');
      await reload(user.tenant_id, data.project.id);
    } catch (updateError) {
      setError(normalizeWorkOsError(updateError, 'تعذر تنفيذ التحديث السريع للمهمة.'));
    } finally {
      setQuickTaskBusyId('');
    }
  };

  const handleLink = async (input: Parameters<typeof linkWorkObjects>[0]) => {
    if (!user?.tenant_id || !data) return;
    setLinking(true);
    setError('');
    setSuccess('');
    try {
      await linkWorkObjects(input);
      setSuccess('تم ربط العناصر بنجاح.');
      setLinkModalOpen(false);
      await reload(user.tenant_id, data.project.id);
    } catch (linkError) {
      setError(normalizeWorkOsError(linkError, 'تعذر ربط العناصر المطلوبة.'));
    } finally {
      setLinking(false);
    }
  };

  const handleArchive = async (reason?: string) => {
    if (!data || !archiveTarget || !user?.tenant_id) return;
    setArchiveBusy(true);
    setError('');
    setSuccess('');
    try {
      await archiveWorkObject(archiveTarget.type, archiveTarget.id, reason ?? 'Archived from WorkProjectDetailScreen');
      setSuccess(`تمت أرشفة ${getObjectLabel(archiveTarget.type)} بنجاح.`);
      const archivedType = archiveTarget.type;
      setArchiveTarget(null);
      if (archivedType === 'project') {
        navigate('/work/projects');
        return;
      }
      await reload(user.tenant_id, data.project.id);
    } catch (archiveError) {
      setError(normalizeWorkOsError(archiveError, 'تعذر أرشفة العنصر الحالي.'));
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleAddBlock = async (text: string) => {
    if (!user?.tenant_id || !selectedDoc || !data) return;
    setBlockSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await addDocBlock(user.tenant_id, selectedDoc.id, text);
      setSuccess('تمت إضافة كتلة جديدة إلى المستند.');
      await reloadDocBlocks(user.tenant_id, selectedDoc.id);
      await reload(user.tenant_id, data.project.id);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر إضافة كتلة جديدة.'));
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleCreateProjectMessage = async (body: string) => {
    if (!user?.tenant_id || !selectedThread) return;
    setMessageSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await createMessage(user.tenant_id, {
        thread_id: selectedThread.id,
        body,
      });
      setSuccess('تم إرسال الرسالة داخل النقاش.');
      await reloadMessages(user.tenant_id, selectedThread.id);
      if (selectedChannel) {
        await reloadThreads(user.tenant_id, selectedChannel.id);
      }
      if (data) {
        const nextActivity = await loadProjectActivity(user.tenant_id, data.project.id);
        setActivityItems(nextActivity);
      }
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر إرسال الرسالة داخل النقاش.'));
    } finally {
      setMessageSubmitting(false);
    }
  };

  if (!id) {
    return (
      <div dir="rtl" className="space-y-6">
        <WorkEmptyState
          title="معرّف المشروع غير متاح"
          description="السبب: تعذر تحديد المشروع المطلوب من الرابط الحالي (المعرّف غير موجود/غير صالح)."
        />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title={data?.project.name_ar || data?.project.name || 'تفاصيل المشروع'}
        subtitle={data?.project.description || 'صفحة مشروع عملية تعرض المهام والمستندات والقنوات والنشاط بشكل متعاون وواضح.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full text-xs font-black text-slate-500 md:w-auto">إجراءات سريعة</span>
            <button
              type="button"
              onClick={() => navigate('/work/projects')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
            >
              <ArrowRight size={16} />
              رجوع للمشاريع
            </button>
            {canContribute ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#00CFFF] px-4 py-2.5 text-sm font-black text-[#071C3B]"
                >
                  <Plus size={16} />
                  مهمة جديدة
                </button>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Link2 size={16} />
                  ربط عناصر
                </button>
              </>
            ) : null}
            {canManageProject ? (
              <>
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Pencil size={16} />
                  تعديل المشروع
                </button>
                <button
                  type="button"
                  onClick={() =>
                    data?.project &&
                    setArchiveTarget({
                      type: 'project',
                      id: data.project.id,
                      label: data.project.name_ar || data.project.name,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/15 px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Archive size={16} />
                  أرشفة المشروع
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {(success || error) && (
        <div className="mt-4 space-y-2">
          {success ? <StatusBanner variant="success" className="rounded-2xl">{success}</StatusBanner> : null}
          {error ? <StatusBanner variant="error" className="rounded-2xl">{error}</StatusBanner> : null}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-[24px] bg-slate-100" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-80 animate-pulse rounded-[24px] bg-slate-100" />
            <div className="h-80 animate-pulse rounded-[24px] bg-slate-100" />
          </div>
        </div>
      ) : data ? (
        <>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black text-[#071C3B]">نظرة عامة</div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <WorkStatusBadge label={getProjectStatusLabel(data.project.status)} tone={data.project.status} />
                  <WorkStatusBadge label={getPriorityLabel(data.project.priority)} tone={getPriorityTone(data.project.priority)} />
                  {data.team_space ? <WorkStatusBadge label={data.team_space.name_ar || data.team_space.name} tone="sky" /> : null}
                </div>
                <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    مالك المشروع: <span className="font-bold text-[#071C3B]">{data.project.owner_name || 'غير محدد'}</span>
                  </div>
                  <div>
                    قائد المتابعة: <span className="font-bold text-[#071C3B]">{data.project.lead_name || 'غير محدد'}</span>
                  </div>
                  <div>
                    تاريخ البدء: <span className="font-bold text-[#071C3B]">{formatWorkDate(data.project.start_date)}</span>
                  </div>
                  <div>
                    تاريخ الاستحقاق: <span className="font-bold text-[#071C3B]">{formatWorkDate(data.project.due_date)}</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">الأعضاء</div>
                  <div className="mt-2 text-xl font-black text-[#071C3B]">{data.members.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">المهام</div>
                  <div className="mt-2 text-xl font-black text-[#071C3B]">{data.tasks.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">المستندات</div>
                  <div className="mt-2 text-xl font-black text-[#071C3B]">{data.docs.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">القنوات</div>
                  <div className="mt-2 text-xl font-black text-[#071C3B]">{data.channels.length}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_430px]">
            <div className="space-y-6">
              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-[#071C3B]">المهام</h2>
                  <p className="text-sm text-slate-500">قائمة مهام المشروع مع إجراءات الحالة والأولوية.</p>
                </div>
                <WorkTaskList
                  tasks={data.tasks}
                  canManage={canContribute}
                  busyId={archiveBusy && archiveTarget?.type === 'task' ? archiveTarget.id : ''}
                  quickActionBusyId={quickTaskBusyId}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setTaskModalOpen(true);
                  }}
                  onStatusChange={(task, status) => void handleTaskQuickUpdate(task, { status })}
                  onPriorityChange={(task, priority) => void handleTaskQuickUpdate(task, { priority })}
                  onArchive={
                    canManageProject
                      ? (task) =>
                          setArchiveTarget({
                            type: 'task',
                            id: task.id,
                            label: task.title,
                          })
                      : undefined
                  }
                  emptyTitle="لا توجد مهام مرتبطة بهذا المشروع"
                />
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#071C3B]">المستندات</h2>
                    <p className="text-sm text-slate-500">افتح المستندات مباشرة داخل صفحة المشروع.</p>
                  </div>
                </div>
                <WorkDocList
                  docs={data.docs}
                  canManage={canContribute}
                  busyId={archiveBusy && archiveTarget?.type === 'doc' ? archiveTarget.id : ''}
                  onOpen={(doc: WorkDoc) => setSelectedDocId(doc.id)}
                  onEdit={(doc) => navigate(`/work/docs?doc=${doc.id}`)}
                  onArchive={
                    canManageProject
                      ? (doc) =>
                          setArchiveTarget({
                            type: 'doc',
                            id: doc.id,
                            label: doc.title,
                          })
                      : undefined
                  }
                  emptyTitle="لا توجد مستندات مرتبطة بالمشروع"
                />
                <WorkDocBlockViewer
                  doc={selectedDoc}
                  blocks={docBlocks}
                  loading={blocksLoading}
                  canAddBlock={canContribute}
                  submitting={blockSubmitting}
                  onAddBlock={handleAddBlock}
                />
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-[#071C3B]">القنوات</h2>
                  <p className="text-sm text-slate-500">تتبع النقاشات والرسائل الأخيرة داخل الصفحة.</p>
                </div>
                <WorkChannelList
                  channels={data.channels}
                  canManage={canContribute}
                  busyId={archiveBusy && archiveTarget?.type === 'channel' ? archiveTarget.id : ''}
                  onOpen={(channel: WorkChannel) => setSelectedChannelId(channel.id)}
                  onEdit={(channel) => navigate(`/work/channels?channel=${channel.id}`)}
                  onArchive={
                    canManageProject
                      ? (channel) =>
                          setArchiveTarget({
                            type: 'channel',
                            id: channel.id,
                            label: channel.name,
                          })
                      : undefined
                  }
                  emptyTitle="لا توجد قنوات مرتبطة بالمشروع"
                />

                <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-[#071C3B]">{selectedChannel ? `#${selectedChannel.name}` : 'نقاشات المشروع'}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedChannel?.description || 'اختر قناة مرتبطة بالمشروع لعرض النقاشات والرسائل الأخيرة.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    {threadsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                        ))}
                      </div>
                    ) : (
                      <WorkThreadList threads={threads} selectedThreadId={selectedThread?.id} onSelect={(thread) => setSelectedThreadId(thread.id)} />
                    )}
                  </div>
                </section>

                <WorkThreadPanel
                  thread={selectedThread}
                  messages={messages}
                  loading={messagesLoading}
                  canCreate={canContribute}
                  submitting={messageSubmitting}
                  onCreateMessage={handleCreateProjectMessage}
                />
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-[#071C3B]">النشاط</h2>
                <div className="mt-4">
                  <WorkActivityTimeline
                    activities={activityItems}
                    emptyTitle="لا يوجد نشاط بعد"
                    emptyDescription="سيظهر هنا النشاط المرتبط بالمشروع مثل الإنشاءات والتحديثات والربط والأرشفة."
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-[#071C3B]">أعضاء المشروع</h2>
                <div className="mt-4 space-y-3">
                  {data.members.length ? (
                    data.members.map((member) => (
                      <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-black text-[#071C3B]">{member.user_name || 'عضو فريق'}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">
                          {member.member_role} • {member.membership_status} • انضم {formatWorkDate(member.joined_at)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <WorkEmptyState
                      title="لا يوجد أعضاء بعد"
                      description="السبب: لا توجد أعضاء مرتبطون بهذا المشروع بعد. عند ربط أعضاء سيظهر هنا دورهم وحالة العضوية."
                    />
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-[#071C3B]">العلاقات المرتبطة</h2>
                <div className="mt-4 space-y-3">
                  {data.relations.length ? (
                    data.relations.map((relation) => (
                      <article key={relation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-black text-[#071C3B]">{getRelationLabel(relation.relation_type)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getObjectLabel(relation.left_object_type)} ←→ {getObjectLabel(relation.right_object_type)}
                        </div>
                      </article>
                    ))
                  ) : (
                    <WorkEmptyState
                      title="لا توجد علاقات مرئية بعد"
                      description="السبب: لا توجد روابط بين المشروع وبقية عناصر WorkOS (مستندات/قنوات/مهام) حتى الآن."
                    />
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      ) : (
        <WorkEmptyState
          title="المشروع غير متاح"
          description="السبب: تعذر العثور على المشروع المطلوب ضمن مساحة العمل الحالية (قد يكون بسبب رابط غير صحيح أو mismatch في tenant/صلاحيات)."
        />
      )}

      {data ? (
        <>
          <ProjectModal
            open={projectModalOpen}
            mode="edit"
            initialValue={projectInitialValue}
            teamSpaces={teamSpaces}
            users={users}
            submitting={savingProject}
            onClose={() => {
              if (savingProject) return;
              setProjectModalOpen(false);
            }}
            onSubmit={handleSaveProject}
          />

          <WorkTaskModal
            open={taskModalOpen}
            mode={editingTask ? 'edit' : 'create'}
            initialValue={taskInitialValue}
            users={users}
            submitting={savingTask}
            onClose={() => {
              if (savingTask) return;
              setTaskModalOpen(false);
              setEditingTask(null);
            }}
            onSubmit={handleSaveTask}
          />

          <LinkObjectsModal
            open={linkModalOpen}
            leftOptions={linkLeftOptions}
            rightOptions={linkRightOptions}
            submitting={linking}
            onClose={() => {
              if (linking) return;
              setLinkModalOpen(false);
            }}
            onSubmit={handleLink}
          />

          {archiveTarget ? (
            <ArchiveWorkObjectDialog
              open
              objectType={archiveTarget.type}
              objectLabel={archiveTarget.label}
              submitting={archiveBusy}
              onClose={() => {
                if (archiveBusy) return;
                setArchiveTarget(null);
              }}
              onConfirm={handleArchive}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default WorkProjectDetailScreen;
