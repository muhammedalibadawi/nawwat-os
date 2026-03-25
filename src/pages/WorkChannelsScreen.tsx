import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type {
  WorkChannel,
  WorkChannelFormInput,
  WorkChannelsResponse,
  WorkMessage,
  WorkThread,
  WorkThreadType,
} from '@/types/workos';
import {
  archiveWorkObject,
  createChannel,
  createMessage,
  createThread,
  loadChannels,
  loadChannelThreads,
  loadThreadMessages,
  updateChannel,
} from '@/services/workosService';
import {
  WORK_THREAD_TYPE_OPTIONS,
  canContributeWorkRole,
  isWorkAdminRole,
  normalizeWorkOsError,
} from '@/utils/workos';
import WorkPageHeader from '@/components/workos/WorkPageHeader';
import WorkChannelList from '@/components/workos/WorkChannelList';
import WorkEmptyState from '@/components/workos/WorkEmptyState';
import WorkChannelModal from '@/components/workos/WorkChannelModal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import ArchiveWorkObjectDialog from '@/components/workos/ArchiveWorkObjectDialog';
import WorkThreadList from '@/components/workos/WorkThreadList';
import WorkThreadPanel from '@/components/workos/WorkThreadPanel';

const WorkChannelsScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [archiveBusyId, setArchiveBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [data, setData] = useState<WorkChannelsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [teamSpaceId, setTeamSpaceId] = useState(searchParams.get('teamSpace') || '');
  const [projectId, setProjectId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<WorkChannel | null>(null);
  const [archivingChannel, setArchivingChannel] = useState<WorkChannel | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState(searchParams.get('channel') || '');
  const [threads, setThreads] = useState<WorkThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState<WorkMessage[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [threadSubmitting, setThreadSubmitting] = useState(false);
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadType, setNewThreadType] = useState<WorkThreadType>('discussion');
  const hasFilters = Boolean(query.trim() || teamSpaceId || projectId);
  const teamSpacesCount = data?.team_spaces?.length ?? 0;

  const canContribute = canContributeWorkRole(user?.role);
  const canArchive = isWorkAdminRole(user?.role);

  const selectedChannel = useMemo(
    () => data?.channels.find((channel) => channel.id === selectedChannelId) ?? data?.channels[0] ?? null,
    [data?.channels, selectedChannelId]
  );
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [selectedThreadId, threads]
  );

  const reload = async (tenantId: string, nextQuery: string, nextTeamSpaceId: string, nextProjectId: string) => {
    setLoading(true);
    setError('');
    try {
      const nextData = await loadChannels(tenantId, {
        query: nextQuery,
        team_space_id: nextTeamSpaceId || undefined,
        project_id: nextProjectId || undefined,
      });
      setData(nextData);
      setSelectedChannelId((current) => {
        if (current && nextData.channels.some((channel) => channel.id === current)) return current;
        if (searchParams.get('channel') && nextData.channels.some((channel) => channel.id === searchParams.get('channel'))) {
          return searchParams.get('channel') || '';
        }
        return nextData.channels[0]?.id ?? '';
      });
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل القنوات.'));
    } finally {
      setLoading(false);
    }
  };

  const reloadThreads = async (tenantId: string, channelId: string) => {
    setThreadsLoading(true);
    try {
      const nextThreads = await loadChannelThreads(tenantId, channelId);
      setThreads(nextThreads);
      setSelectedThreadId((current) => (current && nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0]?.id ?? ''));
    } catch (loadError) {
      setError(normalizeWorkOsError(loadError, 'تعذر تحميل نقاشات القناة.'));
      setThreads([]);
      setSelectedThreadId('');
    } finally {
      setThreadsLoading(false);
    }
  };

  const reloadMessages = async (tenantId: string, threadId: string) => {
    setMessagesLoading(true);
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
    if (!user?.tenant_id) return;
    void reload(user.tenant_id, query, teamSpaceId, projectId);
  }, [projectId, query, teamSpaceId, user?.tenant_id]);

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

  const handleSave = async (value: WorkChannelFormInput) => {
    if (!user?.tenant_id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const saved = editingChannel
        ? await updateChannel(user.tenant_id, editingChannel.id, value)
        : await createChannel(user.tenant_id, value);
      setSuccess(editingChannel ? 'تم تحديث القناة بنجاح.' : 'تم إنشاء القناة بنجاح.');
      setModalOpen(false);
      setEditingChannel(null);
      await reload(user.tenant_id, query, teamSpaceId, projectId);
      setSelectedChannelId(saved.id);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر حفظ القناة.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (reason?: string) => {
    if (!user?.tenant_id || !archivingChannel) return;
    setArchiveBusyId(archivingChannel.id);
    setError('');
    setSuccess('');
    try {
      await archiveWorkObject('channel', archivingChannel.id, reason ?? 'Archived from WorkChannelsScreen');
      setSuccess('تمت أرشفة القناة بنجاح.');
      setArchivingChannel(null);
      await reload(user.tenant_id, query, teamSpaceId, projectId);
    } catch (archiveError) {
      setError(normalizeWorkOsError(archiveError, 'تعذر أرشفة القناة المطلوبة.'));
    } finally {
      setArchiveBusyId('');
    }
  };

  const handleCreateThread = async () => {
    if (!user?.tenant_id || !selectedChannel) return;
    setThreadSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const created = await createThread(user.tenant_id, {
        team_space_id: selectedChannel.team_space_id,
        project_id: selectedChannel.project_id,
        channel_id: selectedChannel.id,
        title: newThreadTitle.trim() || null,
        thread_type: newThreadType,
      });
      setSuccess('تم إنشاء النقاش الجديد بنجاح.');
      setNewThreadTitle('');
      await reloadThreads(user.tenant_id, selectedChannel.id);
      setSelectedThreadId(created.id);
      await reload(user.tenant_id, query, teamSpaceId, projectId);
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر إنشاء النقاش الجديد.'));
    } finally {
      setThreadSubmitting(false);
    }
  };

  const handleCreateMessage = async (body: string) => {
    if (!user?.tenant_id || !selectedThread) return;
    setMessageSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await createMessage(user.tenant_id, {
        thread_id: selectedThread.id,
        body,
      });
      setSuccess('تم إرسال الرسالة بنجاح.');
      await reloadMessages(user.tenant_id, selectedThread.id);
      if (selectedChannel) {
        await reloadThreads(user.tenant_id, selectedChannel.id);
      }
    } catch (saveError) {
      setError(normalizeWorkOsError(saveError, 'تعذر إرسال الرسالة.'));
    } finally {
      setMessageSubmitting(false);
    }
  };

  const initialValue = editingChannel
    ? {
        team_space_id: editingChannel.team_space_id,
        project_id: editingChannel.project_id ?? '',
        name: editingChannel.name,
        slug: editingChannel.slug ?? '',
        description: editingChannel.description ?? '',
        channel_type: editingChannel.channel_type,
        visibility: editingChannel.visibility,
      }
    : null;

  return (
    <div dir="rtl" className="space-y-6">
      <WorkPageHeader
        title="القنوات"
        subtitle="قنوات WorkOS الأساسية مع لوحة نقاشات خفيفة ورسائل بسيطة بدون realtime أو composer معقد."
        actions={
          canContribute && teamSpacesCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setEditingChannel(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <Plus size={16} />
              قناة جديدة
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
          السبب: لا توجد مساحات فريق مهيأة في WorkOS لهذا tenant/مساحة العمل بعد. لإنشاء قنوات، ابدأ من{' '}
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
              placeholder="ابحث باسم القناة"
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          {searchParams.get('channel') ? (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">
              وصلت إلى هذه الشاشة من مرجع داخلي لقناة محددة. يمكنك الآن فتحها من القائمة لعرض النقاشات الحالية.
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
              ))}
            </div>
          ) : data && data.channels.length ? (
            <WorkChannelList
              channels={data.channels}
              canManage={canContribute}
              busyId={archiveBusyId}
              onOpen={(channel) => setSelectedChannelId(channel.id)}
              onEdit={(channel) => {
                setEditingChannel(channel);
                setModalOpen(true);
              }}
              onArchive={canArchive ? (channel) => setArchivingChannel(channel) : undefined}
            />
          ) : (
            <WorkEmptyState
              title={
                teamSpacesCount === 0
                  ? 'لا توجد قنوات لأن مساحات الفرق غير موجودة'
                  : hasFilters
                    ? 'لا توجد قنوات مطابقة للفلاتر'
                    : 'لا توجد قنوات بعد'
              }
              description={
                teamSpacesCount === 0
                  ? 'لإنشاء قناة تحتاج على الأقل مساحة فريق واحدة. اذهب إلى مساحات الفرق ثم أنشئ مساحة وأعد المحاولة.'
                  : hasFilters
                    ? 'جرّب إزالة بعض الفلاتر أو البحث باسم قناة مختلف.'
                    : 'لا توجد قنوات داخلية مسجلة بعد. عند إضافة قناة ضمن مساحة أو مشروع ستظهر هنا مباشرة.'
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[#071C3B]">{selectedChannel ? `#${selectedChannel.name}` : 'لوحة النقاشات'}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedChannel?.description || 'عرض خفيف للنقاشات والرسائل الأخيرة داخل القناة المحددة.'}
                </p>
              </div>
            </div>

            {canContribute && selectedChannel ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="mb-2 block text-sm font-bold text-[#071C3B]">إنشاء نقاش جديد</label>
                <div className="grid gap-3">
                  <input
                    value={newThreadTitle}
                    onChange={(event) => setNewThreadTitle(event.target.value)}
                    placeholder="عنوان مختصر للنقاش"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                  <div className="flex flex-col gap-3 md:flex-row">
                    <select
                      value={newThreadType}
                      onChange={(event) => setNewThreadType(event.target.value as WorkThreadType)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      {WORK_THREAD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={threadSubmitting}
                      onClick={() => void handleCreateThread()}
                      className="rounded-2xl bg-[#071C3B] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0b2b59] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {threadSubmitting ? 'جارٍ الإنشاء...' : 'إضافة نقاش'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

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
            onCreateMessage={handleCreateMessage}
          />
        </div>
      </div>

      <WorkChannelModal
        open={modalOpen}
        mode={editingChannel ? 'edit' : 'create'}
        initialValue={initialValue}
        teamSpaces={data?.team_spaces ?? []}
        projects={data?.projects ?? []}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          setEditingChannel(null);
        }}
        onSubmit={handleSave}
      />

      <ArchiveWorkObjectDialog
        open={Boolean(archivingChannel)}
        objectType="channel"
        objectLabel={archivingChannel?.name || ''}
        submitting={Boolean(archiveBusyId)}
        onClose={() => {
          if (archiveBusyId) return;
          setArchivingChannel(null);
        }}
        onConfirm={handleArchive}
      />
    </div>
  );
};

export default WorkChannelsScreen;
