# Apply Progress — gestjobs-mvp (PR 1 + PR 2 + PR 3 + PR 4 + PR 5)

## Summary

Five autonomous slices of the gestjobs-mvp change are implemented:

- **PR 1 (Foundation)** — merged into `feature/gestjobs-mvp`. Next.js 15 + Supabase
  Auth scaffold, Postgres schema with RLS, storage buckets, global platform
  seed, magic-link login, session middleware.
- **PR 2 (Platforms)** — merged into `feature/gestjobs-mvp`. Hostname inference
  utilities, client platform directory, accessible ARIA combobox with free-text
  fallback, `upsertCustomPlatform` Server Action, plus the `@supabase/ssr`
  0.5.2 → 0.12.4 typecheck fix.
- **PR 3 (Contacts + Resumes)** — merged into `feature/gestjobs-mvp`. Authenticated
  contact directory CRUD, private versioned resume uploads with SHA-256
  metadata, 1-hour signed download URLs.
- **PR 4 (Applications + Status Workflow)** — merged into `feature/gestjobs-mvp`
  via GitHub PR #6. Authenticated CRUD, mandatory platform URL with URL-first
  inference + combobox fallback, job proposal capture (text/file/URL), status
  workflow with immutable history, resume + contact attachments with
  detach/delete semantics, RLS-respecting guards.
