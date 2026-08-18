# Apply Progress — gestjobs-mvp (PR 1 + PR 2 + PR 3 + PR 4)

## Summary

Four autonomous slices of the gestjobs-mvp change are implemented:

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
- **PR 4 (Applications + Status Workflow)** — implemented on `feat/pr4-applications`,
  branched from the latest tracker. Authenticated CRUD, mandatory platform URL
  with URL-first inference + combobox fallback, job proposal capture (text/
  file/URL), status workflow with immutable history, resume + contact
  attachments with detach/delete semantics, RLS-respecting guards.

PR 4 is the slice this round recorded. Static verification passes
(`pnpm typecheck` 0 errors, `pnpm build` 9 routes). Runtime verification
against Supabase remains deferred until a project is provisioned.

## Work Unit Boundary

| Field | Value |
|-------|-------|
| Change | `gestjobs-mvp` |
| Artifact store | openspec |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain (user-selected) |
| Tracker branch | `feature/gestjobs-mvp` |
| Current work unit | Applications + Status Workflow (PR 4 of 7) |
| Branch / base | `feat/pr4-applications` from `origin/feature/gestjobs-mvp` at `6cb13c1` |
| Intended target | `feature/gestjobs-mvp` (independent child PR per chain strategy) |
| Mode | Standard (`strict_tdd=false`, no test runner) |
| Verification | Static (typecheck + production build); runtime deferred |
| Rollback | `git revert` the merge of `feat/pr4-applications` into `feature/gestjobs-mvp`. PR 4 introduces no schema changes; only `application-form.tsx`, the three pages, and a Zod validation module are net-new. |

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

### Phase 4 — Applications + Status Workflow (PR 4, current)

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

## Verification

### Static (PR 4 this batch)

| Check | Command | Result |
|-------|---------|--------|
| Typecheck | `pnpm typecheck` | 0 errors |
| Production build | `pnpm build` | Compiled successfully; 9 routes — `/` (static), `/_not-found` (static), `/applications` (dynamic), `/applications/[id]` (dynamic), `/applications/new` (dynamic, 3.94 kB), `/contacts`, `/login`, `/resumes` (all dynamic). Middleware 65 kB. |

### Runtime (deferred until Supabase is provisioned)

| Check | What it proves |
|-------|----------------|
| Create application with mandatory company name, position title, platform URL | Requires `auth.uid()` and the `create_default_statuses` trigger to have populated the seven defaults |
| Delete application cascades history, application_resumes, application_contacts, application_status_history, reminder_dispatches | Requires nullable FK + `ON DELETE CASCADE` from `001_initial_schema.sql` |
| Change status writes a history row and bumps `updated_at` | Requires the `set_updated_at` trigger on `applications` |
| Detail page lists history rows in changed_at order | Requires `application_status_history` populated per the create + changeStatus flow |
| Resume attach replaces prior attachment, detach removes the join without touching the resume version | Requires PK on `application_resumes.application_id` |
| Contact attach with role persists `(application_id, contact_id, role)`; detach preserves the contact directory row | Requires PK on `application_contacts` |
| Platform URL with known hostname resolves to a seeded platform id | Combines `inferPlatformFromUrl` + `applications.platform_id` FK |
| Platform URL with unknown hostname upserts a custom `(user_id, hostname)` row | Requires the `unique (user_id, hostname)` constraint on `platforms` |
| PDF/DOCX proposal file is stored under `proposals/{user_id}/...` and signed URL returns 200 within 1 hour | Requires the `proposals` bucket + RLS policies from `002_storage_buckets.sql` |
| Cross-user RLS denial for `applications`, `application_status_history`, `application_resumes`, `application_contacts` with two test users | Requires the `is_owner` SQL function + per-table policies already in 001 |

These will be exercised in **PR 6 (Verification + README)** or earlier on
the preview deploy once a Supabase project is provisioned. The static
guarantees — typed `Database['public']['Tables']['applications']` etc,
typed Zod input, transactional action shape — give us the structural
correctness now and the runtime guarantees once the backend is wired.

## Deviations from Design

- **`src/lib/supabase/database.types.ts` continues to be a hand-maintained
  subset.** PR 4 adds `statuses`, `applications`, `application_status_history`,
  `application_contacts`, `application_resumes`. PR 6 will replace the file
  with the output of `supabase gen types` after the migration set runs.
