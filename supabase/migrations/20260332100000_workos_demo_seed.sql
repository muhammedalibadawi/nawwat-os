-- ============================================================
-- Minimal WorkOS demo seed (Collaboration layer smoke-ready)
-- ============================================================
-- Goals:
-- - Tenant-scoped: pick one active tenant (from branches)
-- - Idempotent: detect existing seed by deterministic slugs/keys
-- - Small dataset only: 1 TS, 1 project, 1 doc + 3 blocks, 1 channel, 1 thread, 2 messages,
--   2 tasks, 2 relations, 1 activity, 1 notification
-- - No schema changes
--
-- Seed markers naming:
-- - NW-SEED-WORK-SPACE-001
-- - NW-SEED-WORK-PROJECT-001
-- - NW-SEED-WORK-DOC-001
-- - NW-SEED-WORK-CHANNEL-001
-- - NW-SEED-WORK-THREAD-001
-- - NW-SEED-WORK-DOCBLOCK-001..003
-- - NW-SEED-WORK-TASK-001..002
-- - NW-SEED-WORK-RELATION-001..002
-- - NW-SEED-WORK-ACTIVITY-001
-- - NW-SEED-WORK-NOTIF-001

BEGIN;

DO $$
DECLARE
  v_tenant uuid;
  v_branch uuid;
  v_user uuid;

  -- Deterministic seed identifiers (used for idempotency)
  v_space_slug text := 'nw-seed-work-space-001'; -- NW-SEED-WORK-SPACE-001
  v_project_key text := 'NW-SEED-WORK-PROJECT-001';
  v_doc_slug text := 'nw-seed-work-doc-001'; -- NW-SEED-WORK-DOC-001
  v_channel_slug text := 'nw-seed-work-channel-001'; -- NW-SEED-WORK-CHANNEL-001
  v_thread_marker text := 'NW-SEED-WORK-THREAD-001';

  v_block_text_1 text := 'NW-SEED-WORK-DOCBLOCK-001: مقدمة سريعة (Demo)';
  v_block_text_2 text := 'NW-SEED-WORK-DOCBLOCK-002: نقاط توضيحية (Demo)';
  v_block_text_3 text := 'NW-SEED-WORK-DOCBLOCK-003: ملاحظة أخيرة (Demo)';

  v_task_marker_1 text := 'NW-SEED-WORK-TASK-001';
  v_task_marker_2 text := 'NW-SEED-WORK-TASK-002';

  v_relation_marker_1 text := 'NW-SEED-WORK-RELATION-001';
  v_relation_marker_2 text := 'NW-SEED-WORK-RELATION-002';

  v_activity_marker_1 text := 'NW-SEED-WORK-ACTIVITY-001';
  v_notification_marker_1 text := 'NW-SEED-WORK-NOTIF-001';

  -- Selected/created IDs
  v_team_space_id uuid;
  v_project_id uuid;
  v_doc_id uuid;
  v_channel_id uuid;
  v_thread_id uuid;

  v_block_id_1 uuid;
  v_block_id_2 uuid;
  v_block_id_3 uuid;

  v_task_id_1 uuid;
  v_task_id_2 uuid;

  v_relation_id_1 uuid;
  v_relation_id_2 uuid;

  v_activity_id uuid;
  v_notification_id uuid;

  v_message_body_1 text := 'NW-SEED-WORK-MESSAGE-001: رسالة تجريبية أولى';
  v_message_body_2 text := 'NW-SEED-WORK-MESSAGE-002: رسالة تجريبية ثانية';

  v_msg_id_1 uuid;
  v_msg_id_2 uuid;

  v_cnt_spaces int;
  v_cnt_projects int;
  v_cnt_docs int;
  v_cnt_doc_blocks int;
  v_cnt_channels int;
  v_cnt_threads int;
  v_cnt_messages int;
  v_cnt_tasks int;
  v_cnt_relations int;
  v_cnt_activities int;
  v_cnt_notifications int;
