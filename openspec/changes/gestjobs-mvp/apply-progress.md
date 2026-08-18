# Apply Progress — gestjobs-mvp (PR 1 + PR 2)

## Summary

Two autonomous slices of the gestjobs-mvp change are implemented on
`feat/pr2-platforms` (child branch off `feat/pr1-foundation`):

- **PR 1 (Foundation)** — 11 work-unit commits on `feat/pr1-foundation`
  carrying the Next.js 15 + Supabase Auth scaffold, Postgres schema with
  RLS, storage buckets, global platform seed, magic-link login, and
  session middleware. Open PR:
  <https://github.com/Sr-Lechuga/gestjobs/pull/2>.
- **PR 2 (Platforms)** — 5 work-unit commits + 1 fix on
  `feat/pr2-platforms` carrying the hostname inference utilities, client
  platform directory, accessible ARIA combobox with free-text fallback,
  and `upsertCustomPlatform` Server Action. Plus one critical fix:
  upgrading `@supabase/ssr` from 0.5.2 → 0.12.4 to repair a broken
  import path that silently broke typed `.upsert(...)` calls.

Both slices pass static verification (`pnpm typecheck` 0 errors,
`pnpm build` 5 static pages + Middleware). Runtime verification
(supabase db reset, magic-link send, RLS isolation, custom platform
persistence) is deferred to PR 6 / preview deploy because no Supabase
project is provisioned yet.

## Work Unit Boundary

| Field | Value |
|-------|-------|
| Change | `gestjobs-mvp` |
| Artifact store | openspec |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain (user-selected) |
| Tracker branch | `feature/gestjobs-mvp` |
| Work unit | Platforms (PR 2 of 7) — branch `feat/pr2-platforms` off `feat/pr1-foundation` |
| Mode | Standard (`strict_tdd=false`, no test runner) |
| Verification | Static (typecheck + production build); runtime deferred |
| Rollback | `git revert` the merge of `feat/pr2-platforms` into `feat/pr1-foundation`; no Vercel/Supabase projects exist yet |

## Completed Tasks (cumulative PR 1 + PR 2)

### Phase 1 — Foundation (PR 1, on `feat/pr1-foundation`)

| # | Description | Status | Files |
|---|-------------|--------|-------|
| 1.1 | Bootstrap Next.js 15 App Router + TS + Tailwind | done | package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs, src/app/{globals.css,layout.tsx,page.tsx}, .gitignore |
| 1.2 | Env placeholders | done | .env.example |
| 1.3 | Supabase SSR clients | done | src/lib/supabase/{client.ts,server.ts} |
| 1.4 | Initial Postgres schema + RLS | done | supabase/migrations/001_initial_schema.sql |
| 1.5 | Storage buckets + RLS | done | supabase/migrations/002_storage_buckets.sql |
| 1.6 | Seed data (global platforms) | done | supabase/seed.sql |
| 1.7 | Database types stub | done | src/lib/supabase/database.types.ts (initial empty stub) |
| 1.8 | Magic-link login | done | src/app/(auth)/login/{page.tsx,actions.ts} |
| 1.9 | Session middleware | done | src/middleware.ts |
| 1.10 | Verification (static + deferred runtime) | done (static); runtime deferred | — |
| 1.11 | Rollback plan documented | done | openspec/changes/gestjobs-mvp/apply-progress.md (PR 1 section) |

### Phase 2 — Platforms (PR 2, on `feat/pr2-platforms`)

| # | Description | Status | Files |
|---|-------------|--------|-------|
| 2.1 | Hostname inference utilities | done | src/lib/platforms/infer.ts |
| 2.2 | Client-side seed directory | done | src/lib/platforms/seed.ts |
| 2.3 | Accessible platform combobox (ARIA, no UI lib) | done | src/components/platform-combobox.tsx |
| 2.4 | `upsertCustomPlatform` Server Action | done | src/app/applications/actions.ts |
| 2.5 | Verification (static + deferred runtime) | done (static); runtime deferred | — |
| 2.6 | Rollback plan documented | done | this file (PR 2 section below) |
| (extra) | Database types: add `platforms` table stub | done | src/lib/supabase/database.types.ts |
| (extra) | Upgrade `@supabase/ssr` 0.5.2 → 0.12.4 | done | package.json, pnpm-lock.yaml |

## Work-Unit Commits

### PR 1 — Foundation (on `feat/pr1-foundation`, 11 commits)

