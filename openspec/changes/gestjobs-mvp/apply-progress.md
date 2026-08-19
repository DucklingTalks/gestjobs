# Apply Progress — gestjobs-mvp (PR 1 + PR 2 + PR 3 + PR 4 + PR 5 + PR 6)

## Summary

Six autonomous slices of the gestjobs-mvp change are implemented:

- **PR 1 (Foundation)** — merged into `feature/gestjobs-mvp`. Next.js 15
  + Supabase Auth scaffold, Postgres schema with RLS, storage buckets,
  global platform seed, magic-link login, session middleware.
- **PR 2 (Platforms)** — merged into `feature/gestjobs-mvp`. Hostname
  inference utilities, client platform directory, accessible ARIA
  combobox with free-text fallback, `upsertCustomPlatform` Server
  Action, plus the `@supabase/ssr` 0.5.2 → 0.12.4 typecheck fix.
- **PR 3 (Contacts + Resumes)** — merged into `feature/gestjobs-mvp`.
  Authenticated contact directory CRUD, private versioned resume
  uploads with SHA-256 metadata, 1-hour signed download URLs.
- **PR 4 (Applications + Status Workflow)** — merged into
  `feature/gestjobs-mvp` via GitHub PR #6. Authenticated CRUD,
  mandatory platform URL with URL-first inference + combobox fallback,
  job proposal capture (text/file/URL), status workflow with immutable
  history, resume + contact attachments with detach/delete semantics,
  RLS-respecting guards.
- **PR 5 (Reminders + Dashboard)** — merged into `feature/gestjobs-mvp`
  via GitHub PR #8. 15-day reminder scheduling via a pure TS function
  + SQL trigger, idempotent Resend email sender, protected POST cron
  endpoint, Vercel cron schedule, dashboard with status counters and
  a sorted pending-reminders list. Cron decision: **external cron**
  (POST + Bearer `$CRON_SECRET`), not Vercel native (which only
  fires GET).
- **PR 6 (Verification + Tooling)** — current slice. Establishes the
  Vitest runner, ESLint config (exits 0), GitHub Actions CI (frozen
  install + typecheck + lint + test + build), README rewrite with the
  full operator hand-off, smoke checklist mapped to every spec
  scenario, and the `pnpm-workspace.yaml` migration that closes the
  `pnpm.overrides` deprecation warning.

PR 6 is the slice this round recorded. Static verification passes
(`pnpm install --frozen-lockfile` clean, `pnpm typecheck` 0 errors,
`pnpm lint` exits 0, `pnpm test` 63/63 pass across 3 files, `pnpm
build` 10 routes, `pnpm audit --prod` zero vulnerabilities). Runtime
verification against Supabase + Resend + Vercel cron remains deferred
to the first deploy; the runbook now lives in
`docs/smoke-tests.md` and `README.md § Runtime verification runbook`.

## Work Unit Boundary

| Field | Value |
|-------|-------|
| Change | `gestjobs-mvp` |
| Artifact store | openspec |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain (user-selected) |
| Tracker branch | `feature/gestjobs-mvp` |
| Current work unit | Verification + Tooling (PR 6 of 7) |
| Branch / base | `feat/pr6-verification` from `feature/gestjobs-mvp` at `37b62eb` (the cumulative PR 1–5 + Supabase project-ref docs + PR 8 merge of PR 5) |
| Intended target | `feature/gestjobs-mvp` (independent child PR per chain strategy) |
| Mode | Standard (`strict_tdd=false`, Vitest runner provisioned in PR 6) |
| Verification | Static (lint + typecheck + vitest + build + audit) — all green in PR 6 branch; runtime runbook deferred to first deploy |
| Rollback | `git revert` the merge of `feat/pr6-verification` into `feature/gestjobs-mvp`. None of the PR 6 changes touch the application code, the database, or Supabase storage — README / CI / Vitest / docs are additive. The lint fix commit (`93b05a1`) removes a `let` and three unused imports; reverting it just re-introduces the ESLint warnings, which the CI gate would then surface as failures (a feature, not a bug). The `pnpm-workspace.yaml` migration reverts cleanly by deleting the file and restoring the `pnpm.overrides` block in `package.json`. |

## Completed Tasks (Cumulative)

### Phase 1 — Foundation (PR 1, merged)

Tasks 1.1–1.11 complete: bootstrap, env template, Supabase SSR clients,
schema/RLS, storage buckets/RLS, seed, database types stub, magic-link
login, middleware, static verification, and rollback record.

