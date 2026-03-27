export type WorkVisibility = 'internal' | 'private';

export type WorkProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type WorkProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export type WorkTaskType = 'task' | 'bug' | 'request' | 'note' | 'action';

export type WorkTaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'in_review'
  | 'done'
  | 'cancelled'
  | 'archived';

export type WorkDocType = 'page' | 'spec' | 'meeting_note' | 'decision' | 'runbook' | 'wiki';

export type WorkDocStatus = 'draft' | 'published' | 'archived';

export type WorkDocBlockType =
  | 'paragraph'
  | 'heading'
  | 'checklist_item'
  | 'todo'
  | 'bulleted_list'
  | 'numbered_list'
  | 'quote'
  | 'code'
  | 'callout'
  | 'divider'
  | 'embed';

export type WorkChannelType = 'team' | 'project' | 'announcement' | 'topic' | 'dm';

export type WorkThreadType = 'discussion' | 'decision' | 'incident' | 'question' | 'action';

export type WorkThreadStatus = 'open' | 'resolved' | 'archived';

export type WorkRelationType = 'created_from' | 'discussed_in' | 'references' | 'belongs_to' | 'fulfills';

export type WorkSavedViewType = 'project' | 'task' | 'doc' | 'channel' | 'thread' | 'activity' | 'notification';

export type WorkSavedViewScopeType = 'personal' | 'team_space' | 'project' | 'tenant';

export type WorkObjectType =
  | 'team_space'
  | 'project'
  | 'task'
  | 'doc'
  | 'channel'
  | 'thread'
  | 'message'
  | 'saved_view';

export interface WorkTeamSpace {
  id: string;
  tenant_id: string;
  slug: string | null;
  name: string;
  name_ar: string | null;
  description: string | null;
  icon: string | null;
  color: string;
  visibility: WorkVisibility;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  project_count?: number;
  doc_count?: number;
  channel_count?: number;
}

export interface WorkProject {
  id: string;
  tenant_id: string;
  team_space_id: string;
  name: string;
  name_ar: string | null;
  project_key: string | null;
  description: string | null;
  visibility: WorkVisibility;
  status: WorkProjectStatus;
  priority: WorkProjectPriority;
  owner_user_id: string | null;
  lead_user_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
  total_tasks?: number;
  open_tasks?: number;
  completed_tasks?: number;
  doc_count?: number;
  channel_count?: number;
  thread_count?: number;
  last_activity_at?: string | null;
  team_space_name?: string | null;
  team_space_name_ar?: string | null;
  owner_name?: string | null;
  lead_name?: string | null;
}

export interface WorkProjectMember {
  id: string;
  tenant_id: string;
  project_id: string;
  user_id: string;
  member_role: 'owner' | 'manager' | 'member' | 'viewer';
  membership_status: 'active' | 'invited' | 'removed';
  invited_at: string | null;
  joined_at: string | null;
  removed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user_name?: string | null;
}

export interface WorkTask {
  id: string;
  tenant_id: string;
  team_space_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  task_type: WorkTaskType;
  status: WorkTaskStatus;
  priority: WorkProjectPriority;
  source_object_type: 'thread' | 'doc' | 'message' | null;
  source_object_id: string | null;
  assignee_user_id: string | null;
  reporter_user_id: string | null;
  start_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  estimate_minutes: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  is_overdue?: boolean;
  project_name?: string | null;
  team_space_name?: string | null;
  assignee_name?: string | null;
  reporter_name?: string | null;
}

export interface WorkDoc {
  id: string;
  tenant_id: string;
  team_space_id: string;
  project_id: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  doc_type: WorkDocType;
  status: WorkDocStatus;
  visibility: WorkVisibility;
  current_version: number;
  created_by: string | null;
  updated_by: string | null;
  last_edited_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  project_name?: string | null;
  team_space_name?: string | null;
  block_count?: number;
}

export interface WorkChannel {
  id: string;
  tenant_id: string;
  team_space_id: string;
  project_id: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  channel_type: WorkChannelType;
  visibility: WorkVisibility;
  last_message_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  team_space_name?: string | null;
  project_name?: string | null;
  thread_count?: number;
}

export interface WorkThread {
  id: string;
  tenant_id: string;
  team_space_id: string;
  project_id: string | null;
  channel_id: string | null;
  title: string | null;
  thread_type: WorkThreadType;
  status: WorkThreadStatus;
  created_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  last_message_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  channel_name?: string | null;
  project_name?: string | null;
  team_space_name?: string | null;
  created_by_name?: string | null;
  message_count?: number;
  latest_message_preview?: string | null;
}

export interface WorkMessage {
  id: string;
  tenant_id: string;
  thread_id: string;
  author_user_id: string | null;
  message_type: 'comment' | 'system' | 'activity' | 'decision';
  body: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
}

