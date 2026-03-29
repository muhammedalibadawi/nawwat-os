-- WorkOS core sanity checks

-- Tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'work_team_spaces',
    'work_projects',
    'work_project_members',
    'work_tasks',
    'work_task_dependencies',
    'work_docs',
    'work_doc_blocks',
    'work_channels',
    'work_threads',
    'work_messages',
    'work_object_relations',
    'work_activities',
    'work_notifications',
    'work_saved_views'
  )
ORDER BY table_name;

-- Views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'work_project_home_v',
    'work_my_work_v',
    'work_recent_activity_v'
  )
ORDER BY table_name;

-- RPCs
SELECT proname
FROM pg_proc p
JOIN pg_namespace n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'work_create_task_from_thread',
    'work_create_task_from_doc_action',
    'work_link_objects',
    'work_archive_object',
    'work_record_activity',
    'work_mark_notification_read'
  )
ORDER BY proname;

-- Basic smoke-read checks after logging in as a valid tenant user
SELECT * FROM public.work_project_home_v ORDER BY updated_at DESC LIMIT 10;
SELECT * FROM public.work_my_work_v ORDER BY updated_at DESC LIMIT 10;
SELECT * FROM public.work_recent_activity_v ORDER BY created_at DESC LIMIT 20;

-- Quick RLS checks
SELECT COUNT(*) AS team_spaces_visible FROM public.work_team_spaces;
SELECT COUNT(*) AS projects_visible FROM public.work_projects;
SELECT COUNT(*) AS tasks_visible FROM public.work_tasks;
SELECT COUNT(*) AS docs_visible FROM public.work_docs;
SELECT COUNT(*) AS channels_visible FROM public.work_channels;
SELECT COUNT(*) AS threads_visible FROM public.work_threads;