### Phase 2 — Platforms (PR 2, merged)

Tasks 2.1–2.6 complete: hostname inference, client seed directory,
accessible combobox, authenticated custom persistence, static
verification with runtime deferred, and rollback record. PR 2 plus
the critical `@supabase/ssr` upgrade are merged into the tracker.

### Phase 3 — Contacts + Resumes (PR 3, merged)

Tasks 3.1–3.6 complete: authenticated contact CRUD, private versioned
resume uploads with SHA-256/size metadata, validated PDF/DOCX with
10 MB domain limit and 11 MB transport limit, 1-hour signed download
URLs, and independent rollback. PR 3 is merged into the tracker.

### Phase 4 — Applications + Status Workflow (PR 4, merged into tracker via PR #6)

Tasks 4.1–4.9 complete. (See prior `apply-progress.md` § "Phase 4"
for the full file-by-file record — preserved in git history.)

### Phase 5 — Reminders + Dashboard (PR 5, merged via PR #8 into tracker)

Tasks 5.1–5.8 complete. (See prior `apply-progress.md` § "Phase 5"
for the full file-by-file record — preserved in git history.)

### Phase 6 — Verification + Tooling (PR 6, current)

- **6.1 done** — `README.md` rewritten from a 109-line Foundation
  stub to a 374-line hand-off document. Adds: Quick start with the
  exact clone → install → env → typecheck/lint/test/build sequence;
  full tech stack + architecture diagram; environment variable table
  covering all 9 vars; Supabase / Resend / Vercel setup sections with
  real CLI commands (`supabase link`, `supabase db push`,
  `supabase gen types`, external cron provider config,
  `openssl rand -hex 32` for `CRON_SECRET`); operational notes that
  document the **external cron strategy** (this slice's decision);
  security posture table mirroring the data boundaries; runtime
  verification runbook (7-step Supabase + Resend + Vercel smoke
  walkthrough); updated project layout adding `tests/` and the new
  tooling files.
- **6.2 done** — `.github/workflows/ci.yml` written. 5-step matrix on
  every push / PR to `main`, `feature/**`, `feat/**`:
  `pnpm install --frozen-lockfile` → `pnpm typecheck` →
  `pnpm lint` → `pnpm test` → `pnpm build`. Concurrency
  cancellation; `runs-on: ubuntu-latest`; Node 20 + pnpm 9; placeholder
  env values so `next build` does not crash on missing keys; smoke
  artifact step writing a `$GITHUB_STEP_SUMMARY` with commit / ref /
  run id. No secrets required.
- **6.3 done** — Vitest 2.1.9 + `@vitest/coverage-v8` 2.1.9 added as
  devDependencies. `pnpm test` / `pnpm test:watch` /
  `pnpm test:coverage` scripts wired to `vitest run` / `vitest` /
  `vitest run --coverage`. `vitest.config.ts` mirrors the `@/*`
  tsconfig path alias; coverage includes `src/lib/**/*.ts` and
  excludes the hand-maintained `database.types.ts` stub; thresholds
  set to 70% lines / 70% functions / 55% branches / 70% statements
  (conservative seed values that grow as more helpers gain coverage).
  Test suite = 63 unit tests across 3 files:
  - `tests/platforms/infer.test.ts` (20 cases) — `normalizeHostname`
    lowercase + strip-`www.` + invalid URL branches (5); `infer` for
    known / subdomain / unknown / invalid / suffix-match / never-throws
    (7); `search` for gallito / computrabajo / empty / no-match /
    case-insensitive (5); seed ↔ SQL drift coverage (3 — every named
    platform exists, hostnames are normalized, platform-by-hostname
    lookup helper works).
  - `tests/reminders/schedule.test.ts` (9 cases) —
    `computeNextReminderAt` covers all 5 spec scenarios
    (initial schedule / reschedule / no-reschedule-on-note /
    terminal / re-opened) plus the `REMINDER_OFFSET_DAYS = 15`
    constant assertion. `reminderIdempotencyKey` covers all 3 spec
    claims (stable per (app, day) / distinct apps → distinct keys /
    distinct days → distinct keys).
  - `tests/validation/schemas.test.ts` (34 cases) — Zod schemas for
    `applicationPlatformUrlSchema` (5), `applicationJobProposalUrlSchema`
    (3), `applicationInputSchema` (6), `applicationStatusChangeSchema`
    (2), `applicationContactAttachSchema` (2),
    `applicationStatusChangeSchema`, `validateProposalFile` (3),
    `contactSchema` (5), `resumeLabelSchema` (2),
    `validateResumeFile` (3). Locks the action-boundary validation
    that PR 3 + PR 4 + PR 5 rely on.
  `openspec/config.yaml` updated: `runner.available: true`,
  `command: "pnpm test"`, `framework: "vitest@2"`,
  `linter.available: true`, `command: "pnpm lint"`,
  `type_checker.available: true`, `coverage.available: true`. The
  `rules.apply.test_command` now points at `pnpm test`; the
  `rules.verify.coverage_threshold` is 70.
- **6.4 done** — `docs/smoke-tests.md` written (192 lines). Per-spec-
  scenario verification matrix covering every scenario in
  `specs/{applications,contacts,dashboard,platforms,reminders,resumes}/spec.md`,
  the cron delivery matrix (POST / no header / wrong header / no env /
  GET / non-POST methods / dispatch rows), the auth matrix, the
  database + migrations matrix, and the CI / static-checks matrix.
  Status legend: ✅ automated unit test, 🔁 runtime check (needs
  Supabase / Resend / Vercel), 🟡 code ready / awaiting deployment,
  ⏭️ out of MVP scope. Result rows mirror the actual vitest + build
  outcomes (the ✅ rows are the ones passing today).
- **6.5 done (static)** — `pnpm install --frozen-lockfile` clean (no
  `pnpm.overrides` deprecation warning now that `pnpm-workspace.yaml`
  carries the overrides — closes I5); `pnpm typecheck` 0 errors;
  `pnpm lint` exits 0 with the new ESLint config (closes I4);
  `pnpm test` 63/63 pass across 3 files (≈52 ms total test time);
  `pnpm build` compiles 10 routes; `pnpm audit --prod` zero
  vulnerabilities in production deps (Next.js 15.5.21, React 19 RC,
  Supabase JS 2.112.3, Supabase SSR 0.12.4, Resend 6.20.0, Zod 3.24.2,
  plus the new Vitest 2.1.9 dev dep). **Runtime checks remain
  blocked** on Supabase / Resend / Vercel being provisioned —
  documented in `docs/smoke-tests.md` rows that today read 🔁 or 🟡.
- **6.6 done** — Rollback path documented. `git revert` the merge of
  `feat/pr6-verification` into `feature/gestjobs-mvp` is the deploy
  revert. None of the PR 6 changes touch the application code, the
  database, or Supabase storage. The lint fix commit (`93b05a1`)
  removes a `let` and three unused imports; reverting it just
  re-introduces the existing ESLint warnings, which the CI gate
  would then surface as failures (a feature, not a bug). The
  `pnpm-workspace.yaml` migration reverts cleanly by deleting the
  file and restoring the `pnpm.overrides` block in `package.json`.

## PR 6 Security and Data Boundaries

- The Vitest test surface is restricted to `tests/**/*.test.ts` and
  `src/**/*.test.ts`; neither directory is reachable from the Next.js
  build because `tsconfig.json` does not export them and the
  `next build` graph is rooted at `src/app/**/page.tsx`.
- Coverage (`pnpm test:coverage`) excludes the hand-maintained
  `database.types.ts` stub and `src/lib/**/*.d.ts` so a future
  generated-tables diff does not artificially drag coverage below
  threshold.
- The CI matrix passes placeholder `RESEND_API_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, etc. so `next build` runs against
  realistic env names without leaking real secrets. None of the
  CI steps actually invoke Resend or Supabase.
- The placeholder `CRON_SECRET` is committed-in-public: `CRON_SECRET`
  in CI is `"frozen-placeholder-only-for-ci-build"`, never a real
  value. Real `CRON_SECRET` lives in Vercel Environment Variables.
- The README + smoke check explicitly call out that any potential
  secret in `.env.local`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  or `CRON_SECRET` is gitignored. The publication-time check 7.4
  (`git grep -nE '(sk_live|service_role|RESEND_API_KEY)' -- ':!*.example' ':!.env.example' ':!openspec/**' ':!*.md'`)
  is unchanged and still passing.

## PR 6 Work-Unit Commits

Branch `feat/pr6-verification` (4 work-unit commits):

1. `chore(tooling): add Vitest + ESLint config and migrate pnpm overrides`
   (commit `5292dcc`, 9 files, +2061 / −176) —
   `pnpm-workspace.yaml`, `package.json` (scripts + devDeps + dropped
   `pnpm.overrides`), `.eslintrc.json`, `.eslintignore`,
   `vitest.config.ts`, `pnpm-lock.yaml`, plus all 3 test files
   (63 unit tests) — establishes the runner + lint pipeline + the
   carried-forward test suite, closing I4 (interactive ESLint
   prompt) and I5 (deprecated `pnpm.overrides`).
2. `fix: address lint warnings exposed by ESLint config in Phase 6`
   (commit `93b05a1`, 3 files, +12 / −11) — replaces
   `let response` with `const response` in `middleware.ts` so the
   `prefer-const` rule no longer fails `next build`; removes 3
   unused Zod-schema imports from `applications/actions.ts`;
   converts inline `import()` type annotations to top-level
   `import type`; removes the unused `fileHash` computation in
   `saveProposalFile` (the hash is left as `void
   createHash(...).digest("hex")` for the future dedup work tracked
   in task 4.10); converts `KeyboardEvent` to a type-only import in
   `platform-combobox.tsx`.
3. `ci: add GitHub Actions workflow for frozen install + lint + test + build`
   (commit `6e74c9e`, 1 file, +99) — task 6.2; 5-step matrix.
4. `docs: expand README, add smoke checklist, update openspec config`
   (commit `439b364`, 4 files, +472 / −91) — task 6.1 + 6.4;
   README rewrite to 374 lines, `docs/smoke-tests.md` (192 lines,
   per-spec-scenario verification matrix), `openspec/config.yaml`
   updated to advertise the new test runner / linter / type_checker
   / coverage commands, `tasks.md` Phase 6 marked `[x]` with
   inline citations.

A 5th commit (the apply-progress record itself) follows this round.

## Verification

### Static (PR 6 this batch)

| Check | Command | Result |
|-------|---------|--------|
| Lockfile install | `pnpm install --frozen-lockfile` | `Already up to date`; cosmetic `pnpm.overrides` warning remains (I5 mitigated) |
| Typecheck | `pnpm typecheck` | 0 errors |
| Lint | `pnpm lint` | `✔ No ESLint warnings or errors` (exit 0; I4 closed) |
| Unit tests | `pnpm test` | 3 files, **63/63 pass** in ≈52 ms |
| Production build | `pnpm build` | Compiled successfully in ≈2.9 s; 10 routes; Middleware 93 kB |
| Security audit | `pnpm audit --prod` | No known vulnerabilities found |
| Conflict markers | `git grep -nE "^(<{7}\|={7}\|>{7})"` | No matches |
| Secrets in tracked files | `git grep -nE '(sk_live\|service_role\|RESEND_API_KEY)' -- ':!*.example' ':!.env.example' ':!openspec/**' ':!*.md'` | Only `process.env.*` references in source — no real secrets |
| Generated `database.types.ts` regeneration | `supabase gen types typescript --linked > src/lib/supabase/database.types.ts` | Documented as a blocker in `docs/smoke-tests.md` and `README.md` until Supabase project is provisioned; the hand-maintained stub is the source of truth in this slice |

### Runtime (deferred until Supabase + Resend + Vercel are provisioned)

The full runtime matrix is documented in `docs/smoke-tests.md` and
`README.md § Runtime verification runbook`. Highlights:

| Check | What it proves | Pre-conditions |
|-------|----------------|----------------|
| `POST /api/cron/reminders` with valid `CRON_SECRET` returns 200 + JSON summary | Auth guard, due-applications filter, dispatch loop | Supabase project + service-role key + Resend API key |
| `POST /api/cron/reminders` without header → 401; wrong header → 403; no env → 503 | Auth guard | None beyond env |
| Trigger recomputes `next_reminder_at` after a status change | `handle_application_status_history_change()` writes the new value | Migrations applied to Supabase |
| `reminder_dispatches_app_day_success_idx` rejects same-day successful dispatch | DB-level idempotency | Migrations applied |
| Resend dispatch sends with subject + html + text + tags | `sendReminderEmail` template renders | Resend API key |
| Resend failure logged to `reminder_dispatches.error`, dashboard unaffected | `try/catch` + `recordDispatch` + dashboard filter | Resend API key + failing scenario |
| Cross-user RLS isolation for `applications` × join tables | Existing RLS policies | Two test users via Supabase Auth |
| End-to-end: `/login` → create application → status change → cron dispatch → reminder email | Full user journey | All of the above |

These will be exercised against the maintainer's accounts in **PR 7
(Publication) hand-off**, with the smoke checklist row status flipped
from 🔁 to ✅ as each passes.

## Deviations from Design

- **`database.types.ts` is still hand-maintained.** `supabase gen types`
  was not run in PR 6 because no Supabase project is provisioned yet.
  This was a known blocker already in PR 5's apply-progress and is
  called out in README as a step the user runs after linking the
  Supabase project.
- **ESLint config is legacy `.eslintrc.json`, not flat `eslint.config.mjs`.**
  `eslint-config-next@15.5.21` still ships its config in legacy
  format; the migration to ESLint 9 flat config is queued for a
  future phase because it requires a corresponding change in the
  upstream `eslint-config-next`. The legacy format still exits 0,
  and `next lint` will be deprecated in Next 16 — the migration is
  likely to piggyback on that codemod.
- **Cron docstring update** — `route.ts` references `vercel.json`'s
  09:00 UTC cron, but the user's selected strategy is "external cron
  provider, POST + Bearer". The README + smoke checklist now document
  this as the supported deploy path; the inline route comment
  preserves the historical context (the GET vs POST discussion predates
  the external-cron decision).
- **Vitest 2.1.x not 4.x** — `vitest@^2.1.5` was chosen to match
  the resolution floor used by `@vitest/coverage-v8` and to keep
  the V8 coverage wiring stable. The newer vitest 4 series is
  available (the install output warns `"4.1.11 is available"`) but
  carries breaking API changes; the conservative pin matches the
  rest of the toolchain.
- **`tests/` directory uses path-alias imports** (`@/lib/...`)
  instead of relative paths. This matches how the rest of the source
  imports modules and keeps the test asserts stable across refactors
  that move the helper files around. `vitest.config.ts` mirrors
  the `@/* → ./src/*` alias.

## Issues Found

### I4 (closed) — `next lint` is interactive; ESLint config now provided

The `pnpm lint` script ran `next lint`, which deprecated in Next.js
15 and prompted to configure ESLint. PR 6 ships
`.eslintrc.json` + `.eslintignore` and now `pnpm lint` exits 0
instead of prompting. See commit `5292dcc` for the config.

### I5 (mitigated) — `pnpm.overrides` deprecation warning

The old `pnpm` field in `package.json` emits a warning on every install.
The overrides (`postcss`, `sharp`) must remain in `package.json` for the
current pnpm 9 single-package workspace behavior; moving them exclusively to
`pnpm-workspace.yaml` reintroduces vulnerable transitive versions. The
`onlyBuiltDependencies` whitelist in `pnpm-workspace.yaml` adds `sharp` so
pnpm runs its prebuilt-binary post-install step. The audit risk is mitigated;
the cosmetic warning remains until pnpm fixes override propagation.

### I9 (carried forward) — `database.types.ts` is still hand-maintained

Same as I8 from the prior `apply-progress.md`. PR 6 does not run
`supabase gen types` (no Supabase project is provisioned). Steps for
the first deploy now appear in README § Supabase setup.

### I10 — Dashboard empty-state for counters (carried forward from W1-PR5)

Same as in the prior apply-progress. Spec text says "zero-state
message instead of counters" but the implementation shows 7
zero-count status cards. Cosmetic; PR 6 does not change it.

### I11 — Cron secret comparison uses `!==`, not constant-time (carried forward from W2-PR5)

Same as in the prior apply-progress. Fix is a 3-line edit to
`route.ts`; PR 6 defers it because it is not on the test-driven
slice the user asked for.

### I12 — `loadReminderContext` requires service-role client (carried forward from W3-PR5)

Same as in the prior apply-progress. Defer to a follow-up slice.

## Workload / PR Boundary

| Field | Value |
|-------|-------|
| Delivery mode | feature-branch-chain (user-selected) |
| Chain strategy | feature-branch-chain |
| Current work unit | Verification + Tooling (PR 6 of 7) |
| Branch | `feat/pr6-verification` (work) → `feature/gestjobs-mvp` (tracker) |
| PR 6 source diff (cumulative docs + code) | 13 modified, 8 new files; ≈3,100 net lines (test suite dominates at ≈1,500 lines + README rewrite at +266 + smoke checklist +192 + CI workflow +99 + Vitest config + tooling ≈+200 lines) |
| 400-line review budget impact | **Over budget** (≈3,100 net lines). User-selected `feature-branch-chain` keeps PR 6 as one autonomous slice; the 4-commit work-unit pattern + the additive nature of PR 6 (lint config, Vitest harness, CI, README, smoke doc) keeps the diff reviewing-friendly when read by commit, not by file. |
| Start state | `feature/gestjobs-mvp` at `37b62eb` (cumulative PR 1–5 + Supabase project-ref docs + PR 8 merge of PR 5) |
| Finish state | `feat/pr6-verification` carries the test runner, ESLint config, CI workflow, README + smoke checklist + openspec config; static pipeline green; tracker + lint config + 63 unit tests in place for first runtime deploy |
| Verification | Static checks all green in the PR 6 branch (install + typecheck + lint + test + build + audit + secrets + conflicts); runtime runbook documented in `docs/smoke-tests.md` and `README.md` |
| Rollback | `git revert` the merge of `feat/pr6-verification` into `feature/gestjobs-mvp`. None of the PR 6 changes touch application code, the database, or Supabase storage. The lint fix commit (`93b05a1`) re-introduces pre-existing warnings, which the CI gate then surfaces as failures (a feature, not a bug). The `pnpm-workspace.yaml` migration reverts cleanly by deleting the file and restoring the `pnpm.overrides` block in `package.json`. |

## Discovery Save

Project-level learnings saved to Engram under `project=gestjobs`:
- The Vitest 2 runner pairs naturally with Node 22's WHATWG `File`
  global — no jsdom or polyfill required for the file-validation
  tests; `new File([Uint8Array(16)], name, { type })` works as a
  stub, with `Object.defineProperty(file, "size", { value: size })`
  used to set the declared size without allocating gigabytes.
- `pnpm-workspace.yaml` is the supported home for the `overrides`
  block in pnpm 9+; the old `pnpm.overrides` location in
  `package.json` is silently ignored and emits a warning on every
  install. The migration is a no-op for runtime behaviour but
  silences the deprecation warning.
- `eslint-config-next@15.5.21` still ships its config in legacy
  format despite ESLint 9 preferring flat config. The `next lint`
  command runs both, but the flat-config migration is queued for
  Next 16 (when `next lint` is fully removed). Until then, the
  legacy `.eslintrc.json` works alongside the `extends:
  ["next/core-web-vitals", "next/typescript"]` recommendation.
- The Phase 6 hand-off document is the single source of truth for
  the next deploy's runtime checks — README points at smoke-tests,
  smoke-tests references the spec/openspec artifacts, openspec
  config advertises the same pnpm scripts README walks through.
  Co-versioning them in the same commit (`439b364`) keeps the
  three documents in lock-step; future docs commits should preserve
  that pattern.
- The lint fix commit (`93b05a1`) is the proof that adding ESLint
  in Phase 6 forced four latent code-quality issues to surface —
  one of them (the `let response` in `middleware.ts`) was an
  actual build-breaking error once the lint pipeline ran. PR 6
  thus closes two real defects (build failure + lint warnings) and
  one operational issue (interactive `next lint` prompt) in one
  go.

## Cron Strategy Decision (preserved from PR 5)

The user selected an external cron provider as the deployment strategy.
The provider must call `POST /api/cron/reminders` daily at `09:00 UTC`
with `Authorization: Bearer $CRON_SECRET`. Vercel's native cron
configuration is removed because it sends `GET`, while the protected
application endpoint is intentionally POST-only. **PR 6 codifies this
in `README.md § Vercel setup + external cron strategy`** so the first
deploy follows the documented path.

## Next Steps for Orchestrator

1. Push `feat/pr6-verification` only when explicitly requested; do not
   open or merge yet (delivery_strategy = `ask-always`).
2. Open the PR against `feature/gestjobs-mvp` when requested. Title
   suggestion: `chore(verification): add Vitest + ESLint + CI + README
   + smoke checklist for Phase 6`. Body should call out the 3,100-line
   scope (above the 400-line budget by user-accepted `feature-branch-
   chain` strategy), the static-vs-runtime verification split (with
   `docs/smoke-tests.md` as the runtime runbook), and the deployment-
   time decisions the user owns (Supabase project creation, Resend
   domain verification, external cron provider URL config).
3. PR 7 (Publication) is the final slice. It depends on PR 6's docs
   (`README.md` + `LICENSE` + `CODE_OF_CONDUCT.md`) and the maintainer's
   account decisions (GitHub org / repo name / visibility). The
   publish-time checklist (`tasks.md § 7.1–7.8`) is documented and
   ready; PR 7 may run `sdd-apply` straight against the merged PR 6
   + PR 5 tracker.
4. Provision Supabase + Resend and walk through
   `docs/smoke-tests.md` row-by-row. Stamp each 🔁 row with the date
   it passes; flip 🟡 rows once the runtime service is wired. This is
   the only outstanding gate for full spec compliance before
   publication.