export interface WorkDocBlock {
  id: string;
  tenant_id: string;
  doc_id: string;
  parent_block_id: string | null;
  block_type: WorkDocBlockType;
  sort_order: number;
  content: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkRelation {
  id: string;
  tenant_id: string;
  left_object_type: WorkObjectType;
  left_object_id: string;
  relation_type: WorkRelationType;
  right_object_type: WorkObjectType;
  right_object_id: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface WorkActivity {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  activity_type: string;
  object_type: WorkObjectType | null;
  object_id: string | null;
  parent_object_type: WorkObjectType | null;
  parent_object_id: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WorkNotification {
  id: string;
  tenant_id: string;
  user_id: string;
  activity_id: string | null;
  object_type: WorkObjectType | null;
  object_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSavedView {
  id: string;
  tenant_id: string;
  team_space_id: string | null;
  project_id: string | null;
  owner_user_id: string;
  name: string;
  view_type: WorkSavedViewType;
  scope_type: WorkSavedViewScopeType;
  is_shared: boolean;
  is_default: boolean;
  filters: Record<string, unknown>;
  columns_config: unknown[];
  sorts: unknown[];
  grouping: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkHomeSummary {
  team_space_count: number;
  project_count: number;
  open_task_count: number;
  doc_count: number;
  channel_count: number;
  unread_notification_count: number;
}

export interface WorkQuickLink {
  label: string;
  description: string;
  href: string;
}

export interface WorkHomeData {
  summary: WorkHomeSummary;
  my_work: WorkTask[];
  recent_activity: WorkActivity[];
  quick_links: WorkQuickLink[];
}

export interface WorkProjectDetailData {
  project: WorkProject;
  team_space: WorkTeamSpace | null;
  members: WorkProjectMember[];
  tasks: WorkTask[];
  docs: WorkDoc[];
  channels: WorkChannel[];
  activities: WorkActivity[];
  relations: WorkRelation[];
}

export interface WorkProjectsResponse {
  projects: WorkProject[];
  team_spaces: WorkTeamSpace[];
}

export interface WorkDocsResponse {
  docs: WorkDoc[];
  team_spaces: WorkTeamSpace[];
  projects: WorkProject[];
  saved_views?: WorkSavedView[];
}

export interface WorkChannelsResponse {
  channels: WorkChannel[];
  team_spaces: WorkTeamSpace[];
  projects: WorkProject[];
}

export interface WorkInboxData {
  unread_count: number;
  notifications: WorkNotification[];
}

export interface WorkSearchResult {
  kind: 'project' | 'doc' | 'task' | 'channel';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string | null;
  updated_at: string;
}

export interface WorkSearchData {
  query: string;
  results: WorkSearchResult[];
}

export interface WorkProjectFilters {
  status?: WorkProjectStatus | 'all';
  team_space_id?: string;
  query?: string;
}

export interface WorkDocFilters {
  team_space_id?: string;
  project_id?: string;
  query?: string;
}

export interface WorkChannelFilters {
  team_space_id?: string;
  project_id?: string;
  query?: string;
}

export interface WorkSavedViewFilters {
  view_type?: WorkSavedViewType;
  team_space_id?: string;
  project_id?: string;
  scope_type?: WorkSavedViewScopeType | 'all';
}

export interface WorkUserOption {
  id: string;
  full_name: string;
  email?: string | null;
  is_active?: boolean;
}

export interface WorkTeamSpaceFormInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  visibility: WorkVisibility;
  is_default?: boolean;
  is_active?: boolean;
  color?: string | null;
}

export interface WorkProjectFormInput {
  team_space_id: string;
  name: string;
  description?: string | null;
  status: WorkProjectStatus;
  priority: WorkProjectPriority;
  owner_user_id?: string | null;
  lead_user_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  visibility?: WorkVisibility;
}

export interface WorkDocFormInput {
  team_space_id: string;
  project_id?: string | null;
  title: string;
  slug?: string | null;
  summary?: string | null;
  doc_type: WorkDocType;
  status: WorkDocStatus;
  visibility: WorkVisibility;
  initial_block_text?: string | null;
}

export interface WorkChannelFormInput {
  team_space_id: string;
  project_id?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  channel_type: WorkChannelType;
  visibility: WorkVisibility;
}

export interface WorkTaskFormInput {
  team_space_id: string;
  project_id?: string | null;
  title: string;
  description?: string | null;
  task_type: WorkTaskType;
  status: WorkTaskStatus;
  priority: WorkProjectPriority;
  assignee_user_id?: string | null;
  due_at?: string | null;
}

export interface WorkThreadFormInput {
  team_space_id?: string | null;
  project_id?: string | null;
  channel_id?: string | null;
  title?: string | null;
  thread_type: WorkThreadType;
}

export interface WorkMessageFormInput {
  thread_id: string;
  body: string;
  reply_to_message_id?: string | null;
  message_type?: 'comment' | 'system' | 'activity' | 'decision';
}

export interface WorkSavedViewInput {
  id?: string;
  name: string;
  view_type: WorkSavedViewType;
  scope_type?: WorkSavedViewScopeType;
  team_space_id?: string | null;
  project_id?: string | null;
  is_shared?: boolean;
  is_default?: boolean;
  filters?: Record<string, unknown>;
  columns_config?: unknown[];
  sorts?: unknown[];
  grouping?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkTaskQuickUpdateInput {
  status?: WorkTaskStatus;
  priority?: WorkProjectPriority;
}

export interface WorkObjectLinkInput {
  left_object_type: WorkObjectType;
  left_object_id: string;
  relation_type: WorkRelationType;
  right_object_type: WorkObjectType;
  right_object_id: string;
  metadata?: Record<string, unknown>;
}

export interface WorkLinkableOption {
  id: string;
  type: WorkObjectType;
  label: string;
  subtitle?: string | null;
}
