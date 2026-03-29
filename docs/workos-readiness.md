# WorkOS Core Readiness

## Applied migrations
- `supabase/migrations/20260331100000_workos_core_foundation.sql`
- `supabase/migrations/20260331113000_workos_fk_delete_hardening.sql`
- `supabase/migrations/20260331120000_workos_activity_validation_hardening.sql`

## What was validated
- Core `work_*` tables exist on the linked Supabase project.
- Core RPCs are callable on the linked Supabase project.
- Read models/views are queryable under tenant-scoped RLS.
- Minimal end-to-end smoke flow succeeded:
  - create team space
  - create project
  - create doc + block
  - create channel + thread + message
  - create task from thread
  - create task from doc action
  - link objects
  - record activity
  - archive saved view
  - mark notification as read

## Important fixes discovered during remote validation
- Composite foreign keys using `(tenant_id, id)` with `ON DELETE SET NULL` needed a follow-up hardening migration so parent deletes do not attempt to null `tenant_id`.
- `work_archive_object('saved_view', ...)` required `saved_view` to be allowed in `work_activities` and `work_notifications` object type checks.
- Validation triggers on activities/notifications/object relations now skip re-validation when reference columns did not change, which prevents cleanup failures during FK-driven `SET NULL` updates.

## Ready-for-UI status
- WorkOS core schema is now applied remotely.
- RLS works for same-tenant authenticated usage with a valid `public.users` row and `user_roles` membership.
- The next phase can safely start building UI on top of the verified RPCs and views.

## Operational note
- During PostgREST writes to `work_threads`, using a separate `insert` then `select` is more reliable than chaining `insert().select()` in a single call for smoke-style flows.
