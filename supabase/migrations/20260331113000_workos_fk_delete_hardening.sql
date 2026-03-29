BEGIN;

-- =============================================================================
-- WorkOS composite FK delete hardening
-- -----------------------------------------------------------------------------
-- Fixes composite foreign keys that previously used ON DELETE SET NULL against
-- (tenant_id, id) pairs, which can try to null tenant_id itself on parent
-- deletion. Restrict SET NULL to the nullable reference column only.
-- =============================================================================

ALTER TABLE public.work_team_spaces
  DROP CONSTRAINT IF EXISTS work_team_spaces_created_by_fkey,
  ADD CONSTRAINT work_team_spaces_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_team_spaces_archived_by_fkey,
  ADD CONSTRAINT work_team_spaces_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

ALTER TABLE public.work_projects
  DROP CONSTRAINT IF EXISTS work_projects_owner_user_fkey,
  ADD CONSTRAINT work_projects_owner_user_fkey
    FOREIGN KEY (tenant_id, owner_user_id)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (owner_user_id),
  DROP CONSTRAINT IF EXISTS work_projects_lead_user_fkey,
  ADD CONSTRAINT work_projects_lead_user_fkey
    FOREIGN KEY (tenant_id, lead_user_id)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (lead_user_id),
  DROP CONSTRAINT IF EXISTS work_projects_created_by_fkey,
  ADD CONSTRAINT work_projects_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_projects_archived_by_fkey,
  ADD CONSTRAINT work_projects_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

ALTER TABLE public.work_project_members
  DROP CONSTRAINT IF EXISTS work_project_members_added_by_fkey,
  ADD CONSTRAINT work_project_members_added_by_fkey
    FOREIGN KEY (tenant_id, added_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (added_by);

ALTER TABLE public.work_tasks
  DROP CONSTRAINT IF EXISTS work_tasks_project_fkey,
  ADD CONSTRAINT work_tasks_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id)
    ON DELETE SET NULL (project_id),
  DROP CONSTRAINT IF EXISTS work_tasks_parent_task_fkey,
  ADD CONSTRAINT work_tasks_parent_task_fkey
    FOREIGN KEY (tenant_id, parent_task_id)
    REFERENCES public.work_tasks(tenant_id, id)
    ON DELETE SET NULL (parent_task_id),
  DROP CONSTRAINT IF EXISTS work_tasks_reporter_user_fkey,
  ADD CONSTRAINT work_tasks_reporter_user_fkey
    FOREIGN KEY (tenant_id, reporter_user_id)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (reporter_user_id),
  DROP CONSTRAINT IF EXISTS work_tasks_assignee_user_fkey,
  ADD CONSTRAINT work_tasks_assignee_user_fkey
    FOREIGN KEY (tenant_id, assignee_user_id)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (assignee_user_id),
  DROP CONSTRAINT IF EXISTS work_tasks_created_by_fkey,
  ADD CONSTRAINT work_tasks_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_tasks_completed_by_fkey,
  ADD CONSTRAINT work_tasks_completed_by_fkey
    FOREIGN KEY (tenant_id, completed_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (completed_by),
  DROP CONSTRAINT IF EXISTS work_tasks_archived_by_fkey,
  ADD CONSTRAINT work_tasks_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

ALTER TABLE public.work_task_dependencies
  DROP CONSTRAINT IF EXISTS work_task_dependencies_created_by_fkey,
  ADD CONSTRAINT work_task_dependencies_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by);

