import { supabase } from '@/lib/supabase';
import type {
  WorkActivity,
  WorkChannel,
  WorkChannelFormInput,
  WorkChannelsResponse,
  WorkDoc,
  WorkDocBlock,
  WorkDocFormInput,
  WorkDocsResponse,
  WorkHomeData,
  WorkInboxData,
  WorkMessage,
  WorkMessageFormInput,
  WorkNotification,
  WorkObjectLinkInput,
  WorkObjectType,
  WorkProject,
  WorkProjectDetailData,
  WorkProjectFilters,
  WorkProjectFormInput,
  WorkProjectMember,
  WorkProjectsResponse,
  WorkRelation,
  WorkSearchData,
  WorkSearchResult,
  WorkTask,
  WorkTaskQuickUpdateInput,
  WorkTaskFormInput,
  WorkThread,
  WorkThreadFormInput,
  WorkTeamSpace,
  WorkTeamSpaceFormInput,
  WorkUserOption,
  WorkDocFilters,
  WorkChannelFilters,
  WorkSavedView,
  WorkSavedViewFilters,
  WorkSavedViewInput,
} from '@/types/workos';
import {
  buildWorkSearchHref,
  buildWorkSlug,
  getQuickWorkLinks,
  normalizeWorkOsError,
  toNullableDate,
  toNullableText,
  toNullableUuid,
} from '@/utils/workos';

const TEAM_SPACE_FIELDS =
  'id,tenant_id,slug,name,name_ar,description,icon,color,visibility,is_default,is_archived,created_at,updated_at';

const PROJECT_FIELDS =
  'id,tenant_id,team_space_id,name,name_ar,project_key,description,visibility,status,priority,owner_user_id,lead_user_id,start_date,due_date,completed_at,is_archived,created_at,updated_at';

const PROJECT_HOME_FIELDS =
  'id,tenant_id,team_space_id,name,name_ar,project_key,visibility,status,priority,owner_user_id,lead_user_id,start_date,due_date,completed_at,is_archived,created_at,updated_at,member_count,total_tasks,open_tasks,completed_tasks,doc_count,channel_count,thread_count,last_activity_at';

const TASK_FIELDS =
  'id,tenant_id,team_space_id,project_id,title,description,task_type,status,priority,source_object_type,source_object_id,assignee_user_id,reporter_user_id,start_at,due_at,completed_at,estimate_minutes,is_archived,created_at,updated_at';

const MY_WORK_FIELDS =
  'id,tenant_id,team_space_id,project_id,project_name,team_space_name,title,description,task_type,status,priority,assignee_user_id,reporter_user_id,start_at,due_at,completed_at,estimate_minutes,source_object_type,source_object_id,is_archived,created_at,updated_at,is_overdue';

const DOC_FIELDS =
  'id,tenant_id,team_space_id,project_id,title,slug,summary,doc_type,status,visibility,current_version,created_by,updated_by,last_edited_by,is_archived,created_at,updated_at';

const CHANNEL_FIELDS =
  'id,tenant_id,team_space_id,project_id,name,slug,description,channel_type,visibility,last_message_at,is_archived,created_at,updated_at';

const THREAD_FIELDS =
  'id,tenant_id,team_space_id,project_id,channel_id,title,thread_type,status,created_by,resolved_by,resolved_at,last_message_at,is_archived,created_at,updated_at';

const RELATION_FIELDS =
  'id,tenant_id,left_object_type,left_object_id,relation_type,right_object_type,right_object_id,metadata,created_by,created_at';

const ACTIVITY_FIELDS =
  'id,tenant_id,actor_user_id,actor_name,activity_type,object_type,object_id,parent_object_type,parent_object_id,summary,payload,created_at';

const NOTIFICATION_FIELDS =
  'id,tenant_id,user_id,activity_id,object_type,object_id,notification_type,title,body,payload,read_at,dismissed_at,created_at,updated_at';

const DOC_BLOCK_FIELDS =
  'id,tenant_id,doc_id,parent_block_id,block_type,sort_order,content,created_by,updated_by,created_at,updated_at';

const MESSAGE_FIELDS =
  'id,tenant_id,thread_id,author_user_id,reply_to_message_id,message_type,body,body_json,attachments,is_edited,edited_at,created_at,updated_at';

const SAVED_VIEW_FIELDS =
  'id,tenant_id,team_space_id,project_id,owner_user_id,name,view_type,scope_type,is_shared,is_default,filters,columns_config,sorts,grouping,metadata,is_archived,archived_at,archived_by,created_at,updated_at';

const MEMBER_FIELDS =
  'id,tenant_id,project_id,user_id,member_role,membership_status,invited_at,joined_at,removed_at,created_at,updated_at';

const USER_FIELDS = 'id,tenant_id,auth_id,full_name,email,is_active';

interface WorkActorContext {
  id: string;
  full_name: string;
  email?: string | null;
}

function ensureTenant(tenantId?: string | null) {
  if (!tenantId) {
    throw new Error('تعذر تحديد مساحة العمل الحالية لطبقة WorkOS.');
  }
}

function sanitizeSearchTerm(query: string) {
  return query.replace(/[%*,]/g, ' ').trim();
}

function handleSupabaseError(error: { message?: string } | null, fallback: string) {
  if (!error) return;
  throw new Error(normalizeWorkOsError(error, fallback));
}

async function resolveCurrentAuthUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const authUserId = session?.user?.id ?? null;
  if (!authUserId) {
    throw new Error('تعذر تحديد المستخدم الحالي داخل WorkOS. حدّث الصفحة ثم حاول مرة أخرى.');
  }

  return authUserId;
}

async function resolveCurrentWorkActor(tenantId: string, authUserId?: string | null): Promise<WorkActorContext> {
  const activeAuthUserId = authUserId || (await resolveCurrentAuthUserId());

  const { data, error } = await supabase
    .from('users')
    .select(USER_FIELDS)
    .eq('tenant_id', tenantId)
    .eq('auth_id', activeAuthUserId)
    .maybeSingle();

  handleSupabaseError(error, 'تعذر تحديد حساب الموظف الداخلي اللازم لإدارة WorkOS.');

  if (!data?.id) {
    throw new Error('لم يتم العثور على حساب داخلي مرتبط بالمستخدم الحالي داخل مساحة العمل.');
  }

  return {
    id: data.id as string,
    full_name: (data.full_name as string) || 'عضو الفريق',
    email: (data.email as string | null | undefined) ?? null,
  };
}

async function tryRecordWorkActivity(input: Parameters<typeof recordWorkActivity>[0]) {
  try {
    await recordWorkActivity(input);
  } catch {
    // Non-blocking for shell create/edit flows.
  }
}

async function loadUserMap(tenantId: string, userIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(userIds.filter((value): value is string => Boolean(value))));
  if (!ids.length) return new Map<string, string>();

  const { data, error } = await supabase
    .from('users')
    .select('id,full_name')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  handleSupabaseError(error, 'تعذر تحميل أسماء المستخدمين المرتبطة بعناصر WorkOS.');

  return new Map<string, string>((data ?? []).map((row) => [row.id as string, (row.full_name as string) || 'عضو الفريق']));
}