- **PR 5 (Reminders + Dashboard)** — implemented on `feat/pr5-reminders-dashboard`,
  branched from the latest tracker (`5567a43` — the Supabase project-ref docs
  commit that followed the merge of PR #6). 15-day reminder scheduling via a
  pure TS function + SQL trigger, idempotent Resend email sender, protected
  POST cron endpoint, Vercel cron schedule, dashboard with status counters and
  a sorted pending-reminders list.

PR 5 is the slice this round recorded. Static verification passes
(`pnpm install --frozen-lockfile`, `pnpm typecheck` 0 errors, `pnpm build`
10 routes, `pnpm audit --prod` zero findings). Inline sanity-check passes
for the pure `computeNextReminderAt` helper (5/5 spec scenarios) and the
`reminderIdempotencyKey` helper (3/3). Runtime verification against
Supabase + Resend + Vercel cron remains deferred until those services are
provisioned.

## Work Unit Boundary

| Field | Value |
|-------|-------|
| Change | `gestjobs-mvp` |
| Artifact store | openspec |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain (user-selected) |
| Tracker branch | `feature/gestjobs-mvp` |
| Current work unit | Reminders + Dashboard (PR 5 of 7) |
| Branch / base | `feat/pr5-reminders-dashboard` from `feature/gestjobs-mvp` at `5567a43` |
| Intended target | `feature/gestjobs-mvp` (independent child PR per chain strategy) |
| Mode | Standard (`strict_tdd=false`, no test runner) |
| Verification | Static (typecheck + production build + lockfile install + audit) + pure-function inline sanity-checks; runtime deferred |
| Rollback | `git revert` the merge of `feat/pr5-reminders-dashboard` into `feature/gestjobs-mvp`. The cron route returns 410 on GET and 405 on non-POST (matching the PR 5 rollback note). The migration `003_reminder_trigger.sql` and the unique partial index on `reminder_dispatches` must be reverted alongside the application code; reverting the merge commit without dropping the migration leaves the trigger dangling. |

## Completed Tasks (Cumulative)

### Phase 1 — Foundation (PR 1, merged)

Tasks 1.1–1.11 complete: bootstrap, env template, Supabase SSR clients,
schema/RLS, storage buckets/RLS, seed, database types stub, magic-link
login, middleware, static verification, and rollback record.

### Phase 2 — Platforms (PR 2, merged)

Tasks 2.1–2.6 complete: hostname inference, client seed directory,
accessible combobox, authenticated custom persistence, static
verification with runtime deferred, and rollback record. PR 2 plus the
critical `@supabase/ssr` upgrade are merged into the tracker.

### Phase 3 — Contacts + Resumes (PR 3, merged)

Tasks 3.1–3.6 complete: authenticated contact CRUD, private versioned
resume uploads with SHA-256/size metadata, validated PDF/DOCX with
10 MB domain limit and 11 MB transport limit, 1-hour signed download
URLs, and independent rollback. PR 3 is merged into the tracker.

### Phase 4 — Applications + Status Workflow (PR 4, merged into tracker via PR #6)

- 4.1 done — `src/lib/validation/application.ts`: Zod schemas for create/update,
  status change, resume/contact attach/detach, proposal URL validation, and
  10 MB PDF/DOCX proposal file validation.
- 4.2 done — `src/app/applications/page.tsx`: list view grouped by status
  (terminal statuses segregated), joins `applications × statuses × platforms`.
- 4.3 done — `src/app/applications/new/{page.tsx, application-form.tsx}`:
  client form that combines URL-first inference, the PlatformCombobox from
  PR 2, and the job-proposal text/file/URL inputs.
- 4.4 done — `src/app/applications/actions.ts` now hosts
  `createApplication`, `updateApplication`, `deleteApplication` Server Actions
  with FK cascade + RLS, plus the cross-tenant file compensation pattern.
- 4.5 done — `src/app/applications/[id]/page.tsx`: detail view with status
  timeline, attached resume (1-hour signed URL), linked contacts with roles,
  job proposal (text/url/file), and danger zone for delete.
- 4.6 done — `changeApplicationStatus`: snapshot of current status, update
  `applications.status_id` (the trigger bumps `updated_at`), insert history
  row, rollback if history insert fails.
- 4.7 done — `attachResume` / `detachResume` and `attachContact` / `detachContact`:
  resume replaces on PK (`application_id`); contact join preserves the
  directory row.
- 4.8 done (static) — `pnpm typecheck` 0 errors, `pnpm build` succeeds with
  9 routes (3 net-new dynamic routes for `/applications`,
  `/applications/[id]`, `/applications/new`). Runtime matrix deferred.
- 4.9 done — independent rollback documented.

### Phase 5 — Reminders + Dashboard (PR 5, current)

- 5.1 done — `src/lib/reminders/schedule.ts`: pure
  `computeNextReminderAt(applicationDate, lastStatusChangeAt, statusIsTerminal)`
  returning `Date | null`. The 15-day offset is exported as
  `REMINDER_OFFSET_DAYS` so the SQL helper can mirror it without drift.
- 5.2 done — `supabase/migrations/003_reminder_trigger.sql`: pure SQL function
  `public.compute_next_reminder_at(application_date, last_status_change_at, status_is_terminal)` mirrors the TS helper 1-for-1 (immutable, deterministic). Trigger
  function `public.handle_application_status_history_change()` fires AFTER
  INSERT on `application_status_history`, looks up the application's
  current status, computes the next reminder, and writes
  `applications.next_reminder_at`. Unique partial index
  `reminder_dispatches_app_day_success_idx` on `(application_id, sent_at::date)`
  WHERE `error IS NULL` provides DB-level idempotency for the cron path.
- 5.3 done — `src/lib/email/resend.ts`: `sendReminderEmail(supabase, ctx, now)`
  uses the Resend SDK with `idempotencyKey = reminderIdempotencyKey(applicationId, now)`
  so a same-day retry produces one provider message id. Returns a
  discriminated union (`sent` / `skipped` / `failed`) so the cron route
  stays linear. The body renders inline HTML + plain text with the company,
  position, status, and platform URL. Success/failure are written to
  `reminder_dispatches` on every path; transient Resend failures do not
  surface to the dashboard.
- 5.4 done — `src/app/api/cron/reminders/route.ts`: POST-only route guarded by
  `CRON_SECRET` (Authorization Bearer header; `X-Cron-Secret` accepted as
  fallback). Uses the service-role client (bypasses RLS) to enumerate
  due applications, loads the reminder context, sends via
  `sendReminderEmail`, and writes the dispatch row. Returns a JSON summary
  with `{ sent, skipped, failed, due }` counts and per-application results.
  GET returns 410 (matches the PR 5 rollback note); non-POST methods return
  405 with `Allow: POST`.
- 5.5 done — `vercel.json` registers the daily `0 9 * * *` cron at
  `/api/cron/reminders`.
- 5.6 done — `src/app/dashboard/page.tsx`: RSC that joins
  `statuses × applications` for counters (zero-count statuses still
  surface via the user-scoped status catalog from the
  `create_default_statuses` trigger) and lists pending reminders sorted
  by `next_reminder_at ASC`. "Dismissed" rows — applications with a
  successful dispatch for today — are filtered out via the same
  `reminder_dispatches` query the cron uses. Each reminder card links to
  the application detail page; the "Platform URL" anchor uses
  `onClick={stopPropagation}` so it does not navigate to the detail page.
- 5.7 done (static) — `pnpm install --frozen-lockfile` ✅, `pnpm typecheck`
  ✅ (0 errors), `pnpm build` ✅ (10 routes — `/dashboard` and
  `/api/cron/reminders` added; other routes unchanged), `pnpm audit --prod`
  ✅ (no known vulnerabilities). Inline sanity-check passes for
  `computeNextReminderAt` (5/5 spec scenarios) and `reminderIdempotencyKey`
  (3/3). Runtime verification — cron POST against a real Supabase project,
  dashboard query against a real DB, Resend dispatch against a real API key
  — deferred until those services are provisioned.
- 5.8 done — rollback path documented. The cron route returns 410 on GET so
  a reverted deployment still responds coherently. The migration
  `003_reminder_trigger.sql` and the unique partial index must be reverted
  alongside the application code; a `git revert` of the merge commit
  without dropping the migration leaves the trigger and the index in
  place.

## PR 4 Security and Data Boundaries

- Every action re-checks `supabase.auth.getUser()` and refuses to write if
  `auth.uid()` is null.
- Writes additionally filter by `user_id` (or join through `applications`)
  so a leaked id can never escalate to a cross-user write.
- Proposal files are uploaded to `proposals/{user_id}/{application_id}-{filename}`
  after the application row exists, so `ON DELETE CASCADE` removes the join
  rows. `deleteApplication` then removes the storage object explicitly to
  keep the bucket tidy.
- Job proposal file validation reuses the same PDF/DOCX, 10 MB domain limit
  the resumes module enforces.
- Platform URL is re-validated against the HTTP(S) URL rules on the server,
  even though the client also validates; the URL is the source of truth for
  the normalized hostname stored on the custom platform row.
- If a platform URL infers to a known platform, the action uses the
  resolved id; otherwise it upserts a custom `(user_id, hostname)` row
  with the normalized hostname before inserting the application.
- Status changes are no-op-safe: same status → no duplicate history row.
- Resume attachments use the `application_id` PK on `application_resumes`,
  so a second attach replaces the previous join. The underlying `resumes`
  version is never auto-deleted.
- Contact join rows are detached by `(application_id, contact_id, role)`,
  so the same contact can be reused across applications with independent
  roles; the contact directory row is never deleted.

## PR 4 Work-Unit Commits

Branch `feat/pr4-applications` (4 work-unit commits + 1 docs commit):

1. `feat(applications): add Zod validation and database types for PR4` — new
   `src/lib/validation/application.ts` (230 lines) and additive shapes on
   `src/lib/supabase/database.types.ts` (`statuses`, `applications`,
   `application_status_history`, `application_contacts`, `application_resumes`).
2. `feat(applications): add authenticated CRUD and status workflow actions` —
   `src/app/applications/actions.ts` (+748/-18) carrying the remaining eight
   Server Actions plus the cross-tenant file compensation pattern.
3. `feat(applications): add list view and new application form` — three new
   files in `src/app/applications/{page.tsx, new/page.tsx, new/application-form.tsx}`.
4. `feat(applications): add detail view with status history and attachments` —
   `src/app/applications/[id]/page.tsx` (638 lines).
5. `docs(applications): mark PR4 tasks complete and record apply-progress` —
   `openspec/changes/gestjobs-mvp/{tasks.md, apply-progress.md}`.

## PR 5 Security and Data Boundaries

- The cron route accepts POST only. GET returns 410 (matches the PR 5
  rollback note in `tasks.md`); non-POST methods return 405 with
  `Allow: POST`. The route never trusts the body without a valid
  `CRON_SECRET` header — the secret is compared in constant time against
  the env value, and the env value is required at module load (503 if
  missing, not a silent skip).
- The cron route uses the **service-role** Supabase client
  (`SUPABASE_SERVICE_ROLE_KEY`). RLS does not apply, so the route must
  enforce its own "due = `next_reminder_at <= now()` AND status
  non-terminal AND no successful dispatch today" filter. This filter is
  implemented in two steps inside `selectDueApplications`: first the
  `applications` × `statuses` join; second a `reminder_dispatches`
  `IN (...)` query to drop "dismissed" rows. Both queries return an
  empty array on error rather than throwing, so a transient DB blip
  cannot crash the cron.
- Email dispatch is **non-throwing**. Resend SDK errors are caught and
  written to `reminder_dispatches.error`; the cron summary records
  `{ status: "failed", error }` so the operator can investigate without
  paging through logs. The dashboard stays unaffected on email failure
  (spec scenario "Email failure logged").
- Idempotency is enforced at three layers:
  1. **DB unique partial index** `reminder_dispatches_app_day_success_idx`
     on `(application_id, sent_at::date)` WHERE `error IS NULL`. A second
     successful dispatch on the same calendar day is rejected by the DB.
  2. **Resend `idempotencyKey`** `reminder/{application_id}/{YYYY-MM-DD}`.
     A same-day retry produces the same provider message id.
  3. **Cron "dismissed" predicate** in `selectDueApplications` and
     `loadPendingReminders`. Both queries read
     `reminder_dispatches` for today and skip rows that already have a
     successful dispatch, so the dashboard does not show the same
     reminder twice after the cron runs.
- The trigger function `public.handle_application_status_history_change()`
  is `LANGUAGE plpgsql` (not `SECURITY DEFINER`); RLS on `applications`
  enforces that the calling user owns the row. The function reads the
  current status via a join and updates `applications.next_reminder_at`;
  the row-level `auth.uid()` check is implicit.
- The dashboard is an authenticated RSC: it calls
  `supabase.auth.getUser()` and redirects to `/login` if absent. RLS on
  `applications`, `statuses`, `platforms`, and `reminder_dispatches`
  scopes every read to `auth.uid()`. No service-role key is used on
  the dashboard.
- `loadReminderContext` re-checks `application.user_id === userId` before
  returning the context. The cron route iterates over
  `user_id` directly from the due-applications query, so the check is
  defensive (the service-role client already returns every due row, and
  a leaked `userId` could not escalate to a cross-user write because
  RLS does not apply — but the check keeps the helper testable and
  consistent with the per-action guards the rest of the codebase uses).

## PR 5 Work-Unit Commits

Branch `feat/pr5-reminders-dashboard` (5 work-unit commits + 1 docs commit):

1. `feat(reminders): add pure computeNextReminderAt and reminder_dispatches types` —
   `src/lib/reminders/schedule.ts` (66 lines) and additive shape on
   `src/lib/supabase/database.types.ts` (`reminder_dispatches`). The TS helper
   is exercised by an inline sanity-check (5/5 spec scenarios pass).
2. `feat(reminders): add SQL trigger to recompute next_reminder_at` —
   `supabase/migrations/003_reminder_trigger.sql` (100 lines): pure SQL helper
   `public.compute_next_reminder_at(...)` mirrors the TS helper; trigger
   function `public.handle_application_status_history_change()` fires on
   `application_status_history` INSERT; unique partial index
   `reminder_dispatches_app_day_success_idx` provides DB idempotency.
3. `feat(reminders): add Resend email sender with idempotent dispatch logging` —
   `src/lib/email/resend.ts` (387 lines), `package.json` (`+resend ^6.20.0`),
   `pnpm-lock.yaml` (+40/-12, transitive deps for the SDK).
4. `feat(cron): add protected reminders endpoint and Vercel cron schedule` —
   `src/app/api/cron/reminders/route.ts` (267 lines) and `vercel.json`.
5. `feat(dashboard): add status counters and pending reminders list` —
   `src/app/dashboard/page.tsx` (339 lines), an authenticated RSC that
   joins `statuses × applications` for counters and lists pending reminders
   sorted by `next_reminder_at ASC`.
6. `docs(reminders): mark PR5 tasks complete and record apply-progress` —
   `openspec/changes/gestjobs-mvp/{tasks.md, apply-progress.md}`.

## Verification

### Static (PR 5 this batch)

| Check | Command | Result |
|-------|---------|--------|
| Lockfile install | `pnpm install --frozen-lockfile` | `Lockfile is up to date, resolution step is skipped; Already up to date`. Resend SDK + 3 transitive deps resolved (`@stablelib/base64`, `fast-sha256`, `postal-mime`). |
| Typecheck | `pnpm typecheck` | 0 errors |
| Production build | `pnpm build` | Compiled successfully in 8.9s; 10 routes — `/` (static), `/_not-found` (static), `/api/cron/reminders` (dynamic), `/applications` (dynamic), `/applications/[id]` (dynamic), `/applications/new` (dynamic, 3.94 kB), `/contacts` (dynamic), `/dashboard` (dynamic), `/login` (dynamic), `/resumes` (dynamic). Middleware 93.1 kB. |
| Security audit | `pnpm audit --prod` | No known vulnerabilities found |
| Pure-function sanity (computeNextReminderAt) | `node --experimental-strip-types .tmp-reminder-check.mts` | 5/5 pass (Initial schedule, Reschedule on status change, Terminal returns null, Re-opened application, No reschedule on note addition) |
| Pure-function sanity (reminderIdempotencyKey) | `node --experimental-strip-types .tmp-resend-check.mts` | 3/3 pass (stable key per app+day, distinct apps → distinct keys, distinct days → distinct keys) |
| Conflict markers | `git grep -nE "^(<{7}|={7}|>{7})"` | No matches |

### Runtime (deferred until Supabase + Resend + Vercel are provisioned)

| Check | What it proves | Pre-conditions |
|-------|----------------|----------------|
| `POST /api/cron/reminders` with `CRON_SECRET` returns 200 + summary | Auth guard, due-applications filter, dispatch loop | Supabase project + `SUPABASE_SERVICE_ROLE_KEY` + Resend `RESEND_API_KEY` |
| `POST /api/cron/reminders` without header returns 401 | Auth guard rejects missing secret | None |
| `POST /api/cron/reminders` with wrong header returns 403 | Auth guard rejects mismatched secret | None |
| `GET /api/cron/reminders` returns 410 | POST-only policy + rollback semantics | None |
| Trigger recomputes `next_reminder_at` after a status change | `handle_application_status_history_change()` writes the new value | Migrations applied to Supabase |
| Terminal status sets `next_reminder_at = NULL` | Pure helper + trigger | Migrations applied; a status with `is_terminal = true` |
| `reminder_dispatches` unique partial index rejects same-day successful dispatch | DB-level idempotency | Migrations applied |
| Email body renders with company, position, status, platform URL, reminder date | `renderReminderEmail` template | Resend API key |
| Dashboard counters include zero-count statuses | `statuses` LEFT JOIN `applications` aggregate | Migrations applied + at least one user with statuses |
| Dashboard pending list sorted by `next_reminder_at ASC` and excludes dismissed rows | `loadPendingReminders` order + dismissed filter | Migrations applied + cron has run at least once |
| Cross-user RLS denial for `applications` × `reminder_dispatches` join | Existing RLS policies from `001_initial_schema.sql` | Two test users via Supabase Auth |

These will be exercised in **PR 6 (Verification + README)** or earlier on
the preview deploy once Supabase + Resend are provisioned. The static
guarantees — typed `Database['public']['Tables']['reminder_dispatches']`
shape, typed Zod input on `applicationInputSchema`, pure-function
contract verified inline — give us the structural correctness now and
the runtime guarantees once the backend is wired.

## Deviations from Design

- **`src/lib/supabase/database.types.ts` continues to be a hand-maintained
  subset.** PR 4 added `statuses`, `applications`, `application_status_history`,
  `application_contacts`, `application_resumes`; PR 5 adds
  `reminder_dispatches`. PR 6 will replace the file with the output of
  `supabase gen types` after the migration set runs.
- **`src/lib/email/resend.ts` accepts `AnySupabaseClient` instead of the
  typed `SupabaseClient<Database>`.** The cron route uses the service-role
  client without the typed schema (it bypasses RLS anyway), while the
  typed server client from `src/lib/supabase/server.ts` carries the
  `Database` stub. Accepting `any` and casting at the call site lets
  both shapes flow through `loadReminderContext` and `recordDispatch`
  without a circular import on `database.types.ts`. The behaviour
  (`.from("applications").select(...)`, `.from("reminder_dispatches")
  .insert(...)`, `auth.admin.getUserById(...)`) is the same on both
  shapes; an ESLint `no-explicit-any` disable is annotated at the type
  alias so the comment survives a future lint pass.
- **The email body is inline HTML + plain text, not a React Email
  template.** Resend supports React Email via an optional peer dep
  (`@react-email/render`); pulling it in for a single reminder body
  would dwarf PR 5's footprint. The template is plain enough (heading,
  paragraph, link) that plain HTML is the lower-overhead choice. PR 6
  may swap in a React Email component if more transactional emails land.
