-- supabase/migrations/003_reminder_trigger.sql
-- Reminder scheduling — SQL function + trigger that recomputes
-- `applications.next_reminder_at` whenever an `application_status_history`
-- row is inserted.
--
-- Spec reference:
--   openspec/changes/gestjobs-mvp/specs/reminders/spec.md
--   § Requirement: Reminder Scheduling, Terminal Status Suppression
--
-- Design reference:
--   design.md § "Reminder contract" — describes the SQL function
--   `compute_next_reminder_at(...)` and the trigger that calls it.
--
-- The pure SQL helper mirrors `computeNextReminderAt(...)` in
-- `src/lib/reminders/schedule.ts` 1-for-1, so the TypeScript helper and
-- the SQL trigger share the same definition. PR 6 will add Vitest unit
-- tests that exercise the TS helper against the spec scenarios.
--
-- Why a trigger on `application_status_history` (not on `applications`):
--   1. Every status change inserts a history row (PR 4 `changeApplicationStatus`).
--      The trigger fires automatically for both initial creation (the
--      `from_status_id: null` row) and subsequent changes.
--   2. The trigger reads `application_date` and the latest `changed_at`
--      from the same set of rows the dashboard will read, so the
--      canonical source for "next reminder" is the history table.
--   3. Adding an `applications` after-update trigger would risk
--      double-firing (once for the `status_id` update, once via the
--      history row), so the history-side trigger is the right hook.

-- ============================================================================
-- Pure SQL helper — mirrors `src/lib/reminders/schedule.ts`.
-- Immutable so the planner can fold calls into the surrounding query.
-- ============================================================================
create or replace function public.compute_next_reminder_at(
  application_date date,
  last_status_change_at timestamptz,
  status_is_terminal boolean
)
returns timestamptz
language sql
immutable
as $$
  select case
    when status_is_terminal then null::timestamptz
    else coalesce(last_status_change_at, application_date::timestamptz)
         + interval '15 days'
  end;
$$;

-- ============================================================================
-- Trigger function — fires AFTER INSERT on `application_status_history`.
-- Looks up the application’s current status, computes the next reminder,
-- and writes the result to `applications.next_reminder_at`.
-- ============================================================================
create or replace function public.handle_application_status_history_change()
returns trigger
language plpgsql
as $$
declare
  v_application_date date;
  v_is_terminal boolean;
begin
  select a.application_date, s.is_terminal
    into v_application_date, v_is_terminal
    from public.applications a
    join public.statuses s on s.id = a.status_id
    where a.id = new.application_id;

  -- Application row vanished between insert and trigger (concurrent
  -- delete). The history row stays around for audit; we just skip the
  -- reminder update.
  if v_application_date is null then
    return new;
  end if;

  update public.applications
    set next_reminder_at = public.compute_next_reminder_at(
      v_application_date,
      new.changed_at,
      v_is_terminal
    )
    where id = new.application_id;

  return new;
end;
$$;

create trigger compute_next_reminder_at_on_status_history
  after insert on public.application_status_history
  for each row execute function public.handle_application_status_history_change();

-- ============================================================================
-- Idempotency guard for `reminder_dispatches` — at most one successful
-- dispatch per (application, calendar day). Failed dispatches (error NOT
-- NULL) are intentionally excluded so a transient Resend failure on
-- Monday does not block Tuesday’s send.
-- ============================================================================
create unique index if not exists reminder_dispatches_app_day_success_idx
  on public.reminder_dispatches (application_id, ((sent_at AT TIME ZONE 'UTC')::date))
  where error is null;