function mapCountByKey<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = row[key];
    if (typeof value === 'string' && value) {
      acc[value] = (acc[value] ?? 0) + 1;
    }
    return acc;
  }, {});
}

function mapTeamSpaceNames(spaces: WorkTeamSpace[]) {
  return new Map<string, WorkTeamSpace>(spaces.map((space) => [space.id, space]));
}

function mapProjectNames(projects: WorkProject[]) {
  return new Map<string, WorkProject>(projects.map((project) => [project.id, project]));
}

export async function loadWorkUsers(tenantId: string): Promise<WorkUserOption[]> {
  ensureTenant(tenantId);

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,full_name,email,is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    handleSupabaseError(error, 'تعذر تحميل أعضاء الفريق المتاحين داخل WorkOS.');

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      full_name: ((row.full_name as string) || 'عضو الفريق').trim(),
      email: (row.email as string | null | undefined) ?? null,
      is_active: Boolean(row.is_active),
    }));
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل قائمة المستخدمين داخل WorkOS.'));
  }
}

export async function loadTeamSpaces(tenantId: string): Promise<WorkTeamSpace[]> {
  ensureTenant(tenantId);

  try {
    const [{ data: spacesData, error: spacesError }, { data: projectsData, error: projectsError }, { data: docsData, error: docsError }, { data: channelsData, error: channelsError }] =
      await Promise.all([
        supabase
          .from('work_team_spaces')
          .select(TEAM_SPACE_FIELDS)
          .eq('tenant_id', tenantId)
          .eq('is_archived', false)
          .order('is_default', { ascending: false })
          .order('updated_at', { ascending: false }),
        supabase.from('work_projects').select('team_space_id').eq('tenant_id', tenantId).eq('is_archived', false),
        supabase.from('work_docs').select('team_space_id').eq('tenant_id', tenantId).eq('is_archived', false),
        supabase.from('work_channels').select('team_space_id').eq('tenant_id', tenantId).eq('is_archived', false),
      ]);

    handleSupabaseError(spacesError, 'تعذر تحميل مساحات الفرق.');
    handleSupabaseError(projectsError, 'تعذر تحميل عدادات المشاريع.');
    handleSupabaseError(docsError, 'تعذر تحميل عدادات المستندات.');
    handleSupabaseError(channelsError, 'تعذر تحميل عدادات القنوات.');

    const projectCounts = mapCountByKey((projectsData ?? []) as Array<Record<string, unknown>>, 'team_space_id');
    const docCounts = mapCountByKey((docsData ?? []) as Array<Record<string, unknown>>, 'team_space_id');
    const channelCounts = mapCountByKey((channelsData ?? []) as Array<Record<string, unknown>>, 'team_space_id');

    return ((spacesData ?? []) as WorkTeamSpace[]).map((space) => ({
      ...space,
      project_count: projectCounts[space.id] ?? 0,
      doc_count: docCounts[space.id] ?? 0,
      channel_count: channelCounts[space.id] ?? 0,
    }));
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل مساحات الفرق في WorkOS.'));
  }
}

export async function createTeamSpace(tenantId: string, input: WorkTeamSpaceFormInput): Promise<WorkTeamSpace> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const { data, error } = await supabase
      .from('work_team_spaces')
      .insert({
        tenant_id: tenantId,
        name: input.name.trim(),
        slug: buildWorkSlug(input.slug || input.name, 'space'),
        description: toNullableText(input.description),
        color: toNullableText(input.color) ?? '#00CFFF',
        visibility: input.visibility,
        is_default: Boolean(input.is_default),
        is_archived: input.is_active === false,
        created_by: actor.id,
      })
      .select(TEAM_SPACE_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إنشاء مساحة الفريق الجديدة.');

    await tryRecordWorkActivity({
      activity_type: 'team_space_created',
      object_type: 'team_space',
      object_id: data!.id as string,
      summary: `تم إنشاء مساحة فريق جديدة: ${input.name.trim()}`,
      payload: {
        visibility: input.visibility,
      },
    });

    return data as WorkTeamSpace;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء مساحة الفريق الآن.'));
  }
}

export async function updateTeamSpace(
  tenantId: string,
  teamSpaceId: string,
  input: WorkTeamSpaceFormInput
): Promise<WorkTeamSpace> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const isArchived = input.is_active === false;
    const { data, error } = await supabase
      .from('work_team_spaces')
      .update({
        name: input.name.trim(),
        slug: buildWorkSlug(input.slug || input.name, 'space'),
        description: toNullableText(input.description),
        color: toNullableText(input.color) ?? '#00CFFF',
        visibility: input.visibility,
        is_default: Boolean(input.is_default),
        is_archived: isArchived,
        archived_at: isArchived ? new Date().toISOString() : null,
        archived_by: isArchived ? actor.id : null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', teamSpaceId)
      .select(TEAM_SPACE_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر تحديث مساحة الفريق.');

    await tryRecordWorkActivity({
      activity_type: 'team_space_updated',
      object_type: 'team_space',
      object_id: teamSpaceId,
      summary: `تم تحديث مساحة الفريق: ${input.name.trim()}`,
      payload: {
        visibility: input.visibility,
        is_archived: isArchived,
      },
    });

    return data as WorkTeamSpace;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحديث مساحة الفريق الآن.'));
  }
}

export async function createProject(tenantId: string, input: WorkProjectFormInput): Promise<WorkProject> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const ownerUserId = toNullableUuid(input.owner_user_id) ?? actor.id;
    const isCompleted = input.status === 'completed';
    const { data, error } = await supabase
      .from('work_projects')
      .insert({
        tenant_id: tenantId,
        team_space_id: input.team_space_id,
        name: input.name.trim(),
        description: toNullableText(input.description),
        visibility: input.visibility ?? 'internal',
        status: input.status,
        priority: input.priority,
        owner_user_id: ownerUserId,
        lead_user_id: toNullableUuid(input.lead_user_id),
        start_date: toNullableDate(input.start_date),
        due_date: toNullableDate(input.due_date),
        completed_at: isCompleted ? new Date().toISOString() : null,
        created_by: actor.id,
      })
      .select(PROJECT_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إنشاء المشروع الجديد.');

    await tryRecordWorkActivity({
      activity_type: 'project_created',
      object_type: 'project',
      object_id: data!.id as string,
      parent_object_type: 'team_space',
      parent_object_id: input.team_space_id,
      summary: `تم إنشاء مشروع جديد: ${input.name.trim()}`,
      payload: {
        priority: input.priority,
        status: input.status,
      },
    });

    return data as WorkProject;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء المشروع الآن.'));
  }
}

