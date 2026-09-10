# Smoke checklist — gestjobs MVP

Phase 6 (PR 6 — Verification + Tooling) deliverable. Every spec scenario from `openspec/changes/gestjobs-mvp/specs/*.md` is mapped to a verifiable check so the user can confirm the implementation works end-to-end against a real Supabase + Resend + Vercel deployment.

> **How to read this document.** Each row pairs a spec scenario with the static unit test (PR 6) or runtime check (post-deploy) that proves it. Static checks run on every PR via `pnpm test` and `pnpm build`. Runtime checks require a provisioned Supabase project, Resend API key, and Vercel cron trigger; walk through them with the maintainer's accounts once and stamp a date in the status column.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Proven by an automated unit test in `tests/**/*.test.ts`. |
| 🔁 | Runs manually after Supabase / Resend / Vercel are provisioned. |
| 🟡 | Blocked by an external dependency — code is ready, just needs the runtime service. |
| ⏭️ | Out of scope for the MVP; not gated. |

---

## Platforms

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Known hostname → resolves to seeded platform | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "resolves a known hostname to its seeded platform" | ✅ |
| Known subdomain (boards.greenhouse.io) → exact | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "resolves a known subdomain (boards.greenhouse.io) exactly" | ✅ |
| Known subdomain (jobs.lever.co) → exact | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "resolves a known subdomain (jobs.lever.co) exactly" | ✅ |
| Unknown hostname → returns null | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "returns null for an unknown hostname" | ✅ |
| Invalid URL → graceful fallback | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "returns null for invalid URLs" + `normalizeHostname` throws are tested separately | ✅ |
| Deeper hostname (uy.computrabajo.com.uy) → suffix match | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "uses the suffix-match branch for deeper hostnames" | ✅ |
| Search seeded platforms on substring | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "returns seeded platforms by case-insensitive substring match (gallito)" | ✅ |
| Search broad Latin-American board | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — "returns Latin-American boards on broad substring (computrabajo)" | ✅ |
| Normalized hostname storage | `specs/platforms/spec.md` | `tests/platforms/infer.test.ts` — normalizeHostname test suite (lowercase + strip `www.`) | ✅ |
| **Custom platform persistence** | `specs/platforms/spec.md` | ⚠️ **Requires Supabase**: log in → create application with custom URL → reload → custom platform is pre-selected in the combobox. | 🔁 |
| **Custom platform id appears in `platforms` table** | `specs/platforms/spec.md` | ⚠️ **Requires Supabase SQL**: `select name, hostname from platforms where is_custom = true and user_id = auth.uid();` after a custom entry. | 🔁 |

---

## Applications

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Validation on create rejects empty company | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationInputSchema > rejects empty company name | ✅ |
| Validation on create rejects empty position | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationInputSchema > rejects empty position title | ✅ |
| Mandatory platform URL — empty rejected | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationPlatformUrlSchema > rejects empty input | ✅ |
| Mandatory platform URL — non-HTTP(S) rejected | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationPlatformUrlSchema > rejects non-HTTP(S) protocols | ✅ |
| Automatic inference | `specs/applications/spec.md` | `tests/platforms/infer.test.ts` — infer resolves known hostname | ✅ |
| Manual fallback (combobox + custom) | `specs/applications/spec.md` | 🔁 Manual: enter a non-seeded URL and confirm the custom platform is upserted | 🔁 |
| Invalid URL rejected (with observable error) | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationPlatformUrlSchema > rejects malformed URLs | ✅ |
| Status change records history | `specs/applications/spec.md` | 🔁 Manual: change status on /applications/[id] and check the timeline shows the new row | 🔁 |
| Terminal status disables reminders | `specs/applications/reminders/spec.md` | `tests/reminders/schedule.test.ts` — "returns null when the status is terminal" | ✅ |
| Paste proposal text | `specs/applications/spec.md` | 🔁 Manual: paste text on the new-application form, save, reopen detail page | 🔁 |
| Upload proposal file (PDF) | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — validateProposalFile > accepts a valid PDF | ✅ |
| Upload proposal file (DOCX) | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — validateProposalFile > accepts a valid DOCX | ✅ |
| Link proposal URL | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationJobProposalUrlSchema > accepts HTTPS URLs | ✅ |
| Invalid proposal URL rejected | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationJobProposalUrlSchema > rejects malformed URLs | ✅ |
| Oversized proposal file rejected | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — validateProposalFile > rejects an oversized file | ✅ |
| Unsupported proposal MIME rejected | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — validateProposalFile > rejects an unsupported MIME type | ✅ |
| Attach resume replaces previous attachment | `specs/applications/spec.md` | 🔁 Manual: attach resume A, attach resume B, only B is shown in detail | 🔁 |
| Attach contact with role | `specs/applications/spec.md` | `tests/validation/schemas.test.ts` — applicationContactAttachSchema > accepts payload with role text | ✅ |
| Remove contact linkage (contact retained) | `specs/applications/spec.md` | 🔁 Manual: link Jane → remove role → Jane still appears in /contacts | 🔁 |
| Delete application cascades history + attachments | `specs/applications/spec.md` | 🔁 Manual: delete an application, check `application_status_history` and `application_resumes` rows are gone | 🔁 |