- **The dashboard does not add a navigation header to the public landing
  page.** The current `/` is a marketing page with a single "Sign in to
  get started" call to action. PR 5 adds `/dashboard` as the post-login
  landing destination; a global nav bar linking `/dashboard`,
  `/applications`, `/contacts`, `/resumes` is deferred until the
  user-visible IA is finalized (likely PR 6).
- **Vercel cron fires GET, but the route is POST-only by spec.** The
  `vercel.json` cron config registers the schedule, but Vercel's
  default cron trigger sends GET. The route intentionally returns 410
  on GET (matches the PR 5 rollback note). A deploy-time wrapper —
  either a serverless function that proxies GET to POST with the
  secret, or an external cron service like cron-job.org or GitHub
  Actions — is required for the cron to actually fire emails.
  Documented under "Issues Found" below.
- **The trigger function is `LANGUAGE plpgsql`, not `SECURITY DEFINER`.**
  The `create_default_statuses()` trigger uses `SECURITY DEFINER` because
  it writes on behalf of `auth.users` (a system table). The reminder
  trigger only reads and writes `public.applications`, which the
  calling user already has RLS access to. The default `SECURITY INVOKER`
  is therefore correct and avoids accidentally widening permissions.

## Issues Found

### I4 — `next lint` is interactive and the project has no ESLint config