export async function updateProject(
  tenantId: string,
  projectId: string,
  input: WorkProjectFormInput
): Promise<WorkProject> {
  ensureTenant(tenantId);

  try {
    const isCompleted = input.status === 'completed';
    const { data, error } = await supabase
      .from('work_projects')
      .update({
        team_space_id: input.team_space_id,
        name: input.name.trim(),
        description: toNullableText(input.description),
        visibility: input.visibility ?? 'internal',
        status: input.status,
        priority: input.priority,
        owner_user_id: toNullableUuid(input.owner_user_id),
        lead_user_id: toNullableUuid(input.lead_user_id),
        start_date: toNullableDate(input.start_date),
        due_date: toNullableDate(input.due_date),
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .select(PROJECT_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر تحديث بيانات المشروع.');

    await tryRecordWorkActivity({
      activity_type: 'project_updated',
      object_type: 'project',
      object_id: projectId,
      parent_object_type: 'team_space',
      parent_object_id: input.team_space_id,
      summary: `تم تحديث المشروع: ${input.name.trim()}`,
      payload: {
        priority: input.priority,
        status: input.status,
      },
    });

    return data as WorkProject;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحديث المشروع الآن.'));
  }
}

export async function createDoc(tenantId: string, input: WorkDocFormInput): Promise<WorkDoc> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const { data, error } = await supabase
      .from('work_docs')
      .insert({
        tenant_id: tenantId,
        team_space_id: input.team_space_id,
        project_id: toNullableUuid(input.project_id),
        title: input.title.trim(),
        slug: buildWorkSlug(input.slug || input.title, 'doc'),
        summary: toNullableText(input.summary),
        doc_type: input.doc_type,
        status: input.status,
        visibility: input.visibility,
        created_by: actor.id,
        updated_by: actor.id,
        last_edited_by: actor.id,
      })
      .select(DOC_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إنشاء المستند الجديد.');

    const firstBlockText = toNullableText(input.initial_block_text) ?? toNullableText(input.summary) ?? '';
    const { error: blockError } = await supabase.from('work_doc_blocks').insert({
      tenant_id: tenantId,
      doc_id: data!.id,
      block_type: 'paragraph',
      sort_order: 0,
      content: { text: firstBlockText },
      created_by: actor.id,
      updated_by: actor.id,
    });

    if (blockError) {
      console.warn('work_doc_blocks init failed:', blockError.message);
    }

    await tryRecordWorkActivity({
      activity_type: 'doc_created',
      object_type: 'doc',
      object_id: data!.id as string,
      parent_object_type: input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.project_id || input.team_space_id) as string,
      summary: `تم إنشاء مستند جديد: ${input.title.trim()}`,
      payload: {
        doc_type: input.doc_type,
      },
    });

    return data as WorkDoc;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء المستند الآن.'));
  }
}

export async function updateDoc(tenantId: string, docId: string, input: WorkDocFormInput): Promise<WorkDoc> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const { data, error } = await supabase
      .from('work_docs')
      .update({
        team_space_id: input.team_space_id,
        project_id: toNullableUuid(input.project_id),
        title: input.title.trim(),
        slug: buildWorkSlug(input.slug || input.title, 'doc'),
        summary: toNullableText(input.summary),
        doc_type: input.doc_type,
        status: input.status,
        visibility: input.visibility,
        updated_by: actor.id,
        last_edited_by: actor.id,
      })
      .eq('tenant_id', tenantId)
      .eq('id', docId)
      .select(DOC_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر تحديث بيانات المستند.');

    await tryRecordWorkActivity({
      activity_type: 'doc_updated',
      object_type: 'doc',
      object_id: docId,
      parent_object_type: input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.project_id || input.team_space_id) as string,
      summary: `تم تحديث المستند: ${input.title.trim()}`,
      payload: {
        doc_type: input.doc_type,
        status: input.status,
      },
    });

    return data as WorkDoc;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحديث المستند الآن.'));
  }
}

export async function createChannel(tenantId: string, input: WorkChannelFormInput): Promise<WorkChannel> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const { data, error } = await supabase
      .from('work_channels')
      .insert({
        tenant_id: tenantId,
        team_space_id: input.team_space_id,
        project_id: toNullableUuid(input.project_id),
        name: input.name.trim(),
        slug: buildWorkSlug(input.slug || input.name, 'channel'),
        description: toNullableText(input.description),
        channel_type: input.channel_type,
        visibility: input.visibility,
        created_by: actor.id,
      })
      .select(CHANNEL_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إنشاء القناة الجديدة.');

    await tryRecordWorkActivity({
      activity_type: 'channel_created',
      object_type: 'channel',
      object_id: data!.id as string,
      parent_object_type: input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.project_id || input.team_space_id) as string,
      summary: `تم إنشاء قناة جديدة: ${input.name.trim()}`,
      payload: {
        channel_type: input.channel_type,
      },
    });

    return data as WorkChannel;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء القناة الآن.'));
  }
}

export async function updateChannel(
  tenantId: string,
  channelId: string,
  input: WorkChannelFormInput
): Promise<WorkChannel> {
  ensureTenant(tenantId);

  try {
    const { data, error } = await supabase
      .from('work_channels')
      .update({
        team_space_id: input.team_space_id,
        project_id: toNullableUuid(input.project_id),
        name: input.name.trim(),
        slug: buildWorkSlug(input.slug || input.name, 'channel'),
        description: toNullableText(input.description),
        channel_type: input.channel_type,
        visibility: input.visibility,
      })
      .eq('tenant_id', tenantId)
      .eq('id', channelId)
      .select(CHANNEL_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر تحديث بيانات القناة.');

    await tryRecordWorkActivity({
      activity_type: 'channel_updated',
      object_type: 'channel',
      object_id: channelId,
      parent_object_type: input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.project_id || input.team_space_id) as string,
      summary: `تم تحديث القناة: ${input.name.trim()}`,
      payload: {
        channel_type: input.channel_type,
      },
    });

    return data as WorkChannel;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحديث القناة الآن.'));
  }
}

export async function createTask(tenantId: string, input: WorkTaskFormInput): Promise<WorkTask> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const isDone = input.status === 'done';
    const { data, error } = await supabase
      .from('work_tasks')
      .insert({
        tenant_id: tenantId,
        team_space_id: input.team_space_id,
        project_id: toNullableUuid(input.project_id),
        title: input.title.trim(),
        description: toNullableText(input.description),
        task_type: input.task_type,
        status: input.status,
        priority: input.priority,
        assignee_user_id: toNullableUuid(input.assignee_user_id),
        reporter_user_id: actor.id,
        created_by: actor.id,
        due_at: toNullableDate(input.due_at),
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .select(TASK_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إنشاء المهمة الجديدة.');

    await tryRecordWorkActivity({
      activity_type: 'task_created',
      object_type: 'task',
      object_id: data!.id as string,
      parent_object_type: input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.project_id || input.team_space_id) as string,
      summary: `تم إنشاء مهمة جديدة: ${input.title.trim()}`,
      payload: {
        status: input.status,
        priority: input.priority,
      },
    });

    return data as WorkTask;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء المهمة الآن.'));
  }
}

export async function updateTask(tenantId: string, taskId: string, input: WorkTaskFormInput): Promise<WorkTask> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const isDone = input.status === 'done';
    const { data, error } = await supabase
      .from('work_tasks')
      .update({
        team_space_id: input.team_space_id,
        project_id: toNullableUuid(input.project_id),
        title: input.title.trim(),
        description: toNullableText(input.description),
        task_type: input.task_type,
        status: input.status,
        priority: input.priority,
        assignee_user_id: toNullableUuid(input.assignee_user_id),
        due_at: toNullableDate(input.due_at),
        completed_at: isDone ? new Date().toISOString() : null,
        completed_by: isDone ? actor.id : null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', taskId)
      .select(TASK_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر تحديث المهمة الحالية.');

    await tryRecordWorkActivity({
      activity_type: 'task_updated',
      object_type: 'task',
      object_id: taskId,
      parent_object_type: input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.project_id || input.team_space_id) as string,
      summary: `تم تحديث المهمة: ${input.title.trim()}`,
      payload: {
        status: input.status,
        priority: input.priority,
      },
    });

    return data as WorkTask;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحديث المهمة الآن.'));
  }
}