---

## Contacts

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Create contact | `specs/contacts/spec.md` | `tests/validation/schemas.test.ts` — contactSchema > accepts a contact with only the required name | ✅ |
| Validation on create rejects empty name | `specs/contacts/spec.md` | `tests/validation/schemas.test.ts` — contactSchema > rejects empty name | ✅ |
| Update contact | `specs/contacts/spec.md` | 🔁 Manual: edit contact, save, confirm change persists | 🔁 |
| Delete contact (when unlinked) | `specs/contacts/spec.md` | 🔁 Manual: delete an orphan contact, confirm 200 | 🔁 |
| Reuse contact across applications with independent roles | `specs/contacts/spec.md` | 🔁 Manual: link Jane as "Recruiter" on app A, then "Hiring Manager" on app B, both role rows persist | 🔁 |
| Remove role assignment (contact preserved) | `specs/contacts/spec.md` | 🔁 Manual: remove role from app, contact stays in /contacts | 🔁 |
| Accepts a valid email | `specs/contacts/spec.md` | `tests/validation/schemas.test.ts` — contactSchema > accepts a contact with a valid email | ✅ |
| Rejects an invalid email format | `specs/contacts/spec.md` | `tests/validation/schemas.test.ts` — contactSchema > rejects an invalid email format | ✅ |
| Accepts a valid LinkedIn URL | `specs/contacts/spec.md` | `tests/validation/schemas.test.ts` — contactSchema > accepts a valid LinkedIn URL | ✅ |
| **Cross-user RLS isolation** | `specs/contacts/spec.md` | 🟡 **Requires Supabase SQL**: sign in as user A, create a contact. Sign in as user B, `select name from contacts;` returns no rows from A. | 🔁 |

---

## Resumes

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Upload new resume (PDF) | `specs/resumes/spec.md` | `tests/validation/schemas.test.ts` — resumeLabelSchema + validateResumeFile | ✅ |
| Upload new resume (DOCX) | `specs/resumes/spec.md` | `tests/validation/schemas.test.ts` — validateResumeFile > accepts a DOCX resume under the size limit | ✅ |
| Invalid file type rejected | `specs/resumes/spec.md` | `tests/validation/schemas.test.ts` — validateResumeFile > rejects an executable masquerading as a PDF | ✅ |
| Oversized file rejected | `specs/resumes/spec.md` | `tests/validation/schemas.test.ts` — validateResumeFile > rejects an oversized resume | ✅ |
| Stored under resumes/{user_id}/... | `specs/resumes/spec.md` | 🟡 **Requires Supabase Storage**: after upload, `select storage.objects.name from storage.objects where bucket_id = 'resumes';` shows the object under `resumes/<user-id>/`. | 🔁 |
| Signed URL 200 | `specs/resumes/spec.md` | 🔁 Manual: open the signed URL in a browser, file downloads | 🔁 |
| Cross-user RLS denial for storage | `specs/resumes/spec.md` | 🟡 **Requires Supabase Storage SQL**: sign in as B, attempt `select name from storage.objects where bucket_id = 'resumes';` → 0 rows from A. | 🔁 |
| Attach resume to application | `specs/resumes/spec.md` | 🔁 Manual: attach a resume, detail page shows it | 🔁 |
| Change attached resume | `specs/resumes/spec.md` | 🔁 Manual: attach A, attach B, only B is shown | 🔁 |
| Detach resume | `specs/resumes/spec.md` | 🔁 Manual: detach, detail page shows "No resume attached" | 🔁 |

---