ALTER TABLE public.work_docs
  DROP CONSTRAINT IF EXISTS work_docs_project_fkey,
  ADD CONSTRAINT work_docs_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id)
    ON DELETE SET NULL (project_id),
  DROP CONSTRAINT IF EXISTS work_docs_created_by_fkey,
  ADD CONSTRAINT work_docs_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_docs_updated_by_fkey,
  ADD CONSTRAINT work_docs_updated_by_fkey
    FOREIGN KEY (tenant_id, updated_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (updated_by),
  DROP CONSTRAINT IF EXISTS work_docs_last_edited_by_fkey,
  ADD CONSTRAINT work_docs_last_edited_by_fkey
    FOREIGN KEY (tenant_id, last_edited_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (last_edited_by),
  DROP CONSTRAINT IF EXISTS work_docs_archived_by_fkey,
  ADD CONSTRAINT work_docs_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

ALTER TABLE public.work_doc_blocks
  DROP CONSTRAINT IF EXISTS work_doc_blocks_created_by_fkey,
  ADD CONSTRAINT work_doc_blocks_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_doc_blocks_updated_by_fkey,
  ADD CONSTRAINT work_doc_blocks_updated_by_fkey
    FOREIGN KEY (tenant_id, updated_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (updated_by);

ALTER TABLE public.work_channels
  DROP CONSTRAINT IF EXISTS work_channels_project_fkey,
  ADD CONSTRAINT work_channels_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id)
    ON DELETE SET NULL (project_id),
  DROP CONSTRAINT IF EXISTS work_channels_created_by_fkey,
  ADD CONSTRAINT work_channels_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_channels_archived_by_fkey,
  ADD CONSTRAINT work_channels_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

ALTER TABLE public.work_threads
  DROP CONSTRAINT IF EXISTS work_threads_project_fkey,
  ADD CONSTRAINT work_threads_project_fkey
    FOREIGN KEY (tenant_id, project_id)
    REFERENCES public.work_projects(tenant_id, id)
    ON DELETE SET NULL (project_id),
  DROP CONSTRAINT IF EXISTS work_threads_channel_fkey,
  ADD CONSTRAINT work_threads_channel_fkey
    FOREIGN KEY (tenant_id, channel_id)
    REFERENCES public.work_channels(tenant_id, id)
    ON DELETE SET NULL (channel_id),
  DROP CONSTRAINT IF EXISTS work_threads_created_by_fkey,
  ADD CONSTRAINT work_threads_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by),
  DROP CONSTRAINT IF EXISTS work_threads_resolved_by_fkey,
  ADD CONSTRAINT work_threads_resolved_by_fkey
    FOREIGN KEY (tenant_id, resolved_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (resolved_by),
  DROP CONSTRAINT IF EXISTS work_threads_archived_by_fkey,
  ADD CONSTRAINT work_threads_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

ALTER TABLE public.work_messages
  DROP CONSTRAINT IF EXISTS work_messages_author_user_fkey,
  ADD CONSTRAINT work_messages_author_user_fkey
    FOREIGN KEY (tenant_id, author_user_id)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (author_user_id),
  DROP CONSTRAINT IF EXISTS work_messages_reply_to_message_fkey,
  ADD CONSTRAINT work_messages_reply_to_message_fkey
    FOREIGN KEY (tenant_id, reply_to_message_id)
    REFERENCES public.work_messages(tenant_id, id)
    ON DELETE SET NULL (reply_to_message_id);

ALTER TABLE public.work_object_relations
  DROP CONSTRAINT IF EXISTS work_object_relations_created_by_fkey,
  ADD CONSTRAINT work_object_relations_created_by_fkey
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (created_by);

ALTER TABLE public.work_activities
  DROP CONSTRAINT IF EXISTS work_activities_actor_user_fkey,
  ADD CONSTRAINT work_activities_actor_user_fkey
    FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (actor_user_id);

ALTER TABLE public.work_notifications
  DROP CONSTRAINT IF EXISTS work_notifications_activity_fkey,
  ADD CONSTRAINT work_notifications_activity_fkey
    FOREIGN KEY (tenant_id, activity_id)
    REFERENCES public.work_activities(tenant_id, id)
    ON DELETE SET NULL (activity_id);

ALTER TABLE public.work_saved_views
  DROP CONSTRAINT IF EXISTS work_saved_views_archived_by_fkey,
  ADD CONSTRAINT work_saved_views_archived_by_fkey
    FOREIGN KEY (tenant_id, archived_by)
    REFERENCES public.users(tenant_id, id)
    ON DELETE SET NULL (archived_by);

COMMIT;