export async function updateWorkTaskQuickFields(
  tenantId: string,
  taskId: string,
  input: WorkTaskQuickUpdateInput
): Promise<WorkTask> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const payload: Record<string, unknown> = {};

    if (input.status) {
      payload.status = input.status;
      payload.completed_at = input.status === 'done' ? new Date().toISOString() : null;
      payload.completed_by = input.status === 'done' ? actor.id : null;
    }

    if (input.priority) {
      payload.priority = input.priority;
    }

    const { data, error } = await supabase
      .from('work_tasks')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', taskId)
      .select(TASK_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر تحديث المهمة بسرعة.');

    await tryRecordWorkActivity({
      activity_type: 'task_quick_updated',
      object_type: 'task',
      object_id: taskId,
      summary: `تم تحديث المهمة بسرعة: ${(data?.title as string) || 'مهمة'}`,
      payload: {
        status: input.status ?? null,
        priority: input.priority ?? null,
      },
    });

    return data as WorkTask;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تنفيذ التحديث السريع للمهمة.'));
  }
}

export async function loadDocBlocks(tenantId: string, docId: string): Promise<WorkDocBlock[]> {
  ensureTenant(tenantId);

  try {
    const { data, error } = await supabase
      .from('work_doc_blocks')
      .select(DOC_BLOCK_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('doc_id', docId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    handleSupabaseError(error, 'تعذر تحميل كتل المستند.');
    return (data ?? []) as WorkDocBlock[];
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل محتوى المستند الآن.'));
  }
}

export async function addDocBlock(
  tenantId: string,
  docId: string,
  text: string,
  blockType: WorkDocBlock['block_type'] = 'paragraph'
): Promise<WorkDocBlock> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const existingBlocks = await loadDocBlocks(tenantId, docId);
    const nextSortOrder = existingBlocks.length ? Math.max(...existingBlocks.map((block) => block.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from('work_doc_blocks')
      .insert({
        tenant_id: tenantId,
        doc_id: docId,
        block_type: blockType,
        sort_order: nextSortOrder,
        content: { text: text.trim() },
        created_by: actor.id,
        updated_by: actor.id,
      })
      .select(DOC_BLOCK_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إضافة كتلة جديدة إلى المستند.');

    await tryRecordWorkActivity({
      activity_type: 'doc_block_added',
      object_type: 'doc',
      object_id: docId,
      summary: 'تمت إضافة كتلة جديدة إلى المستند',
      payload: {
        block_type: blockType,
      },
    });

    return data as WorkDocBlock;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إضافة كتلة المستند الآن.'));
  }
}

export async function loadChannelThreads(tenantId: string, channelId: string): Promise<WorkThread[]> {
  ensureTenant(tenantId);

  try {
    const [{ data: threadRows, error: threadError }, teamSpaces, projectResponse] = await Promise.all([
      supabase
        .from('work_threads')
        .select(THREAD_FIELDS)
        .eq('tenant_id', tenantId)
        .eq('channel_id', channelId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false }),
      loadTeamSpaces(tenantId),
      loadProjects(tenantId),
    ]);

    handleSupabaseError(threadError, 'تعذر تحميل النقاشات المرتبطة بالقناة.');

    const threads = (threadRows ?? []) as WorkThread[];
    const threadIds = threads.map((thread) => thread.id);
    const { data: messageRows, error: messageError } = threadIds.length
      ? await supabase.from('work_messages').select(MESSAGE_FIELDS).eq('tenant_id', tenantId).in('thread_id', threadIds)
      : { data: [], error: null };

    handleSupabaseError(messageError, 'تعذر تحميل الرسائل المرتبطة بالنقاشات.');
    const threadIdSet = new Set(threads.map((thread) => thread.id));
    const messages = ((messageRows ?? []) as WorkMessage[]).filter((message) => threadIdSet.has(message.thread_id));
    const userMap = await loadUserMap(
      tenantId,
      threads.map((thread) => thread.created_by)
    );
    const teamSpaceMap = mapTeamSpaceNames(teamSpaces);
    const projectMap = mapProjectNames(projectResponse.projects);
    const messageCountMap = messages.reduce<Record<string, number>>((acc, message) => {
      acc[message.thread_id] = (acc[message.thread_id] ?? 0) + 1;
      return acc;
    }, {});
    const latestMessageMap = new Map<string, string>();

    for (const message of messages) {
      if (!latestMessageMap.has(message.thread_id) && message.body) {
        latestMessageMap.set(message.thread_id, message.body);
      }
    }

    return threads.map((thread) => ({
      ...thread,
      channel_name: null,
      project_name: thread.project_id ? projectMap.get(thread.project_id)?.name ?? null : null,
      team_space_name: teamSpaceMap.get(thread.team_space_id)?.name ?? null,
      created_by_name: thread.created_by ? userMap.get(thread.created_by) ?? null : null,
      message_count: messageCountMap[thread.id] ?? 0,
      latest_message_preview: latestMessageMap.get(thread.id) ?? null,
    }));
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل لوحة النقاشات للقناة.'));
  }
}

export async function loadThreadMessages(tenantId: string, threadId: string): Promise<WorkMessage[]> {
  ensureTenant(tenantId);

  try {
    const { data, error } = await supabase
      .from('work_messages')
      .select(MESSAGE_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    handleSupabaseError(error, 'تعذر تحميل رسائل النقاش.');

    const messages = (data ?? []) as WorkMessage[];
    const userMap = await loadUserMap(tenantId, messages.map((message) => message.author_user_id));
    return messages.map((message) => ({
      ...message,
      author_name: message.author_user_id ? userMap.get(message.author_user_id) ?? null : null,
    }));
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل الرسائل الحالية.'));
  }
}

export async function createThread(tenantId: string, input: WorkThreadFormInput): Promise<WorkThread> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const { data, error } = await supabase
      .from('work_threads')
      .insert({
        tenant_id: tenantId,
        team_space_id: toNullableUuid(input.team_space_id),
        project_id: toNullableUuid(input.project_id),
        channel_id: toNullableUuid(input.channel_id),
        title: toNullableText(input.title),
        thread_type: input.thread_type,
        status: 'open',
        created_by: actor.id,
      })
      .select(THREAD_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إنشاء النقاش الجديد.');

    await tryRecordWorkActivity({
      activity_type: 'thread_created',
      object_type: 'thread',
      object_id: data!.id as string,
      parent_object_type: input.channel_id ? 'channel' : input.project_id ? 'project' : 'team_space',
      parent_object_id: (input.channel_id || input.project_id || input.team_space_id) ?? null,
      summary: `تم إنشاء نقاش جديد${input.title ? `: ${input.title.trim()}` : ''}`,
      payload: {
        thread_type: input.thread_type,
      },
    });

    return data as WorkThread;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء النقاش الآن.'));
  }
}

export async function createMessage(tenantId: string, input: WorkMessageFormInput): Promise<WorkMessage> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);

    const { data: threadRow, error: threadError } = await supabase
      .from('work_threads')
      .select(THREAD_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('id', input.thread_id)
      .maybeSingle();

    handleSupabaseError(threadError, 'تعذر التحقق من النقاش الحالي.');

    if (!threadRow?.id) {
      throw new Error('النقاش المطلوب غير متاح أو لم يعد موجودًا.');
    }

    const { data, error } = await supabase
      .from('work_messages')
      .insert({
        tenant_id: tenantId,
        thread_id: input.thread_id,
        author_user_id: actor.id,
        body: input.body.trim(),
        reply_to_message_id: toNullableUuid(input.reply_to_message_id),
        message_type: input.message_type ?? 'comment',
      })
      .select(MESSAGE_FIELDS)
      .single();

    handleSupabaseError(error, 'تعذر إرسال الرسالة داخل النقاش.');

    const nowIso = new Date().toISOString();
    await supabase
      .from('work_threads')
      .update({ last_message_at: nowIso })
      .eq('tenant_id', tenantId)
      .eq('id', input.thread_id);

    if ((threadRow as WorkThread).channel_id) {
      await supabase
        .from('work_channels')
        .update({ last_message_at: nowIso })
        .eq('tenant_id', tenantId)
        .eq('id', (threadRow as WorkThread).channel_id as string);
    }

    await tryRecordWorkActivity({
      activity_type: 'message_created',
      object_type: 'message',
      object_id: data!.id as string,
      parent_object_type: 'thread',
      parent_object_id: input.thread_id,
      summary: 'تمت إضافة رسالة جديدة داخل النقاش',
      payload: {
        thread_id: input.thread_id,
      },
    });

    return {
      ...(data as WorkMessage),
      author_name: actor.full_name,
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إرسال الرسالة الآن.'));
  }
}

export async function linkWorkObjects(input: WorkObjectLinkInput) {
  try {
    const { data, error } = await supabase.rpc('work_link_objects', {
      p_left_object_type: input.left_object_type,
      p_left_object_id: input.left_object_id,
      p_relation_type: input.relation_type,
      p_right_object_type: input.right_object_type,
      p_right_object_id: input.right_object_id,
      p_metadata: input.metadata ?? {},
    });

    handleSupabaseError(error, 'تعذر ربط العناصر داخل WorkOS.');
    return data;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر إنشاء الربط المطلوب الآن.'));
  }
}

export async function loadProjects(tenantId: string, filters: WorkProjectFilters = {}): Promise<WorkProjectsResponse> {
  ensureTenant(tenantId);

  try {
    const teamSpacesPromise = loadTeamSpaces(tenantId);
    let projectsQuery = supabase
      .from('work_project_home_v')
      .select(PROJECT_HOME_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('is_archived', false);

    if (filters.status && filters.status !== 'all') {
      projectsQuery = projectsQuery.eq('status', filters.status);
    }

    if (filters.team_space_id) {
      projectsQuery = projectsQuery.eq('team_space_id', filters.team_space_id);
    }

    const safeQuery = sanitizeSearchTerm(filters.query ?? '');
    if (safeQuery) {
      projectsQuery = projectsQuery.ilike('name', `%${safeQuery}%`);
    }

    const [{ data: projectRows, error: projectError }, { data: descriptions, error: descriptionsError }, teamSpaces] =
      await Promise.all([
        projectsQuery.order('updated_at', { ascending: false }),
        supabase.from('work_projects').select('id,description').eq('tenant_id', tenantId).eq('is_archived', false),
        teamSpacesPromise,
      ]);

    handleSupabaseError(projectError, 'تعذر تحميل المشاريع.');
    handleSupabaseError(descriptionsError, 'تعذر تحميل تفاصيل المشاريع.');

    const descriptionMap = new Map<string, string | null>((descriptions ?? []).map((row) => [row.id as string, (row.description as string | null) ?? null]));
    const teamSpaceMap = mapTeamSpaceNames(teamSpaces);

    const userIds = ((projectRows ?? []) as WorkProject[]).flatMap((project) => [project.owner_user_id, project.lead_user_id]);
    const userMap = await loadUserMap(tenantId, userIds);

    const projects = ((projectRows ?? []) as WorkProject[]).map((project) => {
      const teamSpace = teamSpaceMap.get(project.team_space_id);
      return {
        ...project,
        description: descriptionMap.get(project.id) ?? null,
        team_space_name: teamSpace?.name ?? null,
        team_space_name_ar: teamSpace?.name_ar ?? null,
        owner_name: project.owner_user_id ? userMap.get(project.owner_user_id) ?? null : null,
        lead_name: project.lead_user_id ? userMap.get(project.lead_user_id) ?? null : null,
      };
    });

    return {
      projects,
      team_spaces: teamSpaces,
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل مشاريع WorkOS.'));
  }
}

export async function loadDocs(tenantId: string, filters: WorkDocFilters = {}): Promise<WorkDocsResponse> {
  ensureTenant(tenantId);

  try {
    const [teamSpaces, projectResponse, savedViews] = await Promise.all([
      loadTeamSpaces(tenantId),
      loadProjects(tenantId),
      loadSavedViews(tenantId, {
        view_type: 'doc',
        team_space_id: filters.team_space_id,
        project_id: filters.project_id,
      }),
    ]);
    const projectMap = mapProjectNames(projectResponse.projects);
    const teamSpaceMap = mapTeamSpaceNames(teamSpaces);

    let docsQuery = supabase
      .from('work_docs')
      .select(DOC_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('is_archived', false);

    if (filters.project_id) {
      docsQuery = docsQuery.eq('project_id', filters.project_id);
    }

    if (filters.team_space_id) {
      docsQuery = docsQuery.eq('team_space_id', filters.team_space_id);
    }

    const safeQuery = sanitizeSearchTerm(filters.query ?? '');
    if (safeQuery) {
      docsQuery = docsQuery.ilike('title', `%${safeQuery}%`);
    }

    const { data: docsData, error: docsError } = await docsQuery.order('updated_at', { ascending: false });
    handleSupabaseError(docsError, 'تعذر تحميل مستندات WorkOS.');

    const docIds = ((docsData ?? []) as WorkDoc[]).map((doc) => doc.id);
    const { data: blocksData, error: blocksError } = docIds.length
      ? await supabase.from('work_doc_blocks').select('doc_id').eq('tenant_id', tenantId).in('doc_id', docIds)
      : { data: [], error: null };

    handleSupabaseError(blocksError, 'تعذر تحميل مؤشرات كتل المستندات.');

    const blockCountMap = mapCountByKey((blocksData ?? []) as Array<Record<string, unknown>>, 'doc_id');

    const docs = ((docsData ?? []) as WorkDoc[]).map((doc) => ({
      ...doc,
      project_name: doc.project_id ? projectMap.get(doc.project_id)?.name ?? null : null,
      team_space_name: teamSpaceMap.get(doc.team_space_id)?.name ?? null,
      block_count: blockCountMap[doc.id] ?? 0,
    }));

    return {
      docs,
      team_spaces: teamSpaces,
      projects: projectResponse.projects,
      saved_views: savedViews,
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل قائمة المستندات.'));
  }
}

export async function loadChannels(tenantId: string, filters: WorkChannelFilters = {}): Promise<WorkChannelsResponse> {
  ensureTenant(tenantId);

  try {
    const [teamSpaces, projectResponse] = await Promise.all([loadTeamSpaces(tenantId), loadProjects(tenantId)]);
    const projectMap = mapProjectNames(projectResponse.projects);
    const teamSpaceMap = mapTeamSpaceNames(teamSpaces);

    let channelsQuery = supabase
      .from('work_channels')
      .select(CHANNEL_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('is_archived', false);

    if (filters.project_id) {
      channelsQuery = channelsQuery.eq('project_id', filters.project_id);
    }

    if (filters.team_space_id) {
      channelsQuery = channelsQuery.eq('team_space_id', filters.team_space_id);
    }

    const safeQuery = sanitizeSearchTerm(filters.query ?? '');
    if (safeQuery) {
      channelsQuery = channelsQuery.ilike('name', `%${safeQuery}%`);
    }

    const { data: channelsData, error: channelsError } = await channelsQuery.order('updated_at', { ascending: false });
    handleSupabaseError(channelsError, 'تعذر تحميل القنوات.');

    const channelIds = ((channelsData ?? []) as WorkChannel[]).map((channel) => channel.id);
    const { data: threadsData, error: threadsError } = channelIds.length
      ? await supabase.from('work_threads').select('channel_id').eq('tenant_id', tenantId).eq('is_archived', false).in('channel_id', channelIds)
      : { data: [], error: null };

    handleSupabaseError(threadsError, 'تعذر تحميل إحصاءات النقاشات.');

    const threadCountMap = mapCountByKey((threadsData ?? []) as Array<Record<string, unknown>>, 'channel_id');

    const channels = ((channelsData ?? []) as WorkChannel[]).map((channel) => ({
      ...channel,
      project_name: channel.project_id ? projectMap.get(channel.project_id)?.name ?? null : null,
      team_space_name: teamSpaceMap.get(channel.team_space_id)?.name ?? null,
      thread_count: threadCountMap[channel.id] ?? 0,
    }));

    return {
      channels,
      team_spaces: teamSpaces,
      projects: projectResponse.projects,
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل القنوات في WorkOS.'));
  }
}

export async function loadWorkHome(tenantId: string, authUserId?: string): Promise<WorkHomeData> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId, authUserId);
    const [
      { data: myWorkData, error: myWorkError },
      { data: recentActivityData, error: recentActivityError },
      { data: teamSpacesData, error: teamSpacesError },
      { data: projectCountsData, error: projectCountsError },
      { data: docsData, error: docsError },
      { data: channelsData, error: channelsError },
      { data: inboxData, error: inboxError },
    ] = await Promise.all([
      supabase.from('work_my_work_v').select(MY_WORK_FIELDS).eq('tenant_id', tenantId).eq('is_archived', false).order('updated_at', { ascending: false }).limit(8),
      supabase.from('work_recent_activity_v').select(ACTIVITY_FIELDS).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
      supabase.from('work_team_spaces').select('id').eq('tenant_id', tenantId).eq('is_archived', false),
      supabase.from('work_project_home_v').select('id,open_tasks').eq('tenant_id', tenantId).eq('is_archived', false),
      supabase.from('work_docs').select('id').eq('tenant_id', tenantId).eq('is_archived', false),
      supabase.from('work_channels').select('id').eq('tenant_id', tenantId).eq('is_archived', false),
      supabase.from('work_notifications').select('id,read_at').eq('tenant_id', tenantId).eq('user_id', actor.id),
    ]);

    handleSupabaseError(myWorkError, 'تعذر تحميل عناصر عملي.');
    handleSupabaseError(recentActivityError, 'تعذر تحميل النشاط الأخير.');
    handleSupabaseError(teamSpacesError, 'تعذر تحميل عداد المساحات.');
    handleSupabaseError(projectCountsError, 'تعذر تحميل عداد المشاريع.');
    handleSupabaseError(docsError, 'تعذر تحميل عداد المستندات.');
    handleSupabaseError(channelsError, 'تعذر تحميل عداد القنوات.');
    handleSupabaseError(inboxError, 'تعذر تحميل البريد الداخلي.');

    const myWork = (myWorkData ?? []) as WorkTask[];
    const recentActivity = (recentActivityData ?? []) as WorkActivity[];
    const unreadCount = ((inboxData ?? []) as Array<{ read_at: string | null }>).filter((entry) => !entry.read_at).length;

    return {
      summary: {
        team_space_count: (teamSpacesData ?? []).length,
        project_count: (projectCountsData ?? []).length,
        open_task_count: ((projectCountsData ?? []) as Array<{ open_tasks?: number | null }>).reduce(
          (sum, row) => sum + Number(row.open_tasks ?? 0),
          0
        ),
        doc_count: (docsData ?? []).length,
        channel_count: (channelsData ?? []).length,
        unread_notification_count: unreadCount,
      },
      my_work: myWork,
      recent_activity: recentActivity,
      quick_links: getQuickWorkLinks(),
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل الصفحة الرئيسية لقطاع WorkOS.'));
  }
}

export async function loadProjectDetails(tenantId: string, projectId: string): Promise<WorkProjectDetailData> {
  ensureTenant(tenantId);

  try {
    const [
      { data: projectHomeData, error: projectHomeError },
      { data: projectRowData, error: projectRowError },
      { data: memberRows, error: memberError },
      { data: taskRows, error: taskError },
      { data: docRows, error: docError },
      { data: channelRows, error: channelError },
      { data: activityRows, error: activityError },
      { data: relationRows, error: relationError },
    ] = await Promise.all([
      supabase.from('work_project_home_v').select(PROJECT_HOME_FIELDS).eq('tenant_id', tenantId).eq('id', projectId).maybeSingle(),
      supabase.from('work_projects').select(PROJECT_FIELDS).eq('tenant_id', tenantId).eq('id', projectId).maybeSingle(),
      supabase.from('work_project_members').select(MEMBER_FIELDS).eq('tenant_id', tenantId).eq('project_id', projectId).order('joined_at', { ascending: false }),
      supabase.from('work_tasks').select(TASK_FIELDS).eq('tenant_id', tenantId).eq('project_id', projectId).eq('is_archived', false).order('updated_at', { ascending: false }),
      supabase.from('work_docs').select(DOC_FIELDS).eq('tenant_id', tenantId).eq('project_id', projectId).eq('is_archived', false).order('updated_at', { ascending: false }),
      supabase.from('work_channels').select(CHANNEL_FIELDS).eq('tenant_id', tenantId).eq('project_id', projectId).eq('is_archived', false).order('updated_at', { ascending: false }),
      supabase
        .from('work_recent_activity_v')
        .select(ACTIVITY_FIELDS)
        .eq('tenant_id', tenantId)
        .or(`and(object_type.eq.project,object_id.eq.${projectId}),and(parent_object_type.eq.project,parent_object_id.eq.${projectId})`)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('work_object_relations')
        .select(RELATION_FIELDS)
        .eq('tenant_id', tenantId)
        .or(`and(left_object_type.eq.project,left_object_id.eq.${projectId}),and(right_object_type.eq.project,right_object_id.eq.${projectId})`)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    handleSupabaseError(projectHomeError, 'تعذر تحميل ملخص المشروع.');
    handleSupabaseError(projectRowError, 'تعذر تحميل بيانات المشروع.');
    handleSupabaseError(memberError, 'تعذر تحميل أعضاء المشروع.');
    handleSupabaseError(taskError, 'تعذر تحميل مهام المشروع.');
    handleSupabaseError(docError, 'تعذر تحميل مستندات المشروع.');
    handleSupabaseError(channelError, 'تعذر تحميل قنوات المشروع.');
    handleSupabaseError(activityError, 'تعذر تحميل نشاط المشروع.');
    handleSupabaseError(relationError, 'تعذر تحميل العلاقات المرتبطة بالمشروع.');

    if (!projectHomeData || !projectRowData) {
      throw new Error('المشروع المطلوب غير موجود أو لم يعد متاحًا ضمن مساحة العمل الحالية.');
    }

    const projectBase = projectHomeData as WorkProject;
    const projectRow = projectRowData as WorkProject;

    const userIds = [
      projectBase.owner_user_id,
      projectBase.lead_user_id,
      ...((taskRows ?? []) as WorkTask[]).flatMap((task) => [task.assignee_user_id, task.reporter_user_id]),
      ...((memberRows ?? []) as WorkProjectMember[]).map((member) => member.user_id),
    ];
    const userMap = await loadUserMap(tenantId, userIds);
    const teamSpaces = await loadTeamSpaces(tenantId);
    const teamSpaceMap = mapTeamSpaceNames(teamSpaces);

    const threadResult = (channelRows ?? []).length
      ? await supabase
          .from('work_threads')
          .select(THREAD_FIELDS)
          .eq('tenant_id', tenantId)
          .eq('is_archived', false)
          .in('channel_id', ((channelRows ?? []) as WorkChannel[]).map((channel) => channel.id))
      : { data: [], error: null };

    const blockResult = (docRows ?? []).length
      ? await supabase
          .from('work_doc_blocks')
          .select('doc_id')
          .eq('tenant_id', tenantId)
          .in('doc_id', ((docRows ?? []) as WorkDoc[]).map((doc) => doc.id))
      : { data: [], error: null };

    handleSupabaseError(threadResult.error, 'تعذر تحميل عدادات النقاشات المرتبطة بقنوات المشروع.');
    handleSupabaseError(blockResult.error, 'تعذر تحميل عدادات كتل المستندات المرتبطة بالمشروع.');

    const threadRows = threadResult.data ?? [];
    const blockRows = blockResult.data ?? [];

    const threadCountMap = mapCountByKey(threadRows as Array<Record<string, unknown>>, 'channel_id');
    const blockCountMap = mapCountByKey(blockRows as Array<Record<string, unknown>>, 'doc_id');

    const project: WorkProject = {
      ...projectBase,
      description: projectRow.description,
      owner_name: projectBase.owner_user_id ? userMap.get(projectBase.owner_user_id) ?? null : null,
      lead_name: projectBase.lead_user_id ? userMap.get(projectBase.lead_user_id) ?? null : null,
      team_space_name: teamSpaceMap.get(projectBase.team_space_id)?.name ?? null,
      team_space_name_ar: teamSpaceMap.get(projectBase.team_space_id)?.name_ar ?? null,
    };

    const tasks = ((taskRows ?? []) as WorkTask[]).map((task) => ({
      ...task,
      project_name: project.name,
      team_space_name: teamSpaceMap.get(task.team_space_id)?.name ?? null,
      assignee_name: task.assignee_user_id ? userMap.get(task.assignee_user_id) ?? null : null,
      reporter_name: task.reporter_user_id ? userMap.get(task.reporter_user_id) ?? null : null,
    }));

    const docs = ((docRows ?? []) as WorkDoc[]).map((doc) => ({
      ...doc,
      project_name: project.name,
      team_space_name: teamSpaceMap.get(doc.team_space_id)?.name ?? null,
      block_count: blockCountMap[doc.id] ?? 0,
    }));

    const channels = ((channelRows ?? []) as WorkChannel[]).map((channel) => ({
      ...channel,
      project_name: project.name,
      team_space_name: teamSpaceMap.get(channel.team_space_id)?.name ?? null,
      thread_count: threadCountMap[channel.id] ?? 0,
    }));

    const members = ((memberRows ?? []) as WorkProjectMember[]).map((member) => ({
      ...member,
      user_name: userMap.get(member.user_id) ?? null,
    }));

    return {
      project,
      team_space: teamSpaceMap.get(project.team_space_id) ?? null,
      members,
      tasks,
      docs,
      channels,
      activities: (activityRows ?? []) as WorkActivity[],
      relations: (relationRows ?? []) as WorkRelation[],
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل صفحة المشروع المطلوبة.'));
  }
}

export async function loadProjectActivity(tenantId: string, projectId: string): Promise<WorkActivity[]> {
  ensureTenant(tenantId);

  try {
    const { data, error } = await supabase
      .from('work_recent_activity_v')
      .select(ACTIVITY_FIELDS)
      .eq('tenant_id', tenantId)
      .or(`and(object_type.eq.project,object_id.eq.${projectId}),and(parent_object_type.eq.project,parent_object_id.eq.${projectId})`)
      .order('created_at', { ascending: false })
      .limit(25);

    handleSupabaseError(error, 'تعذر تحميل تسلسل النشاط الخاص بالمشروع.');
    return (data ?? []) as WorkActivity[];
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل نشاط المشروع الآن.'));
  }
}

export async function loadSavedViews(tenantId: string, filters: WorkSavedViewFilters = {}): Promise<WorkSavedView[]> {
  ensureTenant(tenantId);

  try {
    let query = supabase
      .from('work_saved_views')
      .select(SAVED_VIEW_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('is_archived', false);

    if (filters.view_type) {
      query = query.eq('view_type', filters.view_type);
    }

    if (filters.team_space_id) {
      query = query.eq('team_space_id', filters.team_space_id);
    }

    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id);
    }

    if (filters.scope_type && filters.scope_type !== 'all') {
      query = query.eq('scope_type', filters.scope_type);
    }

    const { data, error } = await query.order('is_default', { ascending: false }).order('updated_at', { ascending: false });
    handleSupabaseError(error, 'تعذر تحميل العروض المحفوظة.');
    return (data ?? []) as WorkSavedView[];
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل العروض المحفوظة الآن.'));
  }
}

export async function saveWorkSavedView(tenantId: string, input: WorkSavedViewInput): Promise<WorkSavedView> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId);
    const payload = {
      tenant_id: tenantId,
      team_space_id: toNullableUuid(input.team_space_id),
      project_id: toNullableUuid(input.project_id),
      owner_user_id: actor.id,
      name: input.name.trim(),
      view_type: input.view_type,
      scope_type:
        input.scope_type ??
        (input.project_id ? 'project' : input.team_space_id ? 'team_space' : 'personal'),
      is_shared: Boolean(input.is_shared),
      is_default: Boolean(input.is_default),
      filters: input.filters ?? {},
      columns_config: input.columns_config ?? [],
      sorts: input.sorts ?? [],
      grouping: input.grouping ?? {},
      metadata: input.metadata ?? {},
    };

    const query = input.id
      ? supabase
          .from('work_saved_views')
          .update(payload)
          .eq('tenant_id', tenantId)
          .eq('id', input.id)
      : supabase.from('work_saved_views').insert(payload);

    const { data, error } = await query.select(SAVED_VIEW_FIELDS).single();
    handleSupabaseError(error, 'تعذر حفظ العرض المطلوب.');

    await tryRecordWorkActivity({
      activity_type: input.id ? 'saved_view_updated' : 'saved_view_created',
      object_type: 'saved_view',
      object_id: data!.id as string,
      parent_object_type: input.project_id ? 'project' : input.team_space_id ? 'team_space' : null,
      parent_object_id: (input.project_id || input.team_space_id) ?? null,
      summary: `${input.id ? 'تم تحديث' : 'تم حفظ'} عرض محفوظ: ${input.name.trim()}`,
      payload: {
        view_type: input.view_type,
        scope_type: payload.scope_type,
      },
    });

    return data as WorkSavedView;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر حفظ العرض الآن.'));
  }
}

export async function archiveSavedView(savedViewId: string, reason?: string) {
  return archiveWorkObject('saved_view', savedViewId, reason ?? 'Archived from saved views panel');
}

export async function loadInbox(tenantId: string, authUserId?: string): Promise<WorkInboxData> {
  ensureTenant(tenantId);

  try {
    const actor = await resolveCurrentWorkActor(tenantId, authUserId);
    const { data, error } = await supabase
      .from('work_notifications')
      .select(NOTIFICATION_FIELDS)
      .eq('tenant_id', tenantId)
      .eq('user_id', actor.id)
      .order('created_at', { ascending: false })
      .limit(100);

    handleSupabaseError(error, 'تعذر تحميل التنبيهات الداخلية.');

    const notifications = (data ?? []) as WorkNotification[];
    return {
      unread_count: notifications.filter((item) => !item.read_at).length,
      notifications,
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحميل البريد الداخلي في WorkOS.'));
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    const { data, error } = await supabase.rpc('work_mark_notification_read', {
      p_notification_id: notificationId,
    });

    handleSupabaseError(error, 'تعذر تعليم التنبيه كمقروء.');
    return data;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تحديث حالة التنبيه.'));
  }
}

export async function archiveWorkObject(objectType: WorkObjectType, objectId: string, reason?: string) {
  try {
    const { data, error } = await supabase.rpc('work_archive_object', {
      p_object_type: objectType,
      p_object_id: objectId,
      p_reason: reason ?? null,
    });

    handleSupabaseError(error, 'تعذر أرشفة عنصر WorkOS المطلوب.');
    return data;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تنفيذ الأرشفة في WorkOS.'));
  }
}

export async function recordWorkActivity(input: {
  activity_type: string;
  object_type?: WorkObjectType | null;
  object_id?: string | null;
  summary?: string | null;
  parent_object_type?: WorkObjectType | null;
  parent_object_id?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const { data, error } = await supabase.rpc('work_record_activity', {
      p_activity_type: input.activity_type,
      p_object_type: input.object_type ?? null,
      p_object_id: input.object_id ?? null,
      p_summary: input.summary ?? null,
      p_parent_object_type: input.parent_object_type ?? null,
      p_parent_object_id: input.parent_object_id ?? null,
      p_payload: input.payload ?? {},
    });

    handleSupabaseError(error, 'تعذر تسجيل النشاط في WorkOS.');
    return data;
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر حفظ النشاط المرتبط بطبقة WorkOS.'));
  }
}

export async function lightweightSearch(tenantId: string, query: string): Promise<WorkSearchData> {
  ensureTenant(tenantId);
  const safeQuery = sanitizeSearchTerm(query);

  if (!safeQuery) {
    return { query, results: [] };
  }

  try {
    const pattern = `%${safeQuery}%`;
    const [
      { data: projectsData, error: projectsError },
      { data: docsData, error: docsError },
      { data: tasksData, error: tasksError },
      { data: channelsData, error: channelsError },
    ] = await Promise.all([
      supabase
        .from('work_projects')
        .select('id,name,description,status,updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .ilike('name', pattern)
        .order('updated_at', { ascending: false })
        .limit(6),
      supabase
        .from('work_docs')
        .select('id,title,summary,status,updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(6),
      supabase
        .from('work_tasks')
        .select('id,title,description,status,updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(6),
      supabase
        .from('work_channels')
        .select('id,name,description,channel_type,updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .ilike('name', pattern)
        .order('updated_at', { ascending: false })
        .limit(6),
    ]);

    handleSupabaseError(projectsError, 'تعذر تنفيذ البحث في المشاريع.');
    handleSupabaseError(docsError, 'تعذر تنفيذ البحث في المستندات.');
    handleSupabaseError(tasksError, 'تعذر تنفيذ البحث في المهام.');
    handleSupabaseError(channelsError, 'تعذر تنفيذ البحث في القنوات.');

    const results: WorkSearchResult[] = [
      ...((projectsData ?? []) as Array<Record<string, unknown>>).map((row) => ({
        kind: 'project' as const,
        id: row.id as string,
        title: (row.name as string) || 'مشروع',
        subtitle: (row.description as string) || 'مشروع ضمن مساحة العمل الحالية.',
        href: buildWorkSearchHref('project', row.id as string),
        status: (row.status as string | null) ?? null,
        updated_at: row.updated_at as string,
      })),
      ...((docsData ?? []) as Array<Record<string, unknown>>).map((row) => ({
        kind: 'doc' as const,
        id: row.id as string,
        title: (row.title as string) || 'مستند',
        subtitle: (row.summary as string) || 'مستند ضمن مكتبة WorkOS.',
        href: buildWorkSearchHref('doc', row.id as string),
        status: (row.status as string | null) ?? null,
        updated_at: row.updated_at as string,
      })),
      ...((tasksData ?? []) as Array<Record<string, unknown>>).map((row) => ({
        kind: 'task' as const,
        id: row.id as string,
        title: (row.title as string) || 'مهمة',
        subtitle: (row.description as string) || 'عنصر عمل مرتبط بمشروع أو نقاش.',
        href: buildWorkSearchHref('task', row.id as string),
        status: (row.status as string | null) ?? null,
        updated_at: row.updated_at as string,
      })),
      ...((channelsData ?? []) as Array<Record<string, unknown>>).map((row) => ({
        kind: 'channel' as const,
        id: row.id as string,
        title: (row.name as string) || 'قناة',
        subtitle: (row.description as string) || 'قناة تنسيق ومتابعة داخلية.',
        href: buildWorkSearchHref('channel', row.id as string),
        status: (row.channel_type as string | null) ?? null,
        updated_at: row.updated_at as string,
      })),
    ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return {
      query,
      results,
    };
  } catch (error) {
    throw new Error(normalizeWorkOsError(error, 'تعذر تنفيذ البحث الحالي في WorkOS.'));
  }
}