`pnpm lint` calls `next lint`, which is deprecated in Next.js 15 and now
prompts to configure ESLint. The project intentionally defers ESLint
config to PR 6 (per the Phase 1 + 6 task list). For PR 5 verification we
run `pnpm typecheck` and `pnpm build` only. No change in PR 5.

### I5 — `pnpm.overrides` warning continues from PR 1

The `pnpm` field in `package.json` is no longer read by pnpm 9; the
declared `postcss` and `sharp` overrides are silently ignored. The
installed versions still pass the security baseline (Next.js 15.5.21,
postcss 8.5.26) so the warning is informational. A PR 6 housekeeping
task should migrate the overrides to `pnpm-workspace.yaml` or remove
them entirely.

### I6 — `serverActions` experiment flag still required

`next.config.mjs` keeps the `experimental.serverActions.bodySizeLimit: "11mb"`
override from PR 3 so multipart proposal uploads fit. The file is reused
unchanged by PR 5.

### I7 — Vercel cron GET vs POST-only route

`vercel.json` registers the daily 09:00 UTC cron at
`/api/cron/reminders`, but Vercel's native cron trigger fires GET. The
spec for task 5.4 says **POST only**, so the route returns 410 on GET
and 405 on non-POST methods. Deploy-time the user has three options to
actually fire the cron:

1. **External cron service** (cron-job.org, GitHub Actions on
   `schedule: cron: "0 9 * * *"`, EasyCron, etc.) configured to send
   `POST /api/cron/reminders` with header `Authorization: Bearer
   <CRON_SECRET>`.
2. **Vercel middleware / proxy function** that listens on GET at the
   cron path, then issues an internal POST to the same route with the
   secret. The `vercel.json` cron entry would point at the proxy.
3. **Loosen the spec** to accept GET (with the secret in a header),
   which means dropping the "POST only" guard from `tasks.md` § 5.4.

Option 1 is the lowest-risk path and does not require app changes. PR 6
can add a one-paragraph "Operational notes" section to the README that
documents the chosen approach once the user picks one.

### I8 — `Database` stub still missing the `reminder_dispatches` foreign-key `referencedRelation` cross-link

The hand-maintained `database.types.ts` lists the relationship as
`referencedRelation: "applications"`, which matches the FK in
`001_initial_schema.sql` (`reminder_dispatches.application_id references
applications(id) on delete cascade`). PR 6's `supabase gen types` run
will confirm; no code change required.

## Workload / PR Boundary

| Field | Value |
|-------|-------|
| Delivery mode | feature-branch-chain (user-selected) |
| Chain strategy | feature-branch-chain |
| Current work unit | Reminders + Dashboard (PR 5 of 7) |
| Branch | `feat/pr5-reminders-dashboard` (work) → `feature/gestjobs-mvp` (tracker) |
| PR 5 source diff | 7 new files + 2 modified (`package.json`, `src/lib/supabase/database.types.ts`) + 1 new config (`vercel.json`); +1239 / -1 in tracked files |
| 400-line review budget impact | **Over budget** (≈ 1,239 net lines). The user-selected `feature-branch-chain` strategy chose to keep PR 5 as one autonomous slice; the work-unit-commits pattern splits the diff into six reviewable commits so no single commit exceeds ≈ 430 lines. |
| Start state | `feature/gestjobs-mvp` at `5567a43` (cumulative PR 1 + PR 2 + PR 3 + PR 4 + Supabase project-ref docs) |
| Finish state | `feat/pr5-reminders-dashboard` carries reminders scheduling + Resend dispatch + cron route + dashboard; `pnpm build` succeeds with 10 routes; static verification + pure-function sanity-checks pass |
| Verification | Static checks pass (install + typecheck + build + audit); runtime runbook deferred to PR 6 |
| Rollback | `git revert` the merge of `feat/pr5-reminders-dashboard` into `feature/gestjobs-mvp`. PR 5 introduces one migration (`003_reminder_trigger.sql`) and a unique partial index; both must be reverted alongside the application code. The cron route returns 410 on GET so a reverted deployment still responds coherently. |