- **`src/app/applications/actions.ts` now hosts nine Server Actions** (the
  original `upsertCustomPlatform` from PR 2 + eight new ones). The file
  stays a single `"use server"` file because the actions share the
  `requireUser`/`redirectWithError`/`firstZodIssue` helpers and the file
  path is the only thing the form components import from.
- **No React state library added.** The new-application form is a small
  client component that holds `platformUrl`, `selectedPlatform`, `urlError`,
  and `showNameField` in local `useState`. Server-rendered list and detail
  pages carry no state. Pulling in a state library for one form would
  dwarf the slice.
- **Combobox UX keeps the PR 2 free-text affordance.** Selecting the
  custom option in the new-application form sets `showNameField = true`
  so the platform name is editable. The server action then normalizes the
  hostname and upserts on `(user_id, hostname)`.
- **The `applications` schema has been added to the typed stub.** Foreign
  key relations point at the real FK names (`platforms`,
  `statuses`, `contacts`, `resumes`) so PR 6 can swap in generated types
  without touching application code.

## Issues Found

### I4 — `next lint` is interactive and the project has no ESLint config

`pnpm lint` calls `next lint`, which is deprecated in Next.js 15 and now
prompts to configure ESLint. The project intentionally defers ESLint
config to PR 6 (per the Phase 1 + 6 task list). For PR 4 verification we
run `pnpm typecheck` and `pnpm build` only. No change in PR 4.

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
unchanged by PR 4.

## Workload / PR Boundary

| Field | Value |
|-------|-------|
| Delivery mode | feature-branch-chain (user-selected) |
| Chain strategy | feature-branch-chain |
| Current work unit | Applications + Status Workflow (PR 4 of 7) |
| Branch | `feat/pr4-applications` (work) → `feature/gestjobs-mvp` (tracker) |
| PR 4 source diff | 5 new files + 2 modified (`src/lib/supabase/database.types.ts`, `src/app/applications/actions.ts`); +2596 / -19 in source files |
| 400-line review budget impact | **Over budget** (≈ 2,575 net lines). The user-selected `feature-branch-chain` strategy chose to keep PR 4 as one autonomous slice; the work-unit-comments pattern splits the diff into five reviewable commits so no single commit exceeds ≈ 750 lines. Each commit is reviewable on its own once the prior commits are merged. |
| Start state | `feature/gestjobs-mvp` at `6cb13c1` (cumulative PR 1 + PR 2 + PR 3 + security reconciliation) |
| Finish state | `feat/pr4-applications` carries authenticated CRUD + status workflow + attachments; `pnpm build` succeeds with 9 routes |
| Verification | Static checks pass; runtime verification runbook deferred to PR 6 |
| Rollback | `git revert` the merge of `feat/pr4-applications` into `feature/gestjobs-mvp`. PR 4 introduces no schema changes (the database.types.ts entry is a hand-maintained stub). Other modules remain deployable. |

## Discovery Save

Project-level learnings saved to Engram under `project=gestjobs`:
- `next lint` is interactive in Next.js 15 — defer to PR 6 with a fresh ESLint config (see I4)
- `pnpm.overrides` field is no longer read by pnpm 9 — migrate to `pnpm-workspace.yaml` (see I5)
- PR 4 work-unit structure (validation+types → actions → list+form → detail → docs) keeps each commit reviewable even when the PR exceeds the 400-line budget
- Server Actions in the same `"use server"` file can share helpers but must export only async functions; types and zod schemas must live elsewhere

## Next Steps for Orchestrator

1. Push `feat/pr4-applications` when explicitly requested; do not open or merge yet.
2. Open the PR against `feature/gestjobs-mvp` when requested. Title suggestion:
   `feat(applications): add CRUD + status workflow + resume/contact attachments`.
   Body should call out the 2,575-line scope (above the 400-line budget by
   user-accepted `feature-branch-chain` strategy) and the static-vs-runtime
   verification split.
3. PR 5 (Reminders + Dashboard) depends on PR 4 (the `applications`,
   `application_status_history`, `application_resumes` tables, and the
   `set_updated_at` trigger). Sequence: merge PR 4 → branch
   `feat/pr5-reminders-dashboard` off the updated tracker.
4. PR 6 must add Vitest unit tests for `inferPlatformFromUrl`,
   `normalizeHostname`, `computeNextReminderAt`, and the new Zod schemas;
   add ESLint config (closes I4); migrate `pnpm.overrides` to
   `pnpm-workspace.yaml` (closes I5); and replace the hand-maintained
   `database.types.ts` with the generated output.
5. Provision Supabase and run the deferred runtime matrix.
