# Apply Progress — gestjobs-mvp PR 1 (Foundation)

## Summary

PR 1 (Foundation) is implemented and ready for review. The branch
`feat/pr1-foundation` carries 10 work-unit commits on top of
`feature/gestjobs-mvp` (the tracker branch for the feature-branch-chain).
The repo goes from an empty skeleton (only `.atl/` + `openspec/`) to a
runnable Next.js 15 + TypeScript + Tailwind 3 app with Supabase Auth,
session-refreshing middleware, an initial Postgres schema with per-user
RLS, private storage buckets, the global Latin-American platform seed,
and a magic-link login page.

## Work Unit Boundary

| Field | Value |
|-------|-------|
| Work unit | Phase 1 — Foundation (tasks 1.1–1.11) |
| Branch | `feat/pr1-foundation` |
| Base | `feature/gestjobs-mvp` (tracker for the feature-branch-chain) |
| Tracker | `feature/gestjobs-mvp` (PR target; future child PRs target the previous child branch) |
| Mode | Standard (strict_tdd=false, no test runner) |
| Verification | Static (typecheck + production build); runtime deferred |
| Rollback | `git revert` the PR merge commit on the tracker; no Vercel/Supabase projects exist yet |

## Completed Tasks

| # | Description | Status | Files |
|---|-------------|--------|-------|
| 1.1 | Bootstrap Next.js 15 App Router + TS + Tailwind | done | package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs, src/app/{globals.css,layout.tsx,page.tsx}, .gitignore |
| 1.2 | Env placeholders | done | .env.example |
| 1.3 | Supabase SSR clients | done | src/lib/supabase/{client.ts,server.ts,database.types.ts} |
| 1.4 | Initial Postgres schema + RLS | done | supabase/migrations/001_initial_schema.sql |
| 1.5 | Storage buckets + RLS | done | supabase/migrations/002_storage_buckets.sql |
| 1.6 | Seed data (global platforms) | done | supabase/seed.sql |
| 1.7 | Database types stub | done | src/lib/supabase/database.types.ts |
| 1.8 | Magic-link login | done | src/app/(auth)/login/{page.tsx,actions.ts} |
| 1.9 | Session middleware | done | src/middleware.ts |
| 1.10 | Verification (static + deferred runtime) | done (static); runtime deferred | — |
| 1.11 | Rollback plan documented | done | this file |

## Work-Unit Commits

Each commit is a reviewable, single-purpose slice. The full repo still
makes sense after applying any subset of them.

| SHA (prefix) | Message | Files | + |
|--------------|---------|-------|---|
| `e62a756` | feat(foundation): bootstrap Next.js 15 App Router scaffold | 9 | 212 |
| `2a8e8de` | feat(foundation): add environment variable template | 1 | 15 |
| `f411d93` | feat(foundation): wire Supabase SSR clients and session middleware | 3 | 102 |
| `023f55f` | feat(foundation): add initial Postgres schema with per-user RLS | 1 | 342 |
| `1a42a18` | feat(foundation): enable private storage buckets for resumes and proposals | 1 | 112 |
| `ff7bc0b` | feat(foundation): seed global platform directory for Latin America | 1 | 19 |
| `ce4e8e0` | feat(foundation): add database.types.ts stub for supabase gen types | 1 | 28 |
| `b387cc9` | feat(foundation): add magic-link login page backed by signInWithOtp | 2 | 111 |
| `afb4c51` | fix(foundation): pass typecheck under @supabase/ssr 0.5.x and ignore tsbuildinfo | 3 | 19 |
| `71cdd96` | build(foundation): commit pnpm lockfile | 1 | 3969 |

Total diff: 19 source files (+935 net lines) + pnpm-lock.yaml (+3969).

## Diff vs `main`

```
 .env.example                                |  15 +
 .gitignore                                  |  24 +-
 next.config.mjs                             |   7 +
 package.json                                |  35 +
 pnpm-lock.yaml                              | 3969 ++++++++++++++++++++++
 postcss.config.mjs                          |   9 +
 src/app/(auth)/login/actions.ts             |  35 +
 src/app/(auth)/login/page.tsx               |  76 +++
 src/app/globals.css                         |  18 +
 src/app/layout.tsx                          |  28 ++
 src/app/page.tsx                            |  37 ++
 src/lib/supabase/client.ts                  |  16 +
 src/lib/supabase/database.types.ts          |  28 ++
 src/lib/supabase/server.ts                  |  50 +++
 src/middleware.ts                           |  60 +++
 supabase/migrations/001_initial_schema.sql  | 342 +++++++++++
 supabase/migrations/002_storage_buckets.sql | 112 ++++
 supabase/seed.sql                           |  19 +
 tailwind.config.ts                          |  26 ++
 tsconfig.json                               |  32 ++
```

## Verification

### Static (completed this batch)

| Check | Command | Result |
|-------|---------|--------|
| Install | `pnpm install` | 367 packages resolved; lockfile committed |
| Typecheck | `pnpm typecheck` | 0 errors |
| Production build | `pnpm build` | Compiled successfully; 5 static pages prerendered (`/`, `/_not-found`, `/login`) + Middleware bundle |

