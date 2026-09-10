/**
 * Reminder scheduling — pure helpers.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/reminders/spec.md
 *   § Requirement: Reminder Scheduling, Terminal Status Suppression
 *
 * The pure function is the single source of truth for the 15-day cadence.
 * The SQL function `public.compute_next_reminder_at(...)` in
 * `supabase/migrations/003_reminder_trigger.sql` mirrors it 1-for-1, so
 * the trigger and the TypeScript helpers stay in sync. PR 6 will add
 * Vitest unit tests against the spec scenarios in
 * `openspec/changes/gestjobs-mvp/specs/reminders/spec.md`.
 *
 * Conventions:
 *   - Pure: no I/O, no Date.now(), no globals. Every input is a Date or
 *     a primitive; every output is deterministic.
 *   - Stable: identical inputs produce identical outputs across calls.
 *     This is what makes the SQL mirror trivially testable.
 */

export const REMINDER_OFFSET_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute the next reminder timestamp for an application.
 *
 * Spec scenarios covered (all from `specs/reminders/spec.md`):
 *   - "Initial schedule from application date" — `lastStatusChangeAt` is
 *     `null`, `statusIsTerminal` is `false`. Returns `applicationDate +
 *     15 days`.
 *   - "Reschedule on status change" — `lastStatusChangeAt` is a recent
 *     timestamp, `statusIsTerminal` is `false`. Returns
 *     `lastStatusChangeAt + 15 days`.
 *   - "Terminal application" — `statusIsTerminal` is `true`. Returns
 *     `null` regardless of the other inputs.
 *   - "Re-opened application reschedules" — same shape as "Reschedule";
 *     the trigger fires when the status flips back to non-terminal.
 *
 * Inputs:
 *   - `applicationDate`: the day the user applied (per
 *     `applications.application_date`, a calendar `date`).
 *   - `lastStatusChangeAt`: the timestamp of the most recent history
 *     row. `null` means "no history yet" (the SQL trigger always
 *     supplies this for the row that just got inserted; the `null`
 *     branch exists for symmetry with the pure helper).
 *   - `statusIsTerminal`: the `is_terminal` flag of the application’s
 *     current `status_id`.
 *
 * Output: a `Date` 15 days after the base, or `null` if the status is
 * terminal. The trigger sets `applications.next_reminder_at = NULL`
 * when the result is `null`, which causes the cron route and the
 * dashboard to skip the row entirely.
 */
export function computeNextReminderAt(
  applicationDate: Date,
  lastStatusChangeAt: Date | null,
  statusIsTerminal: boolean,
): Date | null {
  if (statusIsTerminal) {
    return null;
  }

  const base = lastStatusChangeAt ?? applicationDate;
  return new Date(base.getTime() + REMINDER_OFFSET_DAYS * MS_PER_DAY);
}