BEGIN
  -- Choose one active tenant (safe alignment with existing demo sectors).
  SELECT b.tenant_id, b.id
    INTO v_tenant, v_branch
  FROM public.branches b
  WHERE b.is_active = true
  ORDER BY b.is_default DESC NULLS LAST, b.created_at ASC
  LIMIT 1;

  IF v_tenant IS NULL OR v_branch IS NULL THEN
    RAISE NOTICE 'workos_demo_seed: no active branch/tenant found — skip';
    RETURN;
  END IF;

  -- Pick any active internal user for this tenant (needed for saved views/notifications actor fields).
  SELECT u.id
    INTO v_user
  FROM public.users u
  WHERE u.tenant_id = v_tenant
    AND u.is_active IS TRUE
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'workos_demo_seed: tenant % has no active users — skip', v_tenant;
    RETURN;
  END IF;

  -- ----------------------------
  -- 1) Team Space
  -- ----------------------------
  SELECT id INTO v_team_space_id
  FROM public.work_team_spaces
  WHERE tenant_id = v_tenant
    AND slug = v_space_slug
  LIMIT 1;

  IF v_team_space_id IS NULL THEN
    v_team_space_id := gen_random_uuid();
    INSERT INTO public.work_team_spaces (
      id, tenant_id, slug, name, name_ar, description, icon, color, visibility, is_default,
      created_by, metadata
    ) VALUES (
      v_team_space_id, v_tenant, v_space_slug,
      'NW Demo Team Space', N'مساحة فريق تجريبية (Demo)',
      'Minimal WorkOS seed data for internal testing.', NULL, '#00CFFF', 'internal', true,
      v_user,
      jsonb_build_object('seed_marker', 'NW-SEED-WORK-SPACE-001', 'seed_version', 1)
    );
  END IF;

  -- ----------------------------
  -- 2) Project
  -- ----------------------------
  SELECT id INTO v_project_id
  FROM public.work_projects
  WHERE tenant_id = v_tenant
    AND project_key = v_project_key
  LIMIT 1;

  IF v_project_id IS NULL THEN
    v_project_id := gen_random_uuid();
    INSERT INTO public.work_projects (
      id, tenant_id, team_space_id,
      name, name_ar, project_key, description,
      visibility, status, priority,
      owner_user_id, lead_user_id,
      start_date, due_date,
      created_by, metadata
    ) VALUES (
      v_project_id, v_tenant, v_team_space_id,
      'NW Demo Project', N'مشروع تجريبي (Demo)',
      v_project_key,
      'Minimal collaboration layer seed for WorkOS demo.',
      'internal', 'active', 'medium',
      v_user, v_user,
      CURRENT_DATE, (CURRENT_DATE + 14)::date,
      v_user,
      jsonb_build_object('seed_marker', 'NW-SEED-WORK-PROJECT-001', 'seed_version', 1)
    );
  END IF;

  -- ----------------------------
  -- 3) Doc
  -- ----------------------------
  SELECT id INTO v_doc_id
  FROM public.work_docs
  WHERE tenant_id = v_tenant
    AND slug = v_doc_slug
  LIMIT 1;

  IF v_doc_id IS NULL THEN
    v_doc_id := gen_random_uuid();
    INSERT INTO public.work_docs (
      id, tenant_id, team_space_id, project_id,
      title, slug, summary,
      doc_type, status, visibility,
      current_version,
      created_by, updated_by, last_edited_by,
      metadata
    ) VALUES (
      v_doc_id, v_tenant, v_team_space_id, v_project_id,
      'NW Demo Doc', v_doc_slug,
      'Minimal doc with blocks to validate rendering in the WorkOS UI.',
      'page', 'published', 'internal',
      1,
      v_user, v_user, v_user,
      jsonb_build_object('seed_marker', 'NW-SEED-WORK-DOC-001', 'seed_version', 1)
    );
  END IF;

  -- ----------------------------
  -- 4) Doc Blocks (2-3 blocks)
  -- ----------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public.work_doc_blocks b
    WHERE b.tenant_id = v_tenant
      AND b.doc_id = v_doc_id
      AND b.content->>'text' = v_block_text_1
  ) THEN
    v_block_id_1 := gen_random_uuid();
    INSERT INTO public.work_doc_blocks (
      id, tenant_id, doc_id, block_type, sort_order, content, created_by, updated_by
    ) VALUES (
      v_block_id_1, v_tenant, v_doc_id,
      'paragraph', 0,
      jsonb_build_object('text', v_block_text_1),
      v_user, v_user
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.work_doc_blocks b
    WHERE b.tenant_id = v_tenant
      AND b.doc_id = v_doc_id
      AND b.content->>'text' = v_block_text_2
  ) THEN
    v_block_id_2 := gen_random_uuid();
    INSERT INTO public.work_doc_blocks (
      id, tenant_id, doc_id, block_type, sort_order, content, created_by, updated_by
    ) VALUES (
      v_block_id_2, v_tenant, v_doc_id,
      'heading', 1,
      jsonb_build_object('text', v_block_text_2),
      v_user, v_user
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.work_doc_blocks b
    WHERE b.tenant_id = v_tenant
      AND b.doc_id = v_doc_id
      AND b.content->>'text' = v_block_text_3
  ) THEN
    v_block_id_3 := gen_random_uuid();
    INSERT INTO public.work_doc_blocks (
      id, tenant_id, doc_id, block_type, sort_order, content, created_by, updated_by
    ) VALUES (
      v_block_id_3, v_tenant, v_doc_id,
      'paragraph', 2,
      jsonb_build_object('text', v_block_text_3),
      v_user, v_user
    );
  END IF;

  -- ----------------------------
  -- 5) Channel
  -- ----------------------------
  SELECT id INTO v_channel_id
  FROM public.work_channels
  WHERE tenant_id = v_tenant
    AND slug = v_channel_slug
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    v_channel_id := gen_random_uuid();
    INSERT INTO public.work_channels (
      id, tenant_id, team_space_id, project_id,
      name, slug, description,
      channel_type, visibility,
      created_by, last_message_at,
      metadata
    ) VALUES (
      v_channel_id, v_tenant, v_team_space_id, v_project_id,
      'NW Demo Channel', v_channel_slug,
      'Demo channel to validate thread/message rendering.',
      'team', 'internal',
      v_user, now(),
      jsonb_build_object('seed_marker', 'NW-SEED-WORK-CHANNEL-001', 'seed_version', 1)
    );
  END IF;

  -- ----------------------------
  -- 6) Thread
  -- ----------------------------
  SELECT id INTO v_thread_id
  FROM public.work_threads
  WHERE tenant_id = v_tenant
    AND channel_id = v_channel_id
    AND COALESCE(metadata->>'seed_marker', '') = v_thread_marker
  LIMIT 1;

  IF v_thread_id IS NULL THEN
    v_thread_id := gen_random_uuid();
    INSERT INTO public.work_threads (
      id, tenant_id, team_space_id, project_id, channel_id,
      title, thread_type, status,
      created_by, metadata,
      last_message_at
    ) VALUES (
      v_thread_id, v_tenant, v_team_space_id, v_project_id, v_channel_id,
      'NW Demo Thread', 'discussion', 'open',
      v_user,
      jsonb_build_object('seed_marker', v_thread_marker, 'seed_version', 1),
      now()
    );
  END IF;

  -- ----------------------------
  -- 7) Messages (2 messages)
  -- ----------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public.work_messages m
    WHERE m.tenant_id = v_tenant
      AND m.thread_id = v_thread_id
      AND m.body = v_message_body_1
  ) THEN
    v_msg_id_1 := gen_random_uuid();
    INSERT INTO public.work_messages (
      id, tenant_id, thread_id, author_user_id,
      message_type, body, body_json, attachments
    ) VALUES (
      v_msg_id_1, v_tenant, v_thread_id, v_user,
      'comment',
      v_message_body_1,
      '{}'::jsonb,
      '[]'::jsonb
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.work_messages m
    WHERE m.tenant_id = v_tenant
      AND m.thread_id = v_thread_id
      AND m.body = v_message_body_2
  ) THEN
    v_msg_id_2 := gen_random_uuid();
    INSERT INTO public.work_messages (
      id, tenant_id, thread_id, author_user_id,
      message_type, body, body_json, attachments
    ) VALUES (
      v_msg_id_2, v_tenant, v_thread_id, v_user,
      'comment',
      v_message_body_2,
      '{}'::jsonb,
      '[]'::jsonb
    );
  END IF;

  -- ----------------------------
  -- 8) Tasks (2 tasks)
  -- ----------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public.work_tasks t
    WHERE t.tenant_id = v_tenant
      AND t.project_id = v_project_id
      AND COALESCE(t.metadata->>'seed_marker', '') = v_task_marker_1
  ) THEN
    v_task_id_1 := gen_random_uuid();
    INSERT INTO public.work_tasks (
      id, tenant_id, team_space_id, project_id,
      parent_task_id,
      title, description,
      task_type,
      status, priority,
      source_object_type, source_object_id,
      assignee_user_id, reporter_user_id,
      created_by,
      estimate_minutes,
      start_at, due_at,
      metadata
    ) VALUES (
      v_task_id_1, v_tenant, v_team_space_id, v_project_id,
      NULL,
      'NW Demo Task 1', N'مهمة تجريبية 1',
      'task',
      'todo', 'medium',
      NULL, NULL,
      v_user, v_user,
      v_user,
      30,
      now(), now() + interval '7 days',
      jsonb_build_object('seed_marker', v_task_marker_1, 'seed_version', 1)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.work_tasks t
    WHERE t.tenant_id = v_tenant
      AND t.project_id = v_project_id
      AND COALESCE(t.metadata->>'seed_marker', '') = v_task_marker_2
  ) THEN
    v_task_id_2 := gen_random_uuid();
    INSERT INTO public.work_tasks (
      id, tenant_id, team_space_id, project_id,
      parent_task_id,
      title, description,
      task_type,
      status, priority,
      source_object_type, source_object_id,
      assignee_user_id, reporter_user_id,
      created_by,
      estimate_minutes,
      start_at, due_at,
      metadata
    ) VALUES (
      v_task_id_2, v_tenant, v_team_space_id, v_project_id,
      NULL,
      'NW Demo Task 2', N'مهمة تجريبية 2',
      'task',
      'todo', 'high',
      NULL, NULL,
      v_user, v_user,
      v_user,
      45,
      now(), now() + interval '10 days',
      jsonb_build_object('seed_marker', v_task_marker_2, 'seed_version', 1)
    );
  END IF;

  -- ----------------------------
  -- 9) Relations (1-2 relations)
  -- ----------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public.work_object_relations r
    WHERE r.tenant_id = v_tenant
      AND COALESCE(r.metadata->>'seed_marker', '') = v_relation_marker_1
  ) THEN
    v_relation_id_1 := gen_random_uuid();
    INSERT INTO public.work_object_relations (
      id, tenant_id,
      left_object_type, left_object_id,
      relation_type,
      right_object_type, right_object_id,
      metadata, created_by
    ) VALUES (
      v_relation_id_1, v_tenant,
      'project', v_project_id,
      'references',
      'doc', v_doc_id,
      jsonb_build_object('seed_marker', v_relation_marker_1, 'seed_version', 1),
      v_user
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.work_object_relations r
    WHERE r.tenant_id = v_tenant
      AND COALESCE(r.metadata->>'seed_marker', '') = v_relation_marker_2
  ) THEN
    v_relation_id_2 := gen_random_uuid();
    INSERT INTO public.work_object_relations (
      id, tenant_id,
      left_object_type, left_object_id,
      relation_type,
      right_object_type, right_object_id,
      metadata, created_by
    ) VALUES (
      v_relation_id_2, v_tenant,
      'doc', v_doc_id,
      'discussed_in',
      'channel', v_channel_id,
      jsonb_build_object('seed_marker', v_relation_marker_2, 'seed_version', 1),
      v_user
    );
  END IF;

  -- ----------------------------
  -- 10) Activity (simple)
  -- ----------------------------
  SELECT a.id INTO v_activity_id
  FROM public.work_activities a
  WHERE a.tenant_id = v_tenant
    AND a.payload->>'seed_marker' = v_activity_marker_1
  LIMIT 1;

  IF v_activity_id IS NULL THEN
    v_activity_id := gen_random_uuid();
    INSERT INTO public.work_activities (
      id, tenant_id,
      actor_user_id,
      activity_type,
      object_type, object_id,
      parent_object_type, parent_object_id,
      summary, payload
    ) VALUES (
      v_activity_id, v_tenant,
      v_user,
      'object_linked',
      NULL, NULL,
      'project', v_project_id,
      'NW-SEED-WORK-ACTIVITY-001: ربط عناصر تجريبية للمشروع.',
      jsonb_build_object('seed_marker', v_activity_marker_1, 'seed_version', 1)
    );
  END IF;

  -- ----------------------------
  -- 11) Notification (simple, best-effort)
  -- ----------------------------
  SELECT n.id INTO v_notification_id
  FROM public.work_notifications n
  WHERE n.tenant_id = v_tenant
    AND n.user_id = v_user
    AND n.payload->>'seed_marker' = v_notification_marker_1
  LIMIT 1;

  IF v_notification_id IS NULL THEN
    v_notification_id := gen_random_uuid();
    INSERT INTO public.work_notifications (
      id, tenant_id, user_id,
      activity_id,
      object_type, object_id,
      notification_type,
      title, body,
      payload,
      read_at, dismissed_at
    ) VALUES (
      v_notification_id, v_tenant, v_user,
      v_activity_id,
      'project', v_project_id,
      'seed_demo',
      'NW-SEED-WORK-NOTIF-001',
      'تنبيه تجريبي بسيط لعرض صندوق الوارد في WorkOS.',
      jsonb_build_object('seed_marker', v_notification_marker_1, 'seed_version', 1),
      NULL, NULL
    );
  END IF;

  -- ----------------------------
  -- Smoke validation (DB-level counts)
  -- ----------------------------
  SELECT
    (SELECT COUNT(*) FROM public.work_team_spaces ts WHERE ts.tenant_id = v_tenant AND ts.slug = v_space_slug),
    (SELECT COUNT(*) FROM public.work_projects p WHERE p.tenant_id = v_tenant AND p.project_key = v_project_key),
    (SELECT COUNT(*) FROM public.work_docs d WHERE d.tenant_id = v_tenant AND d.slug = v_doc_slug),
    (SELECT COUNT(*) FROM public.work_doc_blocks b WHERE b.tenant_id = v_tenant AND b.doc_id = v_doc_id),
    (SELECT COUNT(*) FROM public.work_channels c WHERE c.tenant_id = v_tenant AND c.slug = v_channel_slug),
    (SELECT COUNT(*) FROM public.work_threads t WHERE t.tenant_id = v_tenant AND t.channel_id = v_channel_id),
    (SELECT COUNT(*) FROM public.work_messages m WHERE m.tenant_id = v_tenant AND m.thread_id = v_thread_id),
    (SELECT COUNT(*) FROM public.work_tasks t WHERE t.tenant_id = v_tenant AND t.project_id = v_project_id AND COALESCE(t.metadata->>'seed_marker','') IN (v_task_marker_1, v_task_marker_2)),
    (SELECT COUNT(*) FROM public.work_object_relations r WHERE r.tenant_id = v_tenant AND COALESCE(r.metadata->>'seed_marker','') IN (v_relation_marker_1, v_relation_marker_2)),
    (SELECT COUNT(*) FROM public.work_activities a WHERE a.tenant_id = v_tenant AND a.payload->>'seed_marker' = v_activity_marker_1),
    (SELECT COUNT(*) FROM public.work_notifications n WHERE n.tenant_id = v_tenant AND n.user_id = v_user AND n.payload->>'seed_marker' = v_notification_marker_1)
  INTO
    v_cnt_spaces, v_cnt_projects, v_cnt_docs, v_cnt_doc_blocks,
    v_cnt_channels, v_cnt_threads, v_cnt_messages,
    v_cnt_tasks, v_cnt_relations, v_cnt_activities, v_cnt_notifications;

  RAISE NOTICE 'workos_demo_seed smoke (tenant=%):
    team_spaces=%,
    projects=%,
    docs=%,
    doc_blocks=%,
    channels=%,
    threads=%,
    messages=%,
    tasks=%,
    relations=%,
    activities=%,
    notifications=%',
    v_tenant, v_cnt_spaces, v_cnt_projects, v_cnt_docs, v_cnt_doc_blocks,
    v_cnt_channels, v_cnt_threads, v_cnt_messages,
    v_cnt_tasks, v_cnt_relations, v_cnt_activities, v_cnt_notifications;

END $$;

COMMIT;