## Discovery Save

Project-level learnings saved to Engram under `project=gestjobs`:
- PR 4 work-unit structure (validation+types → actions → list+form → detail → docs) keeps each commit reviewable even when the PR exceeds the 400-line budget
- Server Actions in the same `"use server"` file can share helpers but must export only async functions; types and zod schemas must live elsewhere
- PR 5 pure-function helper (`computeNextReminderAt`) plus a mirrored SQL function (`public.compute_next_reminder_at`) gives us two implementations of the same spec contract — one for the trigger, one for testing. Keeping them 1-for-1 avoids the "TS says one thing, SQL says another" drift that bites reminder logic after a refactor.
- The Resend SDK's `idempotencyKey` plus a partial unique index on `reminder_dispatches` is the right three-layer defense for "send at most one email per application per day": DB rejects duplicate inserts, Resend deduplicates retries, the cron + dashboard both filter already-dispatched rows out of their queries.
- Vercel cron GET-only is a real constraint when the spec mandates POST; documented I7 so the deployment-time decision is explicit.

## Next Steps for Orchestrator

1. Push `feat/pr5-reminders-dashboard` when explicitly requested; do not open or merge yet.
2. Open the PR against `feature/gestjobs-mvp` when requested. Title suggestion:
   `feat(reminders): add 15-day reminder scheduling + Resend email + cron + dashboard`.
   Body should call out the 1,239-line scope (above the 400-line budget by
   user-accepted `feature-branch-chain` strategy), the static-vs-runtime
   verification split, and the Vercel cron GET-vs-POST constraint (I7).
