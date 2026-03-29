BEGIN;

-- =============================================================================
-- WorkOS activity / validation hardening
-- -----------------------------------------------------------------------------
-- 1) Allow saved_view activity / notification object types because
--    work_archive_object supports archiving saved views.
-- 2) Avoid re-validating object existence on unrelated UPDATEs triggered by
--    foreign-key SET NULL actions during cleanup or parent deletion.
-- =============================================================================

ALTER TABLE public.work_activities
  DROP CONSTRAINT IF EXISTS work_activities_object_type_check,
  DROP CONSTRAINT IF EXISTS work_activities_parent_object_type_check,
  ADD CONSTRAINT work_activities_object_type_check
    CHECK (
      object_type IS NULL
      OR object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message', 'saved_view')
    ),
  ADD CONSTRAINT work_activities_parent_object_type_check
    CHECK (
      parent_object_type IS NULL
      OR parent_object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message', 'saved_view')
    );

ALTER TABLE public.work_notifications
  DROP CONSTRAINT IF EXISTS work_notifications_object_type_check,
  ADD CONSTRAINT work_notifications_object_type_check
    CHECK (
      object_type IS NULL
      OR object_type IN ('team_space', 'project', 'task', 'doc', 'channel', 'thread', 'message', 'saved_view')
    );

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

COMMIT;
