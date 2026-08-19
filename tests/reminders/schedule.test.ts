/**
 * Unit tests for the reminder scheduling helpers.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/reminders/spec.md
 *   § Requirement: Reminder Scheduling, Terminal Status Suppression,
 *                 Email Dispatch (idempotency-key path only)
 *
 * What we test (one assertion per spec scenario):
 *   1. "Initial schedule from application date" — null history → base = applicationDate.
 *   2. "Reschedule on status change"           — base = lastStatusChangeAt.
 *   3. "No reschedule on note addition"        — pure function is idempotent.
 *   4. "Terminal application"                  — returns null when statusIsTerminal.
 *   5. "Re-opened application reschedules"     — same path as #2 but from a terminal state.
 *
 * The SQL trigger + partial index exercise the same contract against the
 * real Supabase project at deploy time; here we lock the pure TS path.
 */
import { describe, expect, it } from "vitest";

import {
  REMINDER_OFFSET_DAYS,
  computeNextReminderAt,
} from "@/lib/reminders/schedule";
import { reminderIdempotencyKey } from "@/lib/email/resend";

const APP_DATE = new Date("2026-08-01T00:00:00.000Z");
const STATUS_CHANGE = new Date("2026-08-10T12:00:00.000Z");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dayBucket = (date: Date) => Math.round(date.getTime() / MS_PER_DAY);

describe("computeNextReminderAt", () => {
  it("uses the application date when no status change has occurred (Scenario: Initial schedule)", () => {
    const next = computeNextReminderAt(APP_DATE, null, false);
    expect(next).not.toBeNull();
    expect(dayBucket(next!)).toBe(
      dayBucket(APP_DATE) + REMINDER_OFFSET_DAYS,
    );
    expect(next?.toISOString().slice(0, 10)).toBe("2026-08-16");
  });

  it("uses the last status change when provided (Scenario: Reschedule)", () => {
    const next = computeNextReminderAt(APP_DATE, STATUS_CHANGE, false);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-08-25");
  });

  it("is idempotent for identical inputs (Scenario: No reschedule on note addition)", () => {
    const a = computeNextReminderAt(APP_DATE, STATUS_CHANGE, false);
    const b = computeNextReminderAt(APP_DATE, STATUS_CHANGE, false);
    expect(a?.toISOString()).toBe(b?.toISOString());
  });

  it("returns null when the status is terminal (Scenario: Terminal application)", () => {
    expect(computeNextReminderAt(APP_DATE, null, true)).toBeNull();
    expect(computeNextReminderAt(APP_DATE, STATUS_CHANGE, true)).toBeNull();
  });

  it("reschedules when a terminal application is re-opened (Scenario: Re-opened application)", () => {
    const reopenedAt = new Date("2026-09-05T08:00:00.000Z");
    const next = computeNextReminderAt(APP_DATE, reopenedAt, false);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-09-20");
  });

  it("exports a constant REMINDER_OFFSET_DAYS = 15 (spec source of truth)", () => {
    expect(REMINDER_OFFSET_DAYS).toBe(15);
  });
});

describe("reminderIdempotencyKey", () => {
  it("produces the same key for two timestamps on the same calendar day", () => {
    const day1Morning = new Date("2026-08-18T00:00:00.000Z");
    const day1Evening = new Date("2026-08-18T23:00:00.000Z");
    const k1 = reminderIdempotencyKey("app-123", day1Morning);
    const k2 = reminderIdempotencyKey("app-123", day1Evening);
    expect(k1).toBe(k2);
    expect(k1).toBe("reminder/app-123/2026-08-18");
  });

  it("produces distinct keys for distinct applications on the same day", () => {
    const day = new Date("2026-08-18T12:00:00.000Z");
    expect(reminderIdempotencyKey("app-A", day)).not.toBe(
      reminderIdempotencyKey("app-B", day),
    );
  });

  it("produces distinct keys for distinct calendar days for the same application", () => {
    const day1 = new Date("2026-08-18T12:00:00.000Z");
    const day2 = new Date("2026-08-19T12:00:00.000Z");
    expect(reminderIdempotencyKey("app-123", day1)).not.toBe(
      reminderIdempotencyKey("app-123", day2),
    );
  });
});