### Runtime (deferred — needs Supabase + Vercel projects)

| Check | What it proves | Pre-conditions |
|-------|----------------|----------------|
| `pnpm dev` boots on :3000 | Next dev server + middleware runs | None |
| `supabase db reset` applies migrations + seed | Schema RLS policies + status bootstrap trigger + platform seeds all run | Supabase CLI installed + project linked |
| Magic-link login returns 200 | signInWithOtp server action calls Supabase Auth and redirects with `?status=otp-sent` | Supabase project + real anon key + email provider configured |
| Cross-user RLS denied in SQL test | is_owner() helper + derived-table EXISTS gates block foreign rows | Two test users created via Supabase Auth |

These will be exercised in **PR 6 (Verification + README)** or earlier on
the preview deploy once a Supabase project is provisioned. The PR
includes a short verification runbook in the apply-progress artifact.

## Deviations from Design

None. Every table, RLS policy, and storage bucket in
`supabase/migrations/` matches the schema in
`openspec/changes/gestjobs-mvp/design.md` § "Core tables (simplified SQL)"
and the RLS pattern under § "RLS policy pattern". One implementation
detail not in design: the seven default statuses are inserted via an
`after insert on auth.users` trigger (`create_default_statuses()`)
instead of the seed file — the seed file owns only the global platforms.
This keeps seed.sql idempotent across users and means a fresh sign-up
always has the canonical status list, without requiring the seed to
know any user_id. Design.md § "Status values ship with sensible
defaults and are user-configurable" still holds.

## Issues Found

- `@supabase/ssr` 0.5.x marks `setAll` as optional in its public types,
  so the callback parameter fell back to implicit `any` under
  `tsc --strict`. Fixed by asserting the arrow function to `SetAllCookies`
  in both `src/lib/supabase/server.ts` and `src/middleware.ts`. Captured
  in commit `afb4c51`. Documented for future contributors.
- ESLint config is not committed (`pnpm lint` exits with an interactive
  "How would you like to configure ESLint?" prompt). Deferred to PR 6
  where the Vitest + ESLint + Prettier tooling lands as a coherent
  setup; we did not want to grow PR 1 further.
- `pnpm-lock.yaml` adds 3969 lines, which dominates the PR diff and
  pushes it well past the 400-line review budget. The lockfile is a
  single coherent unit (dependency resolution) and committing it is
  standard pnpm practice for reproducibility, so we kept it as its own
  commit. Reviewers can `git show 71cdd96 --stat` separately.

## Workload / PR Boundary

| Field | Value |
|-------|-------|
| Delivery mode | feature-branch-chain (user-selected) |
| Chain strategy | feature-branch-chain |
| Work unit | Foundation (PR 1 of 7) |
| Branch | `feat/pr1-foundation` (work) → `feature/gestjobs-mvp` (tracker) |
| Diff size | 19 source files + lockfile, ~4900 insertions |
| Review budget impact | **Exceeds 400-line budget.** Foundation is bootstrapping from an empty repo, so the schema (342 lines), storage buckets (112 lines), and lockfile (3969 lines) cannot be reasonably split without breaking the spec. Recommend reviewers review by commit, not by file. The lockfile alone justifies the overage. |
| Start state | Empty repo (only `.atl/` + `openspec/` + `README.md`) |
| Finish state | Runnable Next.js scaffold + Supabase schema + storage buckets + seed + magic-link login + middleware session refresh; `pnpm build` succeeds |
| Verification | Static checks pass; runtime verification runbook deferred to PR 6 |
| Rollback | `git revert` the PR merge on `feature/gestjobs-mvp`. No external resources to delete (no Vercel/Supabase projects created yet). |

## Skills Loaded

- `paths-injected` — orchestrator provided exact paths:
  `sdd-apply/SKILL.md`, `work-unit-commits/SKILL.md`, `_shared/SKILL.md`
  (which references `_shared/{sdd-phase-common,openspec-convention,
  persistence-contract,sdd-status-contract,engram-convention,
  skill-resolver}.md`).

## Discovery Save

Project-level learnings saved to Engram under `project=gestjobs`:

- Stack decisions (Next.js 15 + Supabase SSR + Tailwind 3)
- PR1 Foundation apply kickoff + branch strategy + budget risk

## Next Steps for Orchestrator

1. Open PR 1 with base `feature/gestjobs-mvp`, head `feat/pr1-foundation`.
   Title suggestion: `feat(foundation): bootstrap gestjobs-mvp MVP scaffold`.
2. After PR 1 merges into `feature/gestjobs-mvp`, create
   `feat/pr2-platforms` from the updated tracker and dispatch `sdd-apply`
   for **PR 2 — Platforms** (tasks 2.1–2.6).
3. PR 3 (Contacts + Resumes) can land in parallel with PR 2 once PR 1 is
   merged (independent base). The two child branches will both target
   `feature/gestjobs-mvp`; whichever merges first updates the tracker
   for the other.