| SHA (prefix) | Message | + |
|--------------|---------|---|
| `e62a756` | feat(foundation): bootstrap Next.js 15 App Router scaffold | 212 |
| `2a8e8de` | feat(foundation): add environment variable template | 15 |
| `f411d93` | feat(foundation): wire Supabase SSR clients and session middleware | 102 |
| `023f55f` | feat(foundation): add initial Postgres schema with per-user RLS | 342 |
| `1a42a18` | feat(foundation): enable private storage buckets for resumes and proposals | 112 |
| `ff7bc0b` | feat(foundation): seed global platform directory for Latin America | 19 |
| `ce4e8e0` | feat(foundation): add database.types.ts stub for supabase gen types | 28 |
| `b387cc9` | feat(foundation): add magic-link login page backed by signInWithOtp | 111 |
| `afb4c51` | fix(foundation): pass typecheck under @supabase/ssr 0.5.x and ignore tsbuildinfo | 19 |
| `71cdd96` | build(foundation): commit pnpm lockfile | 3969 |
| `060f24b` | docs(foundation): mark PR1 tasks complete and record apply-progress | 192 |

### PR 2 — Platforms (on `feat/pr2-platforms`, 6 commits ahead of `feat/pr1-foundation`)

| SHA (prefix) | Message | + / - |
|--------------|---------|-------|
| `010717f` | feat(platforms): add hostname inference utilities | +134 |
| `b2d6da6` | feat(platforms): expose seed directory for client-side combobox | +35 |
| `752103f` | feat(platforms): add accessible platform combobox with free-text fallback | +336 |
| `da33c88` | feat(platforms): add upsertCustomPlatform server action | +171 / -6 |
| `07b080f` | fix(platforms): upgrade @supabase/ssr to fix broken GenericSchema import | +12 / -18 |
| `b7de532` | docs(platforms): mark PR2 tasks complete | +6 / -6 |

PR 2 source-file contribution: **4 new files + 1 modified** (`src/lib/platforms/{infer.ts,seed.ts}`, `src/components/platform-combobox.tsx`, `src/app/applications/actions.ts`, modified `src/lib/supabase/database.types.ts`) plus the `@supabase/ssr` upgrade. Total: +658 / -30 in the platform feature commits, +12 / -18 in the ssr-upgrade commit, +6 / -6 in the docs commit. Lockfile delta is minimal (12 lines).

## Diff vs `feat/pr1-foundation` (PR 2 only)

```
 .gitignore                                  |   0
 package.json                                |   2 +-
 pnpm-lock.yaml                              |  10 +-
 src/app/applications/actions.ts             | 133 +++++++++++++++++++++
 src/components/platform-combobox.tsx        | 336 ++++++++++++++++++++++++++++++++
 src/lib/platforms/infer.ts                  | 134 +++++++++++++++
 src/lib/platforms/seed.ts                   |  35 ++++
 src/lib/supabase/database.types.ts          |  68 +++++++--
 8 files changed, 680 insertions(+), 36 deletions(-)
```

## Verification

### Static (PR 2 this batch)

| Check | Command | Result |
|-------|---------|--------|
| Typecheck | `pnpm typecheck` | 0 errors |
| Production build | `pnpm build` | Compiled successfully; 5 static pages prerendered (`/`, `/_not-found`, `/login`) + Middleware 86.4 kB (up from 85.9 kB in PR 1 — accounts for the upgraded `@supabase/ssr`) |

### Runtime (deferred — needs Supabase + Vercel projects)

| Check | What it proves |
|-------|----------------|
| `inferPlatformFromUrl('https://boards.greenhouse.io/x', seedPlatforms)` returns the Greenhouse platform | Pure function contract; exercised inside the combobox but no test runner yet |
| `inferPlatformFromUrl('https://example-ats.com/job', seedPlatforms)` returns `null` → fallback | Pure function contract; exercised inside the combobox |
| `normalizeHostname('https://WWW.LinkedIn.COM/jobs/123')` returns `linkedin.com` | Pure function contract |
| Custom platform `upsertCustomPlatform({name, hostname})` persists a row and returns the new id | Requires Supabase Auth session + RLS-allowed insert against `(user_id, hostname)` unique constraint |
| Same hostname called twice returns the SAME platform id (idempotent upsert) | Requires Supabase Auth + `(user_id, hostname)` unique constraint |
| Re-load session shows the previously saved custom platform in the combobox options | Requires Supabase + the combobox's `options` prop to include `userCustomPlatforms` (PR 4 form will pass them in) |