## Reminders

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Initial schedule from application date | `specs/reminders/spec.md` | `tests/reminders/schedule.test.ts` — "uses the application date when no status change has occurred" | ✅ |
| Reschedule on status change | `specs/reminders/spec.md` | `tests/reminders/schedule.test.ts` — "uses the last status change when provided" | ✅ |
| No reschedule on note addition | `specs/reminders/spec.md` | `tests/reminders/schedule.test.ts` — "is idempotent for identical inputs" | ✅ |
| Terminal status suppresses reminder | `specs/reminders/spec.md` | `tests/reminders/schedule.test.ts` — "returns null when the status is terminal" | ✅ |
| Re-opened application reschedules | `specs/reminders/spec.md` | `tests/reminders/schedule.test.ts` — "reschedules when a terminal application is re-opened" | ✅ |
| Pending reminder visible on dashboard | `specs/reminders/spec.md` | 🔁 Manual: seed an overdue application (application_date 16 days ago), visit /dashboard | 🔁 |
| Dismissed reminder hidden | `specs/reminders/spec.md` | 🔁 Manual: after the cron runs once, refresh /dashboard, the dispatched reminder is gone | 🔁 |
| Email sent | `specs/reminders/spec.md` | 🔁 Manual: external cron → POST /api/cron/reminders → check Resend dashboard for the delivered message | 🔁 |
| Email failure logged | `specs/reminders/spec.md` | 🔁 Manual: temporarily set `RESEND_API_KEY=` to an invalid value, run the cron, then check `reminder_dispatches` for an `error` row | 🔁 |
| **Trigger recomputes `next_reminder_at` on status change** | `specs/reminders/spec.md` | 🟡 **Requires Supabase migrations applied**: after a status change, query `select id, next_reminder_at from applications where id = ...` and confirm the timestamp is now `now() + interval '15 days'`. | 🔁 |
| **Partial index rejects same-day successful dispatch** | `specs/reminders/spec.md` | 🟡 **Requires Supabase**: with `error IS NULL`, a second `insert into reminder_dispatches (application_id, sent_at, error) values (...)` for the same calendar day should fail with unique-violation. | 🔁 |
| **Idempotency key stable per `(app, day)`** | `specs/reminders/spec.md` | `tests/reminders/schedule.test.ts` — reminderIdempotencyKey suite (3 cases pass) | ✅ |

---

## Dashboard

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Status counters reflect seeded statuses | `specs/dashboard/spec.md` | 🔁 Manual: create 3 applications in `Applied`, 1 in `Interview`, visit /dashboard, counts show `3` and `1`. | 🔁 |
| Empty state for counters | `specs/dashboard/spec.md` | 🟡 **Requires new user + zero applications**: the `create_default_statuses` trigger creates the 7 statuses on signup, so the literal "no applications" branch is unreachable. The dashboard shows zero-count status cards instead, which the prior verify-report flagged as W1-PR5. | ⏭️ |
| Sorted pending list (asc) | `specs/dashboard/spec.md` | 🔁 Manual: overdue + future-due applications → /dashboard lists in chronological order | 🔁 |
| Empty pending list | `specs/dashboard/spec.md` | 🔁 Manual: when no application has `next_reminder_at <= now()`, /dashboard shows the "No reminders are due…" message | 🔁 |
| Navigate to detail | `specs/dashboard/spec.md` | 🔁 Manual: click any reminder card → /applications/[id] | 🔁 |

---

## Cron (External delivery)

The protected reminder endpoint is **POST-only** by spec (PR 5 task 5.4). Vercel's native cron fires `GET`, so the runtime deploy needs an external cron provider. Selected approach for production: **external cron service** (cron-job.org, GitHub Actions, or any service that supports custom `Authorization: Bearer` headers).

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| POST with valid `CRON_SECRET` returns 200 | `tasks.md` § 5.4 | 🟡 **Requires deploy + `CRON_SECRET` configured**: `curl -X POST -H 'Authorization: Bearer $CRON_SECRET' https://<deploy>/api/cron/reminders` → 200 with `{ ok: true, totals: { sent, skipped, failed }, results: [...] }`. | 🔁 |
| POST without header returns 401 | `tasks.md` § 5.4 | 🟡 **Requires deploy**: omit `Authorization` → 401 with `{ error: "Missing cron authorization." }`. | 🔁 |
| POST with wrong header returns 403 | `tasks.md` § 5.4 | 🟡 **Requires deploy**: send an incorrect token → 403 with `{ error: "Invalid cron secret." }`. | 🔁 |
| POST with no `CRON_SECRET` env returns 503 | `tasks.md` § 5.4 | 🟡 **Requires deploy + unsetting env**: `unset CRON_SECRET`, restart, POST → 503. | 🔁 |
| GET returns 410 | `tasks.md` § 5.4 / 5.8 | 🟡 **Requires deploy**: `curl https://<deploy>/api/cron/reminders` → 410 with `Gone`. | 🔁 |
| PUT/DELETE/PATCH return 405 with `Allow: POST` | `tasks.md` § 5.4 | 🟡 **Requires deploy**: send each verb → 405. | 🔁 |
| Dispatch row written on success | `tasks.md` § 5.4 | 🔁 Manual: after a successful cron run, query `reminder_dispatches` for the application id and confirm `sent_at` + `provider_message_id` rows exist | 🔁 |
| Dispatch row written on failure | `tasks.md` § 5.4 | 🔁 Manual: force a Resend failure, query `reminder_dispatches` for `error IS NOT NULL` rows | 🔁 |
| Dashboard stays unaffected on email failure | `tasks.md` § 5.4 | 🔁 Manual: after a failed dispatch, /dashboard still shows the pending reminder | 🔁 |