3. PR 6 depends on PR 5 (the new `reminder_dispatches` schema, the
   `003_reminder_trigger.sql` migration, and the cron route all live on
   the PR 5 branch). Sequence: merge PR 5 → branch `feat/pr6-verification`
   off the updated tracker.
4. PR 6 must add Vitest unit tests for `inferPlatformFromUrl`,
   `normalizeHostname`, `computeNextReminderAt`, `reminderIdempotencyKey`,
   and the new Zod schemas; add ESLint config (closes I4); migrate
   `pnpm.overrides` to `pnpm-workspace.yaml` (closes I5); and replace
   the hand-maintained `database.types.ts` with the generated output.
5. PR 6 should also document the chosen cron strategy (external cron
   service vs Vercel middleware proxy vs loosened spec) in the README's
   "Operational notes" section — I7 needs a deploy-time decision.
6. Provision Supabase + Resend and run the deferred runtime matrix
    (cron POST 200, dashboard query, email dispatch).

## Cron Strategy Decision

The user selected an external cron provider as the deployment strategy. The
provider must call `POST /api/cron/reminders` daily at `09:00 UTC` with
`Authorization: Bearer $CRON_SECRET`. Vercel's native cron configuration was
removed because it sends `GET`, while the protected application endpoint is
intentionally POST-only.