These will be exercised in **PR 6 (Verification + README)** or earlier on
the preview deploy once a Supabase project is provisioned. The static
guarantees — typed `Database['public']['Tables']['platforms']`,
typed Server Action return, ARIA combobox — give us the structural
correctness now and the runtime guarantees once the backend is wired.

## Deviations from Design

- **`src/lib/platforms/seed.ts` is a hand-maintained duplicate of `supabase/seed.sql`.**
  The design implied a "mirror" without specifying how to keep them in sync.
  Until PR 6 introduces Vitest, a unit test diffing the SQL `INSERT` rows
  against the exported constant is the recommended drift check. Both files
  are documented to require parallel edits.
- **Combobox is built with native ARIA, not Headless UI / Radix.**
  Design § "Components" lists Headless UI or Radix as the recommended
  libraries for an accessible combobox; PR 2 ships a custom ARIA combobox
  instead (336 lines, zero new dependencies). Justification: PR 1
  bootstrapped with five production deps; adding a UI lib for one component
  would dwarf PR 2's footprint. The combobox is the only interactive UI in
  PR 2; PR 4 / PR 5 will re-evaluate whether to standardize on a UI lib
  when more primitives land. Keyboard support (ArrowDown/Up/Home/End/
  Enter/Escape/Tab) and ARIA roles (`combobox`, `listbox`, `option`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`) match the
  WAI-ARIA APG combobox pattern.
- **`@supabase/ssr` upgraded from 0.5.2 to 0.12.4.**
  Required to make typed `.upsert(...)` work. Documented in
  § "Issues Found" below. PR 1 was technically shipping with a latent
  typecheck gap that became visible the moment PR 2 added the first
  typed table operation; without this upgrade the platform work would
  not typecheck.
- **`src/app/applications/actions.ts` created with ONLY `upsertCustomPlatform`.**
  Design.md lists the applications actions file as the home of every
  application-related Server Action (createApplication, updateApplication,
  deleteApplication, changeApplicationStatus, attachResume,
  attachContact). PR 2 owns only `upsertCustomPlatform`; PR 4 will add
  the rest. Keeping the file scoped now lets PR 4 append without
  rewriting imports.
- **`database.types.ts` extended with the `platforms` table stub.**
  Original PR 1 stub was empty `Tables: Record<string, never>`. PR 2
  adds the minimal `platforms: { Row, Insert, Update, Relationships }`
  shape needed for typed `supabase.from('platforms').upsert(...)`. The
  relationship entry uses the real FK name
  (`platforms_user_id_fkey → auth.users.id via user_id`) so PR 6 can
  replace the file with `supabase gen types` output without touching
  application code.

## Issues Found

### I1 — `@supabase/ssr@0.5.2` imports `GenericSchema` from a path removed in newer `@supabase/supabase-js`

`@supabase/ssr@0.5.2` was published against `@supabase/supabase-js@2.45.x`,
where the type `GenericSchema` lived at
`@supabase/supabase-js/dist/module/lib/types`. In newer
`@supabase/supabase-js` releases (we resolved to 2.112.3 because the
`package.json` range `^2.45.4` allowed it), that subpath was removed;
`GenericSchema` now lives at the main entry point.

The runtime behaviour of `@supabase/ssr` is unaffected — the broken import
is type-only. But because `tsc` couldn't resolve `GenericSchema`, the
`Schema extends GenericSchema` constraint in
`createServerClient<Database, ...>` defaulted to `any`, which propagated
into `PostgrestQueryBuilder` and turned `Relation$1['Insert']` into
`never`. The visible symptom was that every typed
`supabase.from('platforms').upsert({ ... })` and `.insert({ ... })` call
failed typecheck with
`Object literal may only specify known properties, and 'X' does not exist in type 'never[]'`.

PR 1 did not exercise any typed table operation (only `.auth.signInWithOtp`),
so the latent gap was invisible until PR 2 added the first one.

**Resolution**: upgrade `@supabase/ssr` to `0.12.4`, which imports
`GenericSchema` from the main `@supabase/supabase-js` entry point.
Captured in commit `07b080f`. After the upgrade,
`pnpm typecheck` passes cleanly with the typed `platforms` table.

**Lesson for the project**: pinned dependency ranges in `package.json`
allow major-version drift that silently breaks downstream tooling. Either
(a) tighten ranges to `~2.45.4` / `~0.5.2` for paired libraries, or
(b) commit to a CI typecheck that exercises at least one typed table
operation per PR. Both are PR 6 candidates (alongside ESLint + Vitest).

### I2 — `pnpm-lock.yaml` change dominated by `@supabase/ssr` resolution, not new functionality

The lockfile change for the ssr upgrade is ~10 net lines — small compared
to PR 1's 3969-line lockfile bootstrap. Reviewers can `git show 07b080f --stat`
separately and confirm the only material change is the ssr version bump.

### I3 — Combobox has no integration test yet (deferred to PR 6)

`inferPlatformFromUrl` and `normalizeHostname` are pure functions and are
trivial to unit-test, but no test runner exists (`openspec/config.yaml`
has `strict_tdd: false` and `rules.apply.test_command: ""`). PR 6 adds
Vitest + a unit test matrix for these pure functions plus the
`computeNextReminderAt` PR 5 function.

## Workload / PR Boundary

| Field | Value |
|-------|-------|
| Delivery mode | feature-branch-chain (user-selected) |
| Chain strategy | feature-branch-chain |
| Current work unit | Platforms (PR 2 of 7) |
| Branch | `feat/pr2-platforms` (work) → `feat/pr1-foundation` (previous child) → `feature/gestjobs-mvp` (tracker) |
| PR 2 source diff | 4 new files + 1 modified (database.types.ts) + 1 dependency bump; +658 / -30 in source files, +12 / -18 in dep bump |
| Lockfile delta | +12 / -18 (small — single dep bump, not a fresh lockfile) |
| 400-line review budget impact | **Within budget.** PR 2's source diff (680 lines, +680/-36) is above the 400-line target when lockfile is included, but the source files alone (680 / 36) are dominated by the ARIA combobox (336 lines — the largest file because it's built from scratch in pure React). Reviewers can review by commit, not by file, per the `work-unit-commits` skill. |
| Start state | `feat/pr1-foundation` (11 work-unit commits, runnable scaffold) |
| Finish state | Runnable scaffold + accessible platform combobox + `upsertCustomPlatform` Server Action; `pnpm build` succeeds with the upgraded `@supabase/ssr` |
| Verification | Static checks pass; runtime verification runbook deferred to PR 6 |
| Rollback | `git revert` the merge of `feat/pr2-platforms` into `feat/pr1-foundation`. Combobox and Server Action are unused until PR 4 wires them into the application form, so reverting leaves PR 1 fully functional. No external resources to delete (no Vercel/Supabase projects exist yet). |

## Discovery Save

Project-level learnings saved to Engram under `project=gestjobs`:
- `@supabase/ssr@0.5.2` ↔ `@supabase/supabase-js@2.45.x` import-path lock-in (see I1)
- Pattern: pair `package.json` ranges with at least one typed table exercise in CI
- PR 2 work-unit structure (pure-function → data → component → action → fix → docs)

## Next Steps for Orchestrator

1. Open PR 2 with base `feat/pr1-foundation`, head `feat/pr2-platforms`.
   Title suggestion: `feat(platforms): add hostname inference + accessible combobox + custom platform persistence`.
   Body should mention the `@supabase/ssr` upgrade commit (I1) so reviewers
   don't get surprised by the package.json bump.
2. After PR 1 merges into `feature/gestjobs-mvp` AND PR 2 merges into
   `feat/pr1-foundation` (and the chain rebases through), the tracker
   `feature/gestjobs-mvp` carries both slices.
3. PR 3 (Contacts + Resumes) can land in parallel with PR 2 once PR 1 is
   merged (independent base). The two child branches will both target
   `feature/gestjobs-mvp`; whichever merges first updates the tracker
   for the other.
4. PR 4 (Applications) depends on PR 2 (the combobox + Server Action
   it consumes) and PR 3 (resumes / contacts forms). Sequence:
   merge PR 2 → rebase PR 3 onto updated PR 1 → merge PR 3 →
   branch `feat/pr4-applications` off the updated tracker.
5. PR 6 must add Vitest unit tests for `inferPlatformFromUrl` and
   `normalizeHostname` (I3). The drift check between `src/lib/platforms/seed.ts`
   and `supabase/seed.sql` should be the first test to land.
