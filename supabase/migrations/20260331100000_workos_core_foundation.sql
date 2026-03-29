BEGIN;

-- =============================================================================
-- NawwatOS WorkOS Core Data Foundation
-- -----------------------------------------------------------------------------
-- Phase 1 only:
--   - Canonical work_* tables on top of the current tenant workspace root
--   - Tenant-scoped RLS with project-aware access helpers
--   - Foundational RPCs for linking, archiving, activities, and task creation
--   - Limited read models for project home, my work, and recent activity
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Access helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.work_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.current_employee_user_id();
$$;

REVOKE ALL ON FUNCTION public.work_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_current_user_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_access_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(public.current_app_role(), '');
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  RETURN public.is_tenant_staff(p_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_access_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_access_tenant(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_admin_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text := COALESCE(public.current_app_role(), '');
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  IF v_role IN ('owner', 'tenant_owner', 'tenant_admin', 'master_admin') THEN
    RETURN true;
  END IF;

  RETURN public.is_tenant_admin(p_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_admin_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_admin_tenant(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_safe_audit(
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF to_regprocedure('public.log_audit_event(uuid,text,text,uuid,jsonb,boolean,uuid)') IS NOT NULL THEN
    EXECUTE
      'SELECT public.log_audit_event($1, $2, $3, $4, $5, $6, NULL)'
      USING p_tenant_id, p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::jsonb), p_success;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.work_safe_audit(uuid, text, text, uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_safe_audit(uuid, text, text, uuid, jsonb, boolean) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_team_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text,
  name text NOT NULL,
  name_ar text,
  description text,
  icon text,
  color text NOT NULL DEFAULT '#00CFFF',
  visibility text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'private')),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_team_spaces_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT work_team_spaces_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_team_spaces_tenant_slug_key UNIQUE (tenant_id, slug),
  CONSTRAINT work_team_spaces_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_team_spaces_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

CREATE TABLE IF NOT EXISTS public.work_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_space_id uuid NOT NULL,
  name text NOT NULL,
  name_ar text,
  project_key text,
  description text,
  visibility text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'private')),
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  owner_user_id uuid,
  lead_user_id uuid,
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_projects_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT work_projects_due_after_start CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date),
  CONSTRAINT work_projects_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_projects_tenant_project_key_key UNIQUE (tenant_id, project_key),
  CONSTRAINT work_projects_team_space_fkey
    FOREIGN KEY (tenant_id, team_space_id)
    REFERENCES public.work_team_spaces(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_projects_owner_user_fkey
    FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (owner_user_id),
  CONSTRAINT work_projects_lead_user_fkey
    FOREIGN KEY (tenant_id, lead_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (lead_user_id),
  CONSTRAINT work_projects_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_projects_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

CREATE TABLE IF NOT EXISTS public.work_project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  member_role text NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner', 'manager', 'member', 'viewer')),
  membership_status text NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('active', 'invited', 'removed')),
  added_by uuid,
  invited_at timestamptz,
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_project_members_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_project_members_tenant_project_user_key UNIQUE (tenant_id, project_id, user_id),
  CONSTRAINT work_project_members_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_project_members_user_fkey
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_project_members_added_by_fkey
    FOREIGN KEY (tenant_id, added_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (added_by)
);

CREATE TABLE IF NOT EXISTS public.work_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_space_id uuid NOT NULL,
  project_id uuid,
  parent_task_id uuid,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'task'
    CHECK (task_type IN ('task', 'bug', 'request', 'note', 'action')),
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'blocked', 'in_review', 'done', 'cancelled', 'archived')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  source_object_type text
    CHECK (source_object_type IN ('thread', 'doc', 'message')),
  source_object_id uuid,
  reporter_user_id uuid,
  assignee_user_id uuid,
  created_by uuid,
  completed_by uuid,
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  estimate_minutes integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_tasks_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT work_tasks_estimate_minutes_nonnegative CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
  CONSTRAINT work_tasks_source_pair_check CHECK (
    (source_object_type IS NULL AND source_object_id IS NULL)
    OR (source_object_type IS NOT NULL AND source_object_id IS NOT NULL)
  ),
  CONSTRAINT work_tasks_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_tasks_team_space_fkey
    FOREIGN KEY (tenant_id, team_space_id)
    REFERENCES public.work_team_spaces(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_tasks_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id) ON DELETE SET NULL (project_id),
  CONSTRAINT work_tasks_parent_task_fkey
    FOREIGN KEY (tenant_id, parent_task_id)
    REFERENCES public.work_tasks(tenant_id, id) ON DELETE SET NULL (parent_task_id),
  CONSTRAINT work_tasks_reporter_user_fkey
    FOREIGN KEY (tenant_id, reporter_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (reporter_user_id),
  CONSTRAINT work_tasks_assignee_user_fkey
    FOREIGN KEY (tenant_id, assignee_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (assignee_user_id),
  CONSTRAINT work_tasks_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_tasks_completed_by_fkey
    FOREIGN KEY (tenant_id, completed_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (completed_by),
  CONSTRAINT work_tasks_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

CREATE TABLE IF NOT EXISTS public.work_task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  predecessor_task_id uuid NOT NULL,
  successor_task_id uuid NOT NULL,
  dependency_type text NOT NULL DEFAULT 'blocks'
    CHECK (dependency_type IN ('blocks', 'depends_on', 'duplicates', 'relates_to')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_task_dependencies_not_self CHECK (predecessor_task_id <> successor_task_id),
  CONSTRAINT work_task_dependencies_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_task_dependencies_unique_key UNIQUE (tenant_id, predecessor_task_id, successor_task_id, dependency_type),
  CONSTRAINT work_task_dependencies_predecessor_fkey
    FOREIGN KEY (tenant_id, predecessor_task_id)
    REFERENCES public.work_tasks(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_task_dependencies_successor_fkey
    FOREIGN KEY (tenant_id, successor_task_id)
    REFERENCES public.work_tasks(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_task_dependencies_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE TABLE IF NOT EXISTS public.work_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_space_id uuid NOT NULL,
  project_id uuid,
  title text NOT NULL,
  slug text,
  summary text,
  doc_type text NOT NULL DEFAULT 'page'
    CHECK (doc_type IN ('page', 'spec', 'meeting_note', 'decision', 'runbook', 'wiki')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  visibility text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'private')),
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  created_by uuid,
  updated_by uuid,
  last_edited_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_docs_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT work_docs_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_docs_tenant_slug_key UNIQUE (tenant_id, slug),
  CONSTRAINT work_docs_team_space_fkey
    FOREIGN KEY (tenant_id, team_space_id)
    REFERENCES public.work_team_spaces(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_docs_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id) ON DELETE SET NULL (project_id),
  CONSTRAINT work_docs_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_docs_updated_by_fkey
    FOREIGN KEY (tenant_id, updated_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (updated_by),
  CONSTRAINT work_docs_last_edited_by_fkey
    FOREIGN KEY (tenant_id, last_edited_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (last_edited_by),
  CONSTRAINT work_docs_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

CREATE TABLE IF NOT EXISTS public.work_doc_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_id uuid NOT NULL,
  parent_block_id uuid,
  block_type text NOT NULL
    CHECK (block_type IN (
      'paragraph', 'heading', 'checklist_item', 'todo', 'bulleted_list',
      'numbered_list', 'quote', 'code', 'callout', 'divider', 'embed'
    )),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_doc_blocks_content_object CHECK (jsonb_typeof(content) = 'object'),
  CONSTRAINT work_doc_blocks_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_doc_blocks_doc_fkey
    FOREIGN KEY (tenant_id, doc_id)
    REFERENCES public.work_docs(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_doc_blocks_parent_fkey
    FOREIGN KEY (tenant_id, parent_block_id)
    REFERENCES public.work_doc_blocks(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_doc_blocks_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_doc_blocks_updated_by_fkey
    FOREIGN KEY (tenant_id, updated_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (updated_by)
);

CREATE TABLE IF NOT EXISTS public.work_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_space_id uuid NOT NULL,
  project_id uuid,
  name text NOT NULL,
  slug text,
  description text,
  channel_type text NOT NULL DEFAULT 'team'
    CHECK (channel_type IN ('team', 'project', 'announcement', 'topic', 'dm')),
  visibility text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'private')),
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_channels_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT work_channels_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_channels_tenant_slug_key UNIQUE (tenant_id, slug),
  CONSTRAINT work_channels_team_space_fkey
    FOREIGN KEY (tenant_id, team_space_id)
    REFERENCES public.work_team_spaces(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_channels_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id) ON DELETE SET NULL (project_id),
  CONSTRAINT work_channels_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_channels_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

CREATE TABLE IF NOT EXISTS public.work_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_space_id uuid NOT NULL,
  project_id uuid,
  channel_id uuid,
  title text,
  thread_type text NOT NULL DEFAULT 'discussion'
    CHECK (thread_type IN ('discussion', 'decision', 'incident', 'question', 'action')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'archived')),
  created_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_threads_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_threads_team_space_fkey
    FOREIGN KEY (tenant_id, team_space_id)
    REFERENCES public.work_team_spaces(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_threads_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id) ON DELETE SET NULL (project_id),
  CONSTRAINT work_threads_channel_fkey
    FOREIGN KEY (tenant_id, channel_id)
    REFERENCES public.work_channels(tenant_id, id) ON DELETE SET NULL (channel_id),
  CONSTRAINT work_threads_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by),
  CONSTRAINT work_threads_resolved_by_fkey
    FOREIGN KEY (tenant_id, resolved_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (resolved_by),
  CONSTRAINT work_threads_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

CREATE TABLE IF NOT EXISTS public.work_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL,
  author_user_id uuid,
  reply_to_message_id uuid,
  message_type text NOT NULL DEFAULT 'comment'
    CHECK (message_type IN ('comment', 'system', 'activity', 'decision')),
  body text,
  body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_messages_body_or_json_or_attachments CHECK (
    NULLIF(btrim(COALESCE(body, '')), '') IS NOT NULL
    OR body_json <> '{}'::jsonb
    OR attachments <> '[]'::jsonb
  ),
  CONSTRAINT work_messages_body_json_object CHECK (jsonb_typeof(body_json) = 'object'),
  CONSTRAINT work_messages_attachments_array CHECK (jsonb_typeof(attachments) = 'array'),
  CONSTRAINT work_messages_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_messages_thread_fkey
    FOREIGN KEY (tenant_id, thread_id)
    REFERENCES public.work_threads(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_messages_author_user_fkey
    FOREIGN KEY (tenant_id, author_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (author_user_id),
  CONSTRAINT work_messages_reply_to_message_fkey
    FOREIGN KEY (tenant_id, reply_to_message_id)
    REFERENCES public.work_messages(tenant_id, id) ON DELETE SET NULL (reply_to_message_id)
);

CREATE TABLE IF NOT EXISTS public.work_object_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  left_object_type text NOT NULL
    CHECK (left_object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message')),
  left_object_id uuid NOT NULL,
  relation_type text NOT NULL
    CHECK (relation_type IN ('created_from', 'discussed_in', 'references', 'belongs_to', 'fulfills')),
  right_object_type text NOT NULL
    CHECK (right_object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message')),
  right_object_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_object_relations_not_self CHECK (
    NOT (
      left_object_type = right_object_type
      AND left_object_id = right_object_id
    )
  ),
  CONSTRAINT work_object_relations_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_object_relations_unique_key UNIQUE (
    tenant_id, left_object_type, left_object_id, relation_type, right_object_type, right_object_id
  ),
  CONSTRAINT work_object_relations_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE TABLE IF NOT EXISTS public.work_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id uuid,
  activity_type text NOT NULL,
  object_type text
    CHECK (object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message', 'saved_view')),
  object_id uuid,
  parent_object_type text
    CHECK (parent_object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message', 'saved_view')),
  parent_object_id uuid,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_activities_object_pair_check CHECK (
    (object_type IS NULL AND object_id IS NULL)
    OR (object_type IS NOT NULL AND object_id IS NOT NULL)
  ),
  CONSTRAINT work_activities_parent_object_pair_check CHECK (
    (parent_object_type IS NULL AND parent_object_id IS NULL)
    OR (parent_object_type IS NOT NULL AND parent_object_id IS NOT NULL)
  ),
  CONSTRAINT work_activities_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_activities_actor_user_fkey
    FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (actor_user_id)
);

CREATE TABLE IF NOT EXISTS public.work_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  activity_id uuid,
  object_type text
    CHECK (object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message', 'saved_view')),
  object_id uuid,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_notifications_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT work_notifications_object_pair_check CHECK (
    (object_type IS NULL AND object_id IS NULL)
    OR (object_type IS NOT NULL AND object_id IS NOT NULL)
  ),
  CONSTRAINT work_notifications_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_notifications_user_fkey
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_notifications_activity_fkey
    FOREIGN KEY (tenant_id, activity_id)
    REFERENCES public.work_activities(tenant_id, id) ON DELETE SET NULL (activity_id)
);

CREATE TABLE IF NOT EXISTS public.work_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_space_id uuid,
  project_id uuid,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  view_type text NOT NULL
    CHECK (view_type IN ('project', 'task', 'doc', 'channel', 'thread', 'activity', 'notification')),
  scope_type text NOT NULL DEFAULT 'personal'
    CHECK (scope_type IN ('personal', 'team_space', 'project', 'tenant')),
  is_shared boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  columns_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  sorts jsonb NOT NULL DEFAULT '[]'::jsonb,
  grouping jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_saved_views_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT work_saved_views_filters_object CHECK (jsonb_typeof(filters) = 'object'),
  CONSTRAINT work_saved_views_columns_array CHECK (jsonb_typeof(columns_config) = 'array'),
  CONSTRAINT work_saved_views_sorts_array CHECK (jsonb_typeof(sorts) = 'array'),
  CONSTRAINT work_saved_views_grouping_object CHECK (jsonb_typeof(grouping) = 'object'),
  CONSTRAINT work_saved_views_scope_check CHECK (
    (scope_type = 'project' AND project_id IS NOT NULL)
    OR (scope_type = 'team_space' AND team_space_id IS NOT NULL)
    OR (scope_type IN ('personal', 'tenant'))
  ),
  CONSTRAINT work_saved_views_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT work_saved_views_team_space_fkey
    FOREIGN KEY (tenant_id, team_space_id)
    REFERENCES public.work_team_spaces(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_saved_views_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_saved_views_owner_user_fkey
    FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT work_saved_views_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id) ON DELETE SET NULL (archived_by)
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_work_team_spaces_tenant_visibility
  ON public.work_team_spaces(tenant_id, visibility, is_archived);

CREATE INDEX IF NOT EXISTS idx_work_projects_tenant_status
  ON public.work_projects(tenant_id, status, is_archived);

CREATE INDEX IF NOT EXISTS idx_work_projects_team_space
  ON public.work_projects(tenant_id, team_space_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_project_members_project
  ON public.work_project_members(tenant_id, project_id, membership_status);

CREATE INDEX IF NOT EXISTS idx_work_project_members_user
  ON public.work_project_members(tenant_id, user_id, membership_status);

CREATE INDEX IF NOT EXISTS idx_work_tasks_project_status
  ON public.work_tasks(tenant_id, project_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_work_tasks_assignee
  ON public.work_tasks(tenant_id, assignee_user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_work_tasks_team_space
  ON public.work_tasks(tenant_id, team_space_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_task_dependencies_predecessor
  ON public.work_task_dependencies(tenant_id, predecessor_task_id);

CREATE INDEX IF NOT EXISTS idx_work_task_dependencies_successor
  ON public.work_task_dependencies(tenant_id, successor_task_id);

CREATE INDEX IF NOT EXISTS idx_work_docs_project_status
  ON public.work_docs(tenant_id, project_id, status, is_archived);

CREATE INDEX IF NOT EXISTS idx_work_docs_team_space
  ON public.work_docs(tenant_id, team_space_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_doc_blocks_doc_sort
  ON public.work_doc_blocks(tenant_id, doc_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_work_channels_project
  ON public.work_channels(tenant_id, project_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_channels_team_space
  ON public.work_channels(tenant_id, team_space_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_threads_channel
  ON public.work_threads(tenant_id, channel_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_threads_project
  ON public.work_threads(tenant_id, project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_messages_thread_created
  ON public.work_messages(tenant_id, thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_work_messages_author
  ON public.work_messages(tenant_id, author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_object_relations_left
  ON public.work_object_relations(tenant_id, left_object_type, left_object_id);

CREATE INDEX IF NOT EXISTS idx_work_object_relations_right
  ON public.work_object_relations(tenant_id, right_object_type, right_object_id);

CREATE INDEX IF NOT EXISTS idx_work_activities_object
  ON public.work_activities(tenant_id, object_type, object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_activities_parent
  ON public.work_activities(tenant_id, parent_object_type, parent_object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_activities_actor
  ON public.work_activities(tenant_id, actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_notifications_user
  ON public.work_notifications(tenant_id, user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_saved_views_owner
  ON public.work_saved_views(tenant_id, owner_user_id, is_archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_saved_views_project
  ON public.work_saved_views(tenant_id, project_id, is_shared);

-- -----------------------------------------------------------------------------
-- Context / validation helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.work_project_member_role(
  p_tenant_id uuid,
  p_project_id uuid,
  p_user_id uuid DEFAULT public.work_current_user_id()
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_tenant_id IS NULL OR p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pm.member_role
    INTO v_role
  FROM public.work_project_members pm
  WHERE pm.tenant_id = p_tenant_id
    AND pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.membership_status = 'active'
  ORDER BY pm.created_at DESC
  LIMIT 1;

  RETURN v_role;
END;
$$;

REVOKE ALL ON FUNCTION public.work_project_member_role(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_project_member_role(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_is_project_member(
  p_tenant_id uuid,
  p_project_id uuid,
  p_user_id uuid DEFAULT public.work_current_user_id()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF public.work_can_admin_tenant(p_tenant_id) THEN
    RETURN true;
  END IF;

  RETURN public.work_project_member_role(p_tenant_id, p_project_id, p_user_id) IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.work_is_project_member(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_is_project_member(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_read_project(
  p_tenant_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_visibility text;
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF public.work_can_admin_tenant(p_tenant_id) THEN
    RETURN true;
  END IF;

  SELECT p.visibility
    INTO v_visibility
  FROM public.work_projects p
  WHERE p.tenant_id = p_tenant_id
    AND p.id = p_project_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF public.work_is_project_member(p_tenant_id, p_project_id, public.work_current_user_id()) THEN
    RETURN true;
  END IF;

  RETURN COALESCE(v_visibility, 'internal') = 'internal';
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_read_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_read_project(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_edit_project(
  p_tenant_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text;
  v_owner_user_id uuid;
  v_created_by uuid;
  v_current_user_id uuid := public.work_current_user_id();
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF public.work_can_admin_tenant(p_tenant_id) THEN
    RETURN true;
  END IF;

  SELECT p.owner_user_id, p.created_by
    INTO v_owner_user_id, v_created_by
  FROM public.work_projects p
  WHERE p.tenant_id = p_tenant_id
    AND p.id = p_project_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_current_user_id IS NOT NULL
     AND (v_owner_user_id = v_current_user_id OR v_created_by = v_current_user_id) THEN
    RETURN true;
  END IF;

  v_role := public.work_project_member_role(p_tenant_id, p_project_id, v_current_user_id);
  RETURN COALESCE(v_role, '') = ANY (ARRAY['owner', 'manager', 'member']);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_edit_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_edit_project(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_manage_project(
  p_tenant_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text;
  v_owner_user_id uuid;
  v_created_by uuid;
  v_current_user_id uuid := public.work_current_user_id();
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF public.work_can_admin_tenant(p_tenant_id) THEN
    RETURN true;
  END IF;

  SELECT p.owner_user_id, p.created_by
    INTO v_owner_user_id, v_created_by
  FROM public.work_projects p
  WHERE p.tenant_id = p_tenant_id
    AND p.id = p_project_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_current_user_id IS NOT NULL
     AND (v_owner_user_id = v_current_user_id OR v_created_by = v_current_user_id) THEN
    RETURN true;
  END IF;

  v_role := public.work_project_member_role(p_tenant_id, p_project_id, v_current_user_id);
  RETURN COALESCE(v_role, '') = ANY (ARRAY['owner', 'manager']);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_manage_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_manage_project(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_read_context(
  p_tenant_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_visibility text DEFAULT 'internal',
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_current_user_id uuid := public.work_current_user_id();
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF p_project_id IS NOT NULL THEN
    RETURN public.work_can_read_project(p_tenant_id, p_project_id);
  END IF;

  IF COALESCE(p_visibility, 'internal') = 'internal' THEN
    RETURN true;
  END IF;

  RETURN public.work_can_admin_tenant(p_tenant_id)
    OR (v_current_user_id IS NOT NULL AND p_owner_user_id = v_current_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_read_context(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_read_context(uuid, uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_write_context(
  p_tenant_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_visibility text DEFAULT 'internal',
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_current_user_id uuid := public.work_current_user_id();
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  IF p_project_id IS NOT NULL THEN
    RETURN public.work_can_edit_project(p_tenant_id, p_project_id);
  END IF;

  IF COALESCE(p_visibility, 'internal') = 'private' THEN
    RETURN public.work_can_admin_tenant(p_tenant_id)
      OR (v_current_user_id IS NOT NULL AND p_owner_user_id = v_current_user_id);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_write_context(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_write_context(uuid, uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_read_thread(
  p_tenant_id uuid,
  p_thread_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_thread record;
  v_channel record;
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  SELECT id, project_id, channel_id, created_by
    INTO v_thread
  FROM public.work_threads
  WHERE tenant_id = p_tenant_id
    AND id = p_thread_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_thread.channel_id IS NOT NULL THEN
    SELECT project_id, visibility, created_by
      INTO v_channel
    FROM public.work_channels
    WHERE tenant_id = p_tenant_id
      AND id = v_thread.channel_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    RETURN public.work_can_read_context(
      p_tenant_id,
      v_channel.project_id,
      v_channel.visibility,
      v_channel.created_by
    );
  END IF;

  RETURN public.work_can_read_context(
    p_tenant_id,
    v_thread.project_id,
    'internal',
    v_thread.created_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_read_thread(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_read_thread(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_write_thread(
  p_tenant_id uuid,
  p_thread_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_thread record;
  v_channel record;
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  SELECT id, project_id, channel_id, created_by
    INTO v_thread
  FROM public.work_threads
  WHERE tenant_id = p_tenant_id
    AND id = p_thread_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_thread.channel_id IS NOT NULL THEN
    SELECT project_id, visibility, created_by
      INTO v_channel
    FROM public.work_channels
    WHERE tenant_id = p_tenant_id
      AND id = v_thread.channel_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN false;
    END IF;

    RETURN public.work_can_write_context(
      p_tenant_id,
      v_channel.project_id,
      v_channel.visibility,
      v_channel.created_by
    );
  END IF;

  RETURN public.work_can_write_context(
    p_tenant_id,
    v_thread.project_id,
    'internal',
    v_thread.created_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_write_thread(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_write_thread(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_object_exists(
  p_tenant_id uuid,
  p_object_type text,
  p_object_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  IF p_tenant_id IS NULL OR p_object_type IS NULL OR p_object_id IS NULL THEN
    RETURN false;
  END IF;

  CASE p_object_type
    WHEN 'team_space' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_team_spaces
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'project' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_projects
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'task' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_tasks
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'doc' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_docs
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'channel' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_channels
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'thread' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_threads
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'message' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_messages
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    WHEN 'saved_view' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.work_saved_views
        WHERE tenant_id = p_tenant_id AND id = p_object_id
      ) INTO v_exists;
    ELSE
      v_exists := false;
  END CASE;

  RETURN COALESCE(v_exists, false);
END;
$$;

REVOKE ALL ON FUNCTION public.work_object_exists(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_object_exists(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_assert_object_exists(
  p_tenant_id uuid,
  p_object_type text,
  p_object_id uuid,
  p_label text DEFAULT 'object'
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.work_object_exists(p_tenant_id, p_object_type, p_object_id) THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â«Ã™Ë†Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° % Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€ Ã™Ë†Ã˜Â¹ % Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©', p_label, p_object_type;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.work_assert_object_exists(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_assert_object_exists(uuid, text, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_read_object(
  p_tenant_id uuid,
  p_object_type text,
  p_object_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_result boolean := false;
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  CASE p_object_type
    WHEN 'team_space' THEN
      SELECT public.work_can_read_context(ws.tenant_id, NULL, ws.visibility, ws.created_by)
        INTO v_result
      FROM public.work_team_spaces ws
      WHERE ws.tenant_id = p_tenant_id
        AND ws.id = p_object_id;
    WHEN 'project' THEN
      SELECT public.work_can_read_project(p_tenant_id, p_object_id)
        INTO v_result;
    WHEN 'task' THEN
      SELECT public.work_can_read_context(t.tenant_id, t.project_id, 'internal', t.created_by)
        INTO v_result
      FROM public.work_tasks t
      WHERE t.tenant_id = p_tenant_id
        AND t.id = p_object_id;
    WHEN 'doc' THEN
      SELECT public.work_can_read_context(d.tenant_id, d.project_id, d.visibility, d.created_by)
        INTO v_result
      FROM public.work_docs d
      WHERE d.tenant_id = p_tenant_id
        AND d.id = p_object_id;
    WHEN 'channel' THEN
      SELECT public.work_can_read_context(c.tenant_id, c.project_id, c.visibility, c.created_by)
        INTO v_result
      FROM public.work_channels c
      WHERE c.tenant_id = p_tenant_id
        AND c.id = p_object_id;
    WHEN 'thread' THEN
      SELECT public.work_can_read_thread(p_tenant_id, p_object_id)
        INTO v_result;
    WHEN 'message' THEN
      SELECT public.work_can_read_thread(m.tenant_id, m.thread_id)
        INTO v_result
      FROM public.work_messages m
      WHERE m.tenant_id = p_tenant_id
        AND m.id = p_object_id;
    WHEN 'saved_view' THEN
      SELECT (
        sv.owner_user_id = public.work_current_user_id()
        OR (
          sv.is_shared IS TRUE
          AND public.work_can_read_context(sv.tenant_id, sv.project_id, 'internal', sv.owner_user_id)
        )
      )
        INTO v_result
      FROM public.work_saved_views sv
      WHERE sv.tenant_id = p_tenant_id
        AND sv.id = p_object_id;
    ELSE
      v_result := false;
  END CASE;

  RETURN COALESCE(v_result, false);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_read_object(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_read_object(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_can_write_object(
  p_tenant_id uuid,
  p_object_type text,
  p_object_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_result boolean := false;
  v_current_user_id uuid := public.work_current_user_id();
BEGIN
  IF NOT public.work_can_access_tenant(p_tenant_id) THEN
    RETURN false;
  END IF;

  CASE p_object_type
    WHEN 'team_space' THEN
      SELECT (
        public.work_can_admin_tenant(ws.tenant_id)
        OR (ws.created_by = v_current_user_id AND ws.visibility = 'private')
      )
        INTO v_result
      FROM public.work_team_spaces ws
      WHERE ws.tenant_id = p_tenant_id
        AND ws.id = p_object_id;
    WHEN 'project' THEN
      SELECT public.work_can_manage_project(p_tenant_id, p_object_id)
        INTO v_result;
    WHEN 'task' THEN
      SELECT public.work_can_write_context(t.tenant_id, t.project_id, 'internal', t.created_by)
        INTO v_result
      FROM public.work_tasks t
      WHERE t.tenant_id = p_tenant_id
        AND t.id = p_object_id;
    WHEN 'doc' THEN
      SELECT public.work_can_write_context(d.tenant_id, d.project_id, d.visibility, d.created_by)
        INTO v_result
      FROM public.work_docs d
      WHERE d.tenant_id = p_tenant_id
        AND d.id = p_object_id;
    WHEN 'channel' THEN
      SELECT public.work_can_write_context(c.tenant_id, c.project_id, c.visibility, c.created_by)
        INTO v_result
      FROM public.work_channels c
      WHERE c.tenant_id = p_tenant_id
        AND c.id = p_object_id;
    WHEN 'thread' THEN
      SELECT public.work_can_write_thread(p_tenant_id, p_object_id)
        INTO v_result;
    WHEN 'message' THEN
      SELECT (
        m.author_user_id = v_current_user_id
        AND public.work_can_write_thread(m.tenant_id, m.thread_id)
      )
        INTO v_result
      FROM public.work_messages m
      WHERE m.tenant_id = p_tenant_id
        AND m.id = p_object_id;
    WHEN 'saved_view' THEN
      SELECT (sv.owner_user_id = v_current_user_id)
        INTO v_result
      FROM public.work_saved_views sv
      WHERE sv.tenant_id = p_tenant_id
        AND sv.id = p_object_id;
    ELSE
      v_result := false;
  END CASE;

  RETURN COALESCE(v_result, false);
END;
$$;

REVOKE ALL ON FUNCTION public.work_can_write_object(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_can_write_object(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_sync_project_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_project_space_id uuid;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT p.team_space_id
      INTO v_project_space_id
    FROM public.work_projects p
    WHERE p.tenant_id = NEW.tenant_id
      AND p.id = NEW.project_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©';
    END IF;

    IF NEW.team_space_id IS NULL THEN
      NEW.team_space_id := v_project_space_id;
    ELSIF NEW.team_space_id <> v_project_space_id THEN
      RAISE EXCEPTION 'Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã™Å Ã™â€ Ã˜ÂªÃ™â€¦Ã™Å  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã˜Â¥Ã™â€žÃ™â€° Ã™â€ Ã™ÂÃ˜Â³ team space Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜Âµ Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·';
    END IF;
  END IF;

  IF NEW.team_space_id IS NULL THEN
    IF TG_TABLE_NAME = 'work_saved_views' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Ã™Å Ã™â€žÃ˜Â²Ã™â€¦ Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ team_space_id Ã™â€žÃ™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â¬Ã™â€ž';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_sync_thread_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_project_space_id uuid;
  v_channel_project_id uuid;
  v_channel_space_id uuid;
BEGIN
  IF NEW.channel_id IS NOT NULL THEN
    SELECT c.project_id, c.team_space_id
      INTO v_channel_project_id, v_channel_space_id
    FROM public.work_channels c
    WHERE c.tenant_id = NEW.tenant_id
      AND c.id = NEW.channel_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯Ã˜Â© Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©';
    END IF;

    IF NEW.team_space_id IS NULL THEN
      NEW.team_space_id := v_channel_space_id;
    ELSIF NEW.team_space_id <> v_channel_space_id THEN
      RAISE EXCEPTION 'thread Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã™Å Ã™â€ Ã˜ÂªÃ™â€¦Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã™â€ Ã™ÂÃ˜Â³ team space Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã˜Â§Ã˜Â©';
    END IF;

    IF v_channel_project_id IS NOT NULL THEN
      IF NEW.project_id IS NULL THEN
        NEW.project_id := v_channel_project_id;
      ELSIF NEW.project_id <> v_channel_project_id THEN
        RAISE EXCEPTION 'thread Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã™Å Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã˜Â§Ã˜Â©';
      END IF;
    ELSIF NEW.project_id IS NOT NULL THEN
      RAISE EXCEPTION 'Ã™â€žÃ˜Â§ Ã™Å Ã™â€¦Ã™Æ’Ã™â€  Ã˜Â±Ã˜Â¨Ã˜Â· thread Ã˜Â¨Ã™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€šÃ™â€ž Ã˜Â¥Ã˜Â°Ã˜Â§ Ã™Æ’Ã˜Â§Ã™â€ Ã˜Âª Ã˜Â§Ã™â€žÃ™â€šÃ™â€ Ã˜Â§Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â·Ã˜Â© Ã˜Â¨Ã˜Â£Ã™Å  Ã™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹';
    END IF;
  ELSIF NEW.project_id IS NOT NULL THEN
    SELECT p.team_space_id
      INTO v_project_space_id
    FROM public.work_projects p
    WHERE p.tenant_id = NEW.tenant_id
      AND p.id = NEW.project_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯ Ã™â€žÃ™â€žÃ™â‚¬ thread Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©';
    END IF;

    IF NEW.team_space_id IS NULL THEN
      NEW.team_space_id := v_project_space_id;
    ELSIF NEW.team_space_id <> v_project_space_id THEN
      RAISE EXCEPTION 'thread Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã™Å Ã™â€ Ã˜ÂªÃ™â€¦Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã™â€ Ã™ÂÃ˜Â³ team space Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜ÂµÃ˜Â© Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â±Ã™Ë†Ã˜Â¹';
    END IF;
  END IF;

  IF NEW.team_space_id IS NULL THEN
    RAISE EXCEPTION 'Ã™Å Ã™â€žÃ˜Â²Ã™â€¦ Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ team_space_id Ã™â€žÃ™â€žÃ™â‚¬ thread';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_validate_doc_block_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_parent_doc_id uuid;
BEGIN
  IF NEW.parent_block_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT db.doc_id
    INTO v_parent_doc_id
  FROM public.work_doc_blocks db
  WHERE db.tenant_id = NEW.tenant_id
    AND db.id = NEW.parent_block_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ˜Â£Ã˜Â¬Ã˜Â±';
  END IF;

  IF v_parent_doc_id <> NEW.doc_id THEN
    RAISE EXCEPTION 'Ã™Æ’Ã™â€ž block Ã™ÂÃ˜Â±Ã˜Â¹Ã™Å  Ã™Å Ã˜Â¬Ã˜Â¨ Ã˜Â£Ã™â€  Ã™Å Ã™â€ Ã˜ÂªÃ™â€¦Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¨';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_validate_task_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.source_object_type IS NOT NULL THEN
    PERFORM public.work_assert_object_exists(
      NEW.tenant_id,
      NEW.source_object_type,
      NEW.source_object_id,
      'Ã™â€¦Ã˜ÂµÃ˜Â¯Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã™â€¦Ã˜Â©'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_validate_object_relation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $wrel$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.left_object_type IS NOT DISTINCT FROM OLD.left_object_type
     AND NEW.left_object_id IS NOT DISTINCT FROM OLD.left_object_id
     AND NEW.right_object_type IS NOT DISTINCT FROM OLD.right_object_type
     AND NEW.right_object_id IS NOT DISTINCT FROM OLD.right_object_id THEN
    RETURN NEW;
  END IF;

  PERFORM public.work_assert_object_exists(NEW.tenant_id, NEW.left_object_type, NEW.left_object_id, 'العنصر الأيسر');
  PERFORM public.work_assert_object_exists(NEW.tenant_id, NEW.right_object_type, NEW.right_object_id, 'العنصر الأيمن');
  RETURN NEW;
END;
$wrel$;

CREATE OR REPLACE FUNCTION public.work_validate_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $wact$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.object_type IS NOT DISTINCT FROM OLD.object_type
     AND NEW.object_id IS NOT DISTINCT FROM OLD.object_id
     AND NEW.parent_object_type IS NOT DISTINCT FROM OLD.parent_object_type
     AND NEW.parent_object_id IS NOT DISTINCT FROM OLD.parent_object_id THEN
    RETURN NEW;
  END IF;

  IF NEW.object_type IS NOT NULL THEN
    PERFORM public.work_assert_object_exists(NEW.tenant_id, NEW.object_type, NEW.object_id, 'العنصر الرئيسي للنشاط');
  END IF;

  IF NEW.parent_object_type IS NOT NULL THEN
    PERFORM public.work_assert_object_exists(NEW.tenant_id, NEW.parent_object_type, NEW.parent_object_id, 'العنصر الأب للنشاط');
  END IF;

  RETURN NEW;
END;
$wact$;

CREATE OR REPLACE FUNCTION public.work_validate_notification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, pg_temp
AS $wnotif$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.object_type IS NOT DISTINCT FROM OLD.object_type
     AND NEW.object_id IS NOT DISTINCT FROM OLD.object_id THEN
    RETURN NEW;
  END IF;

  IF NEW.object_type IS NOT NULL THEN
    PERFORM public.work_assert_object_exists(NEW.tenant_id, NEW.object_type, NEW.object_id, 'العنصر المرتبط بالإشعار');
  END IF;

  RETURN NEW;
END;
$wnotif$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_work_team_spaces_updated_at ON public.work_team_spaces;
CREATE TRIGGER trg_work_team_spaces_updated_at
  BEFORE UPDATE ON public.work_team_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_projects_updated_at ON public.work_projects;
CREATE TRIGGER trg_work_projects_updated_at
  BEFORE UPDATE ON public.work_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_project_members_updated_at ON public.work_project_members;
CREATE TRIGGER trg_work_project_members_updated_at
  BEFORE UPDATE ON public.work_project_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_tasks_updated_at ON public.work_tasks;
CREATE TRIGGER trg_work_tasks_updated_at
  BEFORE UPDATE ON public.work_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_docs_updated_at ON public.work_docs;
CREATE TRIGGER trg_work_docs_updated_at
  BEFORE UPDATE ON public.work_docs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_doc_blocks_updated_at ON public.work_doc_blocks;
CREATE TRIGGER trg_work_doc_blocks_updated_at
  BEFORE UPDATE ON public.work_doc_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_channels_updated_at ON public.work_channels;
CREATE TRIGGER trg_work_channels_updated_at
  BEFORE UPDATE ON public.work_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_threads_updated_at ON public.work_threads;
CREATE TRIGGER trg_work_threads_updated_at
  BEFORE UPDATE ON public.work_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_messages_updated_at ON public.work_messages;
CREATE TRIGGER trg_work_messages_updated_at
  BEFORE UPDATE ON public.work_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_notifications_updated_at ON public.work_notifications;
CREATE TRIGGER trg_work_notifications_updated_at
  BEFORE UPDATE ON public.work_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_saved_views_updated_at ON public.work_saved_views;
CREATE TRIGGER trg_work_saved_views_updated_at
  BEFORE UPDATE ON public.work_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_work_tasks_sync_context ON public.work_tasks;
CREATE TRIGGER trg_work_tasks_sync_context
  BEFORE INSERT OR UPDATE ON public.work_tasks
  FOR EACH ROW EXECUTE FUNCTION public.work_sync_project_context();

DROP TRIGGER IF EXISTS trg_work_docs_sync_context ON public.work_docs;
CREATE TRIGGER trg_work_docs_sync_context
  BEFORE INSERT OR UPDATE ON public.work_docs
  FOR EACH ROW EXECUTE FUNCTION public.work_sync_project_context();

DROP TRIGGER IF EXISTS trg_work_channels_sync_context ON public.work_channels;
CREATE TRIGGER trg_work_channels_sync_context
  BEFORE INSERT OR UPDATE ON public.work_channels
  FOR EACH ROW EXECUTE FUNCTION public.work_sync_project_context();

DROP TRIGGER IF EXISTS trg_work_saved_views_sync_context ON public.work_saved_views;
CREATE TRIGGER trg_work_saved_views_sync_context
  BEFORE INSERT OR UPDATE ON public.work_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.work_sync_project_context();

DROP TRIGGER IF EXISTS trg_work_threads_sync_context ON public.work_threads;
CREATE TRIGGER trg_work_threads_sync_context
  BEFORE INSERT OR UPDATE ON public.work_threads
  FOR EACH ROW EXECUTE FUNCTION public.work_sync_thread_context();

DROP TRIGGER IF EXISTS trg_work_doc_blocks_validate_parent ON public.work_doc_blocks;
CREATE TRIGGER trg_work_doc_blocks_validate_parent
  BEFORE INSERT OR UPDATE ON public.work_doc_blocks
  FOR EACH ROW EXECUTE FUNCTION public.work_validate_doc_block_parent();

DROP TRIGGER IF EXISTS trg_work_tasks_validate_source ON public.work_tasks;
CREATE TRIGGER trg_work_tasks_validate_source
  BEFORE INSERT OR UPDATE ON public.work_tasks
  FOR EACH ROW EXECUTE FUNCTION public.work_validate_task_source();

DROP TRIGGER IF EXISTS trg_work_object_relations_validate ON public.work_object_relations;
CREATE TRIGGER trg_work_object_relations_validate
  BEFORE INSERT OR UPDATE ON public.work_object_relations
  FOR EACH ROW EXECUTE FUNCTION public.work_validate_object_relation();

DROP TRIGGER IF EXISTS trg_work_activities_validate ON public.work_activities;
CREATE TRIGGER trg_work_activities_validate
  BEFORE INSERT OR UPDATE ON public.work_activities
  FOR EACH ROW EXECUTE FUNCTION public.work_validate_activity();

DROP TRIGGER IF EXISTS trg_work_notifications_validate ON public.work_notifications;
CREATE TRIGGER trg_work_notifications_validate
  BEFORE INSERT OR UPDATE ON public.work_notifications
  FOR EACH ROW EXECUTE FUNCTION public.work_validate_notification();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.work_team_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_doc_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_object_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_team_spaces_select ON public.work_team_spaces;
CREATE POLICY work_team_spaces_select
ON public.work_team_spaces
FOR SELECT
TO authenticated
USING (
  public.work_can_access_tenant(tenant_id)
  AND (
    visibility = 'internal'
    OR created_by = public.work_current_user_id()
    OR public.work_can_admin_tenant(tenant_id)
  )
);

DROP POLICY IF EXISTS work_team_spaces_insert ON public.work_team_spaces;
CREATE POLICY work_team_spaces_insert
ON public.work_team_spaces
FOR INSERT
TO authenticated
WITH CHECK (
  public.work_can_admin_tenant(tenant_id)
  OR (
    created_by = public.work_current_user_id()
    AND visibility = 'private'
    AND public.work_can_access_tenant(tenant_id)
  )
);

DROP POLICY IF EXISTS work_team_spaces_update ON public.work_team_spaces;
CREATE POLICY work_team_spaces_update
ON public.work_team_spaces
FOR UPDATE
TO authenticated
USING (
  public.work_can_admin_tenant(tenant_id)
  OR (created_by = public.work_current_user_id() AND visibility = 'private')
)
WITH CHECK (
  public.work_can_admin_tenant(tenant_id)
  OR (created_by = public.work_current_user_id() AND visibility = 'private')
);

DROP POLICY IF EXISTS work_team_spaces_delete ON public.work_team_spaces;
CREATE POLICY work_team_spaces_delete
ON public.work_team_spaces
FOR DELETE
TO authenticated
USING (
  public.work_can_admin_tenant(tenant_id)
  OR (created_by = public.work_current_user_id() AND visibility = 'private')
);

DROP POLICY IF EXISTS work_projects_select ON public.work_projects;
CREATE POLICY work_projects_select
ON public.work_projects
FOR SELECT
TO authenticated
USING (public.work_can_read_project(tenant_id, id));

DROP POLICY IF EXISTS work_projects_insert ON public.work_projects;
CREATE POLICY work_projects_insert
ON public.work_projects
FOR INSERT
TO authenticated
WITH CHECK (
  public.work_can_access_tenant(tenant_id)
  AND (
    public.work_can_admin_tenant(tenant_id)
    OR created_by = public.work_current_user_id()
    OR owner_user_id = public.work_current_user_id()
  )
);

DROP POLICY IF EXISTS work_projects_update ON public.work_projects;
CREATE POLICY work_projects_update
ON public.work_projects
FOR UPDATE
TO authenticated
USING (public.work_can_manage_project(tenant_id, id))
WITH CHECK (public.work_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS work_projects_delete ON public.work_projects;
CREATE POLICY work_projects_delete
ON public.work_projects
FOR DELETE
TO authenticated
USING (public.work_can_manage_project(tenant_id, id));

DROP POLICY IF EXISTS work_project_members_select ON public.work_project_members;
CREATE POLICY work_project_members_select
ON public.work_project_members
FOR SELECT
TO authenticated
USING (public.work_can_read_project(tenant_id, project_id));

DROP POLICY IF EXISTS work_project_members_insert ON public.work_project_members;
CREATE POLICY work_project_members_insert
ON public.work_project_members
FOR INSERT
TO authenticated
WITH CHECK (public.work_can_manage_project(tenant_id, project_id));

DROP POLICY IF EXISTS work_project_members_update ON public.work_project_members;
CREATE POLICY work_project_members_update
ON public.work_project_members
FOR UPDATE
TO authenticated
USING (public.work_can_manage_project(tenant_id, project_id))
WITH CHECK (public.work_can_manage_project(tenant_id, project_id));

DROP POLICY IF EXISTS work_project_members_delete ON public.work_project_members;
CREATE POLICY work_project_members_delete
ON public.work_project_members
FOR DELETE
TO authenticated
USING (public.work_can_manage_project(tenant_id, project_id));

DROP POLICY IF EXISTS work_tasks_select ON public.work_tasks;
CREATE POLICY work_tasks_select
ON public.work_tasks
FOR SELECT
TO authenticated
USING (public.work_can_read_context(tenant_id, project_id, 'internal', created_by));

DROP POLICY IF EXISTS work_tasks_insert ON public.work_tasks;
CREATE POLICY work_tasks_insert
ON public.work_tasks
FOR INSERT
TO authenticated
WITH CHECK (public.work_can_write_context(tenant_id, project_id, 'internal', created_by));

DROP POLICY IF EXISTS work_tasks_update ON public.work_tasks;
CREATE POLICY work_tasks_update
ON public.work_tasks
FOR UPDATE
TO authenticated
USING (public.work_can_write_context(tenant_id, project_id, 'internal', created_by))
WITH CHECK (public.work_can_write_context(tenant_id, project_id, 'internal', created_by));

DROP POLICY IF EXISTS work_tasks_delete ON public.work_tasks;
CREATE POLICY work_tasks_delete
ON public.work_tasks
FOR DELETE
TO authenticated
USING (public.work_can_write_context(tenant_id, project_id, 'internal', created_by));

DROP POLICY IF EXISTS work_task_dependencies_select ON public.work_task_dependencies;
CREATE POLICY work_task_dependencies_select
ON public.work_task_dependencies
FOR SELECT
TO authenticated
USING (
  public.work_can_read_object(tenant_id, 'task', predecessor_task_id)
  AND public.work_can_read_object(tenant_id, 'task', successor_task_id)
);

DROP POLICY IF EXISTS work_task_dependencies_insert ON public.work_task_dependencies;
CREATE POLICY work_task_dependencies_insert
ON public.work_task_dependencies
FOR INSERT
TO authenticated
WITH CHECK (
  public.work_can_write_object(tenant_id, 'task', predecessor_task_id)
  AND public.work_can_write_object(tenant_id, 'task', successor_task_id)
);

DROP POLICY IF EXISTS work_task_dependencies_update ON public.work_task_dependencies;
CREATE POLICY work_task_dependencies_update
ON public.work_task_dependencies
FOR UPDATE
TO authenticated
USING (
  public.work_can_write_object(tenant_id, 'task', predecessor_task_id)
  AND public.work_can_write_object(tenant_id, 'task', successor_task_id)
)
WITH CHECK (
  public.work_can_write_object(tenant_id, 'task', predecessor_task_id)
  AND public.work_can_write_object(tenant_id, 'task', successor_task_id)
);

DROP POLICY IF EXISTS work_task_dependencies_delete ON public.work_task_dependencies;
CREATE POLICY work_task_dependencies_delete
ON public.work_task_dependencies
FOR DELETE
TO authenticated
USING (
  public.work_can_write_object(tenant_id, 'task', predecessor_task_id)
  AND public.work_can_write_object(tenant_id, 'task', successor_task_id)
);

DROP POLICY IF EXISTS work_docs_select ON public.work_docs;
CREATE POLICY work_docs_select
ON public.work_docs
FOR SELECT
TO authenticated
USING (public.work_can_read_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_docs_insert ON public.work_docs;
CREATE POLICY work_docs_insert
ON public.work_docs
FOR INSERT
TO authenticated
WITH CHECK (public.work_can_write_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_docs_update ON public.work_docs;
CREATE POLICY work_docs_update
ON public.work_docs
FOR UPDATE
TO authenticated
USING (public.work_can_write_context(tenant_id, project_id, visibility, created_by))
WITH CHECK (public.work_can_write_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_docs_delete ON public.work_docs;
CREATE POLICY work_docs_delete
ON public.work_docs
FOR DELETE
TO authenticated
USING (public.work_can_write_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_doc_blocks_select ON public.work_doc_blocks;
CREATE POLICY work_doc_blocks_select
ON public.work_doc_blocks
FOR SELECT
TO authenticated
USING (public.work_can_read_object(tenant_id, 'doc', doc_id));

DROP POLICY IF EXISTS work_doc_blocks_insert ON public.work_doc_blocks;
CREATE POLICY work_doc_blocks_insert
ON public.work_doc_blocks
FOR INSERT
TO authenticated
WITH CHECK (public.work_can_write_object(tenant_id, 'doc', doc_id));

DROP POLICY IF EXISTS work_doc_blocks_update ON public.work_doc_blocks;
CREATE POLICY work_doc_blocks_update
ON public.work_doc_blocks
FOR UPDATE
TO authenticated
USING (public.work_can_write_object(tenant_id, 'doc', doc_id))
WITH CHECK (public.work_can_write_object(tenant_id, 'doc', doc_id));

DROP POLICY IF EXISTS work_doc_blocks_delete ON public.work_doc_blocks;
CREATE POLICY work_doc_blocks_delete
ON public.work_doc_blocks
FOR DELETE
TO authenticated
USING (public.work_can_write_object(tenant_id, 'doc', doc_id));

DROP POLICY IF EXISTS work_channels_select ON public.work_channels;
CREATE POLICY work_channels_select
ON public.work_channels
FOR SELECT
TO authenticated
USING (public.work_can_read_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_channels_insert ON public.work_channels;
CREATE POLICY work_channels_insert
ON public.work_channels
FOR INSERT
TO authenticated
WITH CHECK (public.work_can_write_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_channels_update ON public.work_channels;
CREATE POLICY work_channels_update
ON public.work_channels
FOR UPDATE
TO authenticated
USING (public.work_can_write_context(tenant_id, project_id, visibility, created_by))
WITH CHECK (public.work_can_write_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_channels_delete ON public.work_channels;
CREATE POLICY work_channels_delete
ON public.work_channels
FOR DELETE
TO authenticated
USING (public.work_can_write_context(tenant_id, project_id, visibility, created_by));

DROP POLICY IF EXISTS work_threads_select ON public.work_threads;
CREATE POLICY work_threads_select
ON public.work_threads
FOR SELECT
TO authenticated
USING (public.work_can_read_thread(tenant_id, id));

DROP POLICY IF EXISTS work_threads_insert ON public.work_threads;
CREATE POLICY work_threads_insert
ON public.work_threads
FOR INSERT
TO authenticated
WITH CHECK (
  public.work_can_write_context(tenant_id, project_id, 'internal', created_by)
  AND (
    channel_id IS NULL
    OR public.work_can_write_object(tenant_id, 'channel', channel_id)
  )
);

DROP POLICY IF EXISTS work_threads_update ON public.work_threads;
CREATE POLICY work_threads_update
ON public.work_threads
FOR UPDATE
TO authenticated
USING (public.work_can_write_thread(tenant_id, id))
WITH CHECK (
  public.work_can_write_context(tenant_id, project_id, 'internal', created_by)
  AND (
    channel_id IS NULL
    OR public.work_can_write_object(tenant_id, 'channel', channel_id)
  )
);

DROP POLICY IF EXISTS work_threads_delete ON public.work_threads;
CREATE POLICY work_threads_delete
ON public.work_threads
FOR DELETE
TO authenticated
USING (public.work_can_write_thread(tenant_id, id));

DROP POLICY IF EXISTS work_messages_select ON public.work_messages;
CREATE POLICY work_messages_select
ON public.work_messages
FOR SELECT
TO authenticated
USING (public.work_can_read_thread(tenant_id, thread_id));

DROP POLICY IF EXISTS work_messages_insert ON public.work_messages;
CREATE POLICY work_messages_insert
ON public.work_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.work_can_write_object(tenant_id, 'thread', thread_id)
  AND author_user_id = public.work_current_user_id()
);

DROP POLICY IF EXISTS work_messages_update ON public.work_messages;
CREATE POLICY work_messages_update
ON public.work_messages
FOR UPDATE
TO authenticated
USING (public.work_can_write_object(tenant_id, 'message', id))
WITH CHECK (public.work_can_write_object(tenant_id, 'message', id));

DROP POLICY IF EXISTS work_messages_delete ON public.work_messages;
CREATE POLICY work_messages_delete
ON public.work_messages
FOR DELETE
TO authenticated
USING (public.work_can_write_object(tenant_id, 'message', id));

DROP POLICY IF EXISTS work_object_relations_select ON public.work_object_relations;
CREATE POLICY work_object_relations_select
ON public.work_object_relations
FOR SELECT
TO authenticated
USING (
  public.work_can_read_object(tenant_id, left_object_type, left_object_id)
  AND public.work_can_read_object(tenant_id, right_object_type, right_object_id)
);

DROP POLICY IF EXISTS work_activities_select ON public.work_activities;
CREATE POLICY work_activities_select
ON public.work_activities
FOR SELECT
TO authenticated
USING (
  (
    object_type IS NULL
    AND public.work_can_access_tenant(tenant_id)
  )
  OR public.work_can_read_object(tenant_id, object_type, object_id)
);

DROP POLICY IF EXISTS work_notifications_select ON public.work_notifications;
CREATE POLICY work_notifications_select
ON public.work_notifications
FOR SELECT
TO authenticated
USING (
  user_id = public.work_current_user_id()
  OR public.work_can_admin_tenant(tenant_id)
);

DROP POLICY IF EXISTS work_notifications_update ON public.work_notifications;
CREATE POLICY work_notifications_update
ON public.work_notifications
FOR UPDATE
TO authenticated
USING (
  user_id = public.work_current_user_id()
  OR public.work_can_admin_tenant(tenant_id)
)
WITH CHECK (
  user_id = public.work_current_user_id()
  OR public.work_can_admin_tenant(tenant_id)
);

DROP POLICY IF EXISTS work_saved_views_select ON public.work_saved_views;
CREATE POLICY work_saved_views_select
ON public.work_saved_views
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.work_current_user_id()
  OR (
    is_shared IS TRUE
    AND public.work_can_read_context(tenant_id, project_id, 'internal', owner_user_id)
  )
);

DROP POLICY IF EXISTS work_saved_views_insert ON public.work_saved_views;
CREATE POLICY work_saved_views_insert
ON public.work_saved_views
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.work_current_user_id()
  AND public.work_can_write_context(tenant_id, project_id, 'internal', owner_user_id)
);

DROP POLICY IF EXISTS work_saved_views_update ON public.work_saved_views;
CREATE POLICY work_saved_views_update
ON public.work_saved_views
FOR UPDATE
TO authenticated
USING (owner_user_id = public.work_current_user_id())
WITH CHECK (owner_user_id = public.work_current_user_id());

DROP POLICY IF EXISTS work_saved_views_delete ON public.work_saved_views;
CREATE POLICY work_saved_views_delete
ON public.work_saved_views
FOR DELETE
TO authenticated
USING (owner_user_id = public.work_current_user_id());

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.work_record_activity(
  p_activity_type text,
  p_object_type text DEFAULT NULL,
  p_object_id uuid DEFAULT NULL,
  p_summary text DEFAULT NULL,
  p_parent_object_type text DEFAULT NULL,
  p_parent_object_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.work_current_user_id();
  v_activity_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â§Ã˜Â·';
  END IF;

  IF NULLIF(btrim(COALESCE(p_activity_type, '')), '') IS NULL THEN
    RAISE EXCEPTION 'activity_type Ã™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨ Ã™â€žÃ˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â§Ã˜Â·';
  END IF;

  IF p_object_type IS NOT NULL
     AND NOT public.work_can_write_object(v_tenant_id, p_object_type, p_object_id) THEN
    RAISE EXCEPTION 'Ã™â€žÃ™Å Ã˜Â³ Ã™â€žÃ˜Â¯Ã™Å Ã™Æ’ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜Â¹Ã™â€žÃ™â€° Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â±';
  END IF;

  IF p_parent_object_type IS NOT NULL
     AND NOT public.work_can_read_object(v_tenant_id, p_parent_object_type, p_parent_object_id) THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â§Ã˜Â· Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­ Ã™â€žÃ™Æ’';
  END IF;

  INSERT INTO public.work_activities (
    tenant_id,
    actor_user_id,
    activity_type,
    object_type,
    object_id,
    parent_object_type,
    parent_object_id,
    summary,
    payload
  )
  VALUES (
    v_tenant_id,
    v_user_id,
    NULLIF(btrim(COALESCE(p_activity_type, '')), ''),
    p_object_type,
    p_object_id,
    p_parent_object_type,
    p_parent_object_id,
    NULLIF(btrim(COALESCE(p_summary, '')), ''),
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'activity_id', v_activity_id,
    'tenant_id', v_tenant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_record_activity(text, text, uuid, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_record_activity(text, text, uuid, text, text, uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_link_objects(
  p_left_object_type text,
  p_left_object_id uuid,
  p_relation_type text,
  p_right_object_type text,
  p_right_object_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.work_current_user_id();
  v_relation_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€žÃ˜Â±Ã˜Â¨Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã˜ÂµÃ˜Â±';
  END IF;

  IF NOT public.work_can_write_object(v_tenant_id, p_left_object_type, p_left_object_id) THEN
    RAISE EXCEPTION 'Ã™â€žÃ™Å Ã˜Â³ Ã™â€žÃ˜Â¯Ã™Å Ã™Æ’ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â¯Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ˜Â£Ã˜Â³Ã˜Â§Ã˜Â³Ã™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨ Ã˜Â±Ã˜Â¨Ã˜Â·Ã™â€¡';
  END IF;

  IF NOT public.work_can_read_object(v_tenant_id, p_right_object_type, p_right_object_id) THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜ÂªÃ˜Â¨Ã˜Â· Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­ Ã™â€žÃ™Æ’ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©';
  END IF;

  INSERT INTO public.work_object_relations (
    tenant_id,
    left_object_type,
    left_object_id,
    relation_type,
    right_object_type,
    right_object_id,
    metadata,
    created_by
  )
  VALUES (
    v_tenant_id,
    p_left_object_type,
    p_left_object_id,
    p_relation_type,
    p_right_object_type,
    p_right_object_id,
    COALESCE(p_metadata, '{}'::jsonb),
    v_user_id
  )
  ON CONFLICT (
    tenant_id, left_object_type, left_object_id, relation_type, right_object_type, right_object_id
  )
  DO UPDATE SET
    metadata = COALESCE(EXCLUDED.metadata, public.work_object_relations.metadata)
  RETURNING id INTO v_relation_id;

  PERFORM public.work_record_activity(
    'object_linked',
    p_left_object_type,
    p_left_object_id,
    'Ã˜ÂªÃ™â€¦ Ã˜Â±Ã˜Â¨Ã˜Â· Ã˜Â¹Ã™â€ Ã˜ÂµÃ˜Â±Ã™Å Ã™â€  Ã™ÂÃ™Å  WorkOS',
    p_right_object_type,
    p_right_object_id,
    jsonb_build_object(
      'relation_id', v_relation_id,
      'relation_type', p_relation_type
    )
  );

  PERFORM public.work_safe_audit(
    v_tenant_id,
    'work.link_objects',
    p_left_object_type,
    p_left_object_id,
    jsonb_build_object(
      'relation_id', v_relation_id,
      'right_object_type', p_right_object_type,
      'right_object_id', p_right_object_id,
      'relation_type', p_relation_type
    ),
    true
  );

  RETURN jsonb_build_object(
    'relation_id', v_relation_id,
    'left_object_type', p_left_object_type,
    'left_object_id', p_left_object_id,
    'relation_type', p_relation_type,
    'right_object_type', p_right_object_type,
    'right_object_id', p_right_object_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_link_objects(text, uuid, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_link_objects(text, uuid, text, text, uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_create_task_from_thread(
  p_thread_id uuid,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_assignee_user_id uuid DEFAULT NULL,
  p_due_at timestamptz DEFAULT NULL,
  p_priority text DEFAULT 'medium'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.work_current_user_id();
  v_thread public.work_threads%ROWTYPE;
  v_task_id uuid;
  v_title text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€žÃ˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â© Ã™â€¦Ã™â€  thread';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã™â€žÃ˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã™â€¦Ã˜Â©';
  END IF;

  SELECT *
    INTO v_thread
  FROM public.work_threads
  WHERE tenant_id = v_tenant_id
    AND id = p_thread_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ™â‚¬ thread Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©';
  END IF;

  IF NOT public.work_can_write_thread(v_tenant_id, p_thread_id) THEN
    RAISE EXCEPTION 'Ã™â€žÃ™Å Ã˜Â³ Ã™â€žÃ˜Â¯Ã™Å Ã™Æ’ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã™â€¡Ã˜Â°Ã˜Â§ thread Ã˜Â¥Ã™â€žÃ™â€° Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â©';
  END IF;

  v_title := COALESCE(
    NULLIF(btrim(COALESCE(p_title, '')), ''),
    NULLIF(btrim(COALESCE(v_thread.title, '')), ''),
    'Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â© Ã˜Â¬Ã˜Â¯Ã™Å Ã˜Â¯Ã˜Â© Ã™â€¦Ã™â€  thread'
  );

  INSERT INTO public.work_tasks (
    tenant_id,
    team_space_id,
    project_id,
    title,
    description,
    task_type,
    status,
    priority,
    source_object_type,
    source_object_id,
    reporter_user_id,
    assignee_user_id,
    created_by,
    due_at,
    metadata
  )
  VALUES (
    v_tenant_id,
    v_thread.team_space_id,
    v_thread.project_id,
    v_title,
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    'action',
    'todo',
    COALESCE(NULLIF(lower(btrim(COALESCE(p_priority, ''))), ''), 'medium'),
    'thread',
    p_thread_id,
    v_user_id,
    p_assignee_user_id,
    v_user_id,
    p_due_at,
    jsonb_build_object('created_from_thread_id', p_thread_id, 'created_via', 'work_create_task_from_thread')
  )
  RETURNING id INTO v_task_id;

  PERFORM public.work_link_objects(
    'task',
    v_task_id,
    'created_from',
    'thread',
    p_thread_id,
    jsonb_build_object('created_via', 'work_create_task_from_thread')
  );

  PERFORM public.work_record_activity(
    'task_created_from_thread',
    'task',
    v_task_id,
    'Ã˜ÂªÃ™â€¦ Ã˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â© Ã™â€¦Ã™â€  thread',
    'thread',
    p_thread_id,
    jsonb_build_object('thread_id', p_thread_id)
  );

  PERFORM public.work_safe_audit(
    v_tenant_id,
    'work.task.created_from_thread',
    'task',
    v_task_id,
    jsonb_build_object('thread_id', p_thread_id),
    true
  );

  RETURN jsonb_build_object(
    'task_id', v_task_id,
    'thread_id', p_thread_id,
    'project_id', v_thread.project_id,
    'team_space_id', v_thread.team_space_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_create_task_from_thread(uuid, text, text, uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_create_task_from_thread(uuid, text, text, uuid, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_create_task_from_doc_action(
  p_doc_id uuid,
  p_action_title text,
  p_action_description text DEFAULT NULL,
  p_block_id uuid DEFAULT NULL,
  p_assignee_user_id uuid DEFAULT NULL,
  p_due_at timestamptz DEFAULT NULL,
  p_priority text DEFAULT 'medium'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.work_current_user_id();
  v_doc public.work_docs%ROWTYPE;
  v_task_id uuid;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€žÃ˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â© Ã™â€¦Ã™â€  Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å  Ã™â€žÃ˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã™â€¦Ã˜Â©';
  END IF;

  SELECT *
    INTO v_doc
  FROM public.work_docs
  WHERE tenant_id = v_tenant_id
    AND id = p_doc_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â©';
  END IF;

  IF NOT public.work_can_write_object(v_tenant_id, 'doc', p_doc_id) THEN
    RAISE EXCEPTION 'Ã™â€žÃ™Å Ã˜Â³ Ã™â€žÃ˜Â¯Ã™Å Ã™Æ’ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€ž Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯ Ã˜Â¥Ã™â€žÃ™â€° Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â©';
  END IF;

  IF p_block_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.work_doc_blocks db
    WHERE db.tenant_id = v_tenant_id
      AND db.id = p_block_id
      AND db.doc_id = p_doc_id
  ) THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ™Ë†Ã™Æ’ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â¯Ã˜Â¯ Ã™â€žÃ˜Â§ Ã™Å Ã™â€ Ã˜ÂªÃ™â€¦Ã™Å  Ã˜Â¥Ã™â€žÃ™â€° Ã™â€ Ã™ÂÃ˜Â³ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯';
  END IF;

  IF NULLIF(btrim(COALESCE(p_action_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Ã˜Â¹Ã™â€ Ã™Ë†Ã˜Â§Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€ Ã˜Â§Ã˜ÂªÃ˜Â¬Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯ Ã™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨';
  END IF;

  INSERT INTO public.work_tasks (
    tenant_id,
    team_space_id,
    project_id,
    title,
    description,
    task_type,
    status,
    priority,
    source_object_type,
    source_object_id,
    reporter_user_id,
    assignee_user_id,
    created_by,
    due_at,
    metadata
  )
  VALUES (
    v_tenant_id,
    v_doc.team_space_id,
    v_doc.project_id,
    NULLIF(btrim(COALESCE(p_action_title, '')), ''),
    NULLIF(btrim(COALESCE(p_action_description, '')), ''),
    'action',
    'todo',
    COALESCE(NULLIF(lower(btrim(COALESCE(p_priority, ''))), ''), 'medium'),
    'doc',
    p_doc_id,
    v_user_id,
    p_assignee_user_id,
    v_user_id,
    p_due_at,
    jsonb_build_object(
      'created_from_doc_id', p_doc_id,
      'source_block_id', p_block_id,
      'created_via', 'work_create_task_from_doc_action'
    )
  )
  RETURNING id INTO v_task_id;

  PERFORM public.work_link_objects(
    'task',
    v_task_id,
    'created_from',
    'doc',
    p_doc_id,
    jsonb_build_object('source_block_id', p_block_id)
  );

  PERFORM public.work_record_activity(
    'task_created_from_doc',
    'task',
    v_task_id,
    'Ã˜ÂªÃ™â€¦ Ã˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã™â€¦Ã™â€¡Ã™â€¦Ã˜Â© Ã™â€¦Ã™â€  Ã˜Â¥Ã˜Â¬Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€ Ã˜Â¯',
    'doc',
    p_doc_id,
    jsonb_build_object('doc_id', p_doc_id, 'source_block_id', p_block_id)
  );

  PERFORM public.work_safe_audit(
    v_tenant_id,
    'work.task.created_from_doc',
    'task',
    v_task_id,
    jsonb_build_object('doc_id', p_doc_id, 'source_block_id', p_block_id),
    true
  );

  RETURN jsonb_build_object(
    'task_id', v_task_id,
    'doc_id', p_doc_id,
    'project_id', v_doc.project_id,
    'team_space_id', v_doc.team_space_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_create_task_from_doc_action(uuid, text, text, uuid, uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_create_task_from_doc_action(uuid, text, text, uuid, uuid, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_archive_object(
  p_object_type text,
  p_object_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.work_current_user_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€žÃ˜Â£Ã˜Â±Ã˜Â´Ã™ÂÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â±';
  END IF;

  IF NOT public.work_can_write_object(v_tenant_id, p_object_type, p_object_id) THEN
    RAISE EXCEPTION 'Ã™â€žÃ™Å Ã˜Â³ Ã™â€žÃ˜Â¯Ã™Å Ã™Æ’ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ˜Â£Ã˜Â±Ã˜Â´Ã™ÂÃ˜Â© Ã™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â±';
  END IF;

  CASE p_object_type
    WHEN 'team_space' THEN
      UPDATE public.work_team_spaces
      SET is_archived = true,
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    WHEN 'project' THEN
      UPDATE public.work_projects
      SET is_archived = true,
          status = 'archived',
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    WHEN 'task' THEN
      UPDATE public.work_tasks
      SET is_archived = true,
          status = 'archived',
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    WHEN 'doc' THEN
      UPDATE public.work_docs
      SET is_archived = true,
          status = 'archived',
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    WHEN 'channel' THEN
      UPDATE public.work_channels
      SET is_archived = true,
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    WHEN 'thread' THEN
      UPDATE public.work_threads
      SET is_archived = true,
          status = 'archived',
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    WHEN 'saved_view' THEN
      UPDATE public.work_saved_views
      SET is_archived = true,
          archived_at = now(),
          archived_by = v_user_id,
          updated_at = now()
      WHERE tenant_id = v_tenant_id
        AND id = p_object_id;
    ELSE
      RAISE EXCEPTION 'Ã™â€ Ã™Ë†Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¯Ã˜Â¹Ã™Ë†Ã™â€¦ Ã™â€žÃ™â€žÃ˜Â£Ã˜Â±Ã˜Â´Ã™ÂÃ˜Â©: %', p_object_type;
  END CASE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â«Ã™Ë†Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨ Ã™â€žÃ˜Â£Ã˜Â±Ã˜Â´Ã™ÂÃ˜ÂªÃ™â€¡';
  END IF;

  PERFORM public.work_record_activity(
    'object_archived',
    p_object_type,
    p_object_id,
    'Ã˜ÂªÃ™â€¦Ã˜Âª Ã˜Â£Ã˜Â±Ã˜Â´Ã™ÂÃ˜Â© Ã˜Â¹Ã™â€ Ã˜ÂµÃ˜Â± Ã™ÂÃ™Å  WorkOS',
    NULL,
    NULL,
    jsonb_build_object('reason', NULLIF(btrim(COALESCE(p_reason, '')), ''))
  );

  PERFORM public.work_safe_audit(
    v_tenant_id,
    'work.archive_object',
    p_object_type,
    p_object_id,
    jsonb_build_object('reason', NULLIF(btrim(COALESCE(p_reason, '')), '')),
    true
  );

  RETURN jsonb_build_object(
    'object_type', p_object_type,
    'object_id', p_object_id,
    'archived', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_archive_object(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_archive_object(text, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.work_mark_notification_read(
  p_notification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_id();
  v_user_id uuid := public.work_current_user_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã™â€¦Ã˜Â³Ã˜Â§Ã˜Â­Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â© Ã™â€žÃ˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â±';
  END IF;

  UPDATE public.work_notifications
  SET read_at = COALESCE(read_at, now()),
      updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND id = p_notification_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ã˜Â§Ã™â€žÃ˜Â¥Ã˜Â´Ã˜Â¹Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â·Ã™â€žÃ™Ë†Ã˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™Ë†Ã˜Â¬Ã™Ë†Ã˜Â¯ Ã˜Â£Ã™Ë† Ã™â€žÃ˜Â§ Ã˜ÂªÃ™â€¦Ã™â€žÃ™Æ’ Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­Ã™Å Ã˜Â© Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â«Ã™â€¡';
  END IF;

  RETURN jsonb_build_object(
    'notification_id', p_notification_id,
    'read', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.work_mark_notification_read(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Read models
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.work_project_home_v
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.tenant_id,
  p.team_space_id,
  p.name,
  p.name_ar,
  p.project_key,
  p.visibility,
  p.status,
  p.priority,
  p.owner_user_id,
  p.lead_user_id,
  p.start_date,
  p.due_date,
  p.completed_at,
  p.is_archived,
  p.created_at,
  p.updated_at,
  COALESCE(pm.member_count, 0) AS member_count,
  COALESCE(task_stats.total_tasks, 0) AS total_tasks,
  COALESCE(task_stats.open_tasks, 0) AS open_tasks,
  COALESCE(task_stats.completed_tasks, 0) AS completed_tasks,
  COALESCE(doc_stats.doc_count, 0) AS doc_count,
  COALESCE(channel_stats.channel_count, 0) AS channel_count,
  COALESCE(thread_stats.thread_count, 0) AS thread_count,
  activity_stats.last_activity_at
FROM public.work_projects p
LEFT JOIN (
  SELECT tenant_id, project_id, COUNT(*) AS member_count
  FROM public.work_project_members
  WHERE membership_status = 'active'
  GROUP BY tenant_id, project_id
) pm
  ON pm.tenant_id = p.tenant_id
 AND pm.project_id = p.id
LEFT JOIN (
  SELECT
    tenant_id,
    project_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status NOT IN ('done', 'cancelled', 'archived')) AS open_tasks,
    COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks
  FROM public.work_tasks
  GROUP BY tenant_id, project_id
) task_stats
  ON task_stats.tenant_id = p.tenant_id
 AND task_stats.project_id = p.id
LEFT JOIN (
  SELECT tenant_id, project_id, COUNT(*) AS doc_count
  FROM public.work_docs
  WHERE is_archived IS FALSE
  GROUP BY tenant_id, project_id
) doc_stats
  ON doc_stats.tenant_id = p.tenant_id
 AND doc_stats.project_id = p.id
LEFT JOIN (
  SELECT tenant_id, project_id, COUNT(*) AS channel_count
  FROM public.work_channels
  WHERE is_archived IS FALSE
  GROUP BY tenant_id, project_id
) channel_stats
  ON channel_stats.tenant_id = p.tenant_id
 AND channel_stats.project_id = p.id
LEFT JOIN (
  SELECT tenant_id, project_id, COUNT(*) AS thread_count
  FROM public.work_threads
  WHERE is_archived IS FALSE
  GROUP BY tenant_id, project_id
) thread_stats
  ON thread_stats.tenant_id = p.tenant_id
 AND thread_stats.project_id = p.id
LEFT JOIN (
  SELECT tenant_id, project_id, MAX(created_at) AS last_activity_at
  FROM public.work_activities
  CROSS JOIN LATERAL (
    VALUES (
      CASE
        WHEN parent_object_type = 'project' THEN parent_object_id
        WHEN object_type = 'project' THEN object_id
        ELSE NULL::uuid
      END
    )
  ) AS project_scope(project_id)
  WHERE project_scope.project_id IS NOT NULL
  GROUP BY tenant_id, project_scope.project_id
) activity_stats
  ON activity_stats.tenant_id = p.tenant_id
 AND activity_stats.project_id = p.id;

CREATE OR REPLACE VIEW public.work_my_work_v
WITH (security_invoker = true)
AS
SELECT
  t.id,
  t.tenant_id,
  t.team_space_id,
  t.project_id,
  p.name AS project_name,
  ts.name AS team_space_name,
  t.title,
  t.description,
  t.task_type,
  t.status,
  t.priority,
  t.assignee_user_id,
  t.reporter_user_id,
  t.start_at,
  t.due_at,
  t.completed_at,
  t.estimate_minutes,
  t.source_object_type,
  t.source_object_id,
  t.is_archived,
  t.created_at,
  t.updated_at,
  CASE
    WHEN t.due_at IS NOT NULL
         AND t.due_at < now()
         AND t.status NOT IN ('done', 'cancelled', 'archived')
      THEN true
    ELSE false
  END AS is_overdue
FROM public.work_tasks t
LEFT JOIN public.work_projects p
  ON p.tenant_id = t.tenant_id
 AND p.id = t.project_id
LEFT JOIN public.work_team_spaces ts
  ON ts.tenant_id = t.tenant_id
 AND ts.id = t.team_space_id
WHERE t.assignee_user_id = public.work_current_user_id()
   OR t.reporter_user_id = public.work_current_user_id();

CREATE OR REPLACE VIEW public.work_recent_activity_v
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.tenant_id,
  a.actor_user_id,
  u.full_name AS actor_name,
  a.activity_type,
  a.object_type,
  a.object_id,
  a.parent_object_type,
  a.parent_object_id,
  a.summary,
  a.payload,
  a.created_at
FROM public.work_activities a
LEFT JOIN public.users u
  ON u.tenant_id = a.tenant_id
 AND u.id = a.actor_user_id;

COMMIT;