---

## Auth

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Magic-link login returns 200 | `tasks.md` § 1.8 | 🔁 Manual: `pnpm dev`, visit /login, enter email, click sign in → redirected with `?status=otp-sent`. Check inbox. | 🔁 |
| `/dashboard` requires auth | `design.md` | 🔁 Manual: sign out, visit /dashboard → redirected to /login | 🔁 |

---

## Database + Migrations

| Scenario | Source | Check | Status |
|----------|--------|-------|--------|
| Migration 001 creates 9 tables + RLS | `tasks.md` § 1.4 | 🟡 **Requires Supabase CLI + project**: `supabase db reset` applies all migrations; `select tablename from pg_tables where schemaname = 'public'` lists the 9 tables. | 🔁 |
| Migration 002 creates `resumes` + `proposals` buckets | `tasks.md` § 1.5 | 🟡 **Requires Supabase**: `select id, public, file_size_limit from storage.buckets` lists both buckets. | 🔁 |
| Migration 003 trigger writes `next_reminder_at` | `tasks.md` § 5.2 | 🟡 **Requires Supabase**: insert a row into `application_status_history`, observe `applications.next_reminder_at` updates. | 🔁 |
| Partial index `reminder_dispatches_app_day_success_idx` exists | `tasks.md` § 5.2 | 🟡 **Requires Supabase**: `select indexname from pg_indexes where tablename = 'reminder_dispatches';` lists it. | 🔁 |

---

## CI / Static checks

| Check | Source | How it runs | Status |
|-------|--------|-------------|--------|
| Frozen `pnpm install` resolves | Phase 6 / CI workflow | `.github/workflows/ci.yml` step `pnpm install --frozen-lockfile` | ✅ |
| TypeScript compiles (`pnpm typecheck`) | Phase 6 / CI workflow | CI step + pre-PR locally | ✅ |
| ESLint exits 0 (`pnpm lint`) | Phase 6 / CI workflow | CI step + pre-PR locally | ✅ |
| Vitest unit tests pass (`pnpm test`) | Phase 6 / CI workflow | CI step + pre-PR locally | ✅ (63 tests across 3 files) |
| Production build succeeds (`pnpm build`) | Phase 6 / CI workflow | CI step + pre-PR locally | ✅ |
| Production audit (`pnpm audit --prod`) | Phase 6 / CI workflow | CI step (added in follow-up) | ✅ (zero vulnerabilities today) |
| Conflict-marker scan | Phase 6 | `git grep -nE "^(<{7}|={7}|>{7})"` returns no matches | ✅ |
| Secret-leak scan | Phase 6 / publication checks 7.4 | `git grep -nE '(sk_live|service_role|RESEND_API_KEY)' -- ':!*.example' ':!.env.example' ':!openspec/**' ':!*.md'` returns no real secrets | ✅ |

---

## How to use this checklist

1. **Before opening the PR for Phase 6 (this slice)**, every ✅ row above is verified by the suite added in this PR.
2. **After Supabase + Resend + Vercel are provisioned**, walk through the 🔁 rows once and stamp each with the date it passed. The PR 6 / Phase 7 / hand-off docs reference this checklist.
3. **Any 🟡 row that remains blocked** beyond the first deploy becomes a Phase 7 (Publication) blocker until resolved.

The checklist intentionally captures every spec scenario (across applications, contacts, dashboard, platforms, reminders, resumes) so it doubles as the regression harness once the runtime services are wired.
