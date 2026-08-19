# gestjobs

A personal job-application tracker that keeps every role, status change, contact, resume version, and follow-up reminder in one place — so nothing falls through the cracks.

> **Current status (Phase 6 — Verification + Tooling):** six MVP slices ship in this repo: Foundation (PR 1, merged), Platforms (PR 2, merged), Contacts + Resumes (PR 3, merged), Applications + Status Workflow (PR 4, merged via PR #6), Reminders + Dashboard (PR 5, merged via PR #8), and Verification + Tooling (PR 6 — this branch). Phase 7 publishes the repo to a new GitHub org once the runtime Supabase + Resend + Vercel accounts are provisioned.

---

## Quick start

```bash
# 1. Prerequisites: Node >= 20, pnpm 9, accounts on Supabase / Resend / Vercel.
#    See docs/requirements.md for the full checklist.

# 2. Install
pnpm install --frozen-lockfile

# 3. Configure environment
cp .env.example .env.local
# Fill in real values from Supabase + Resend dashboards.

# 4. Verify the static pipeline
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint (exits 0)
pnpm test        # Vitest unit tests (63 tests today)

# 5. Build for production
pnpm build       # next build (10 routes)

# 6. Run the dev server
pnpm dev         # next dev on http://localhost:3000
```

The static pipeline above runs in CI on every push and PR (`.github/workflows/ci.yml`). It does **not** require a live Supabase project, Resend API key, or Vercel cron — the runtime checks are documented in [`docs/smoke-tests.md`](docs/smoke-tests.md) and exercised manually once those services are wired.

---

## What ships in this repo

| Capability | Status | Phase | Notes |
|------------|--------|-------|-------|
| Next.js 15 App Router scaffold | ✅ Live | PR 1 | Home page + login + dashboard + 8 protected routes |
| Magic-link authentication | ✅ Live | PR 1 | Supabase Auth `signInWithOtp`; cookie-based SSR session |
| Postgres schema + RLS | ✅ Live | PR 1 | 9 tables, per-user RLS via `is_owner()` helper |
| Storage buckets + RLS | ✅ Live | PR 1 | `resumes` + `proposals`, 10 MB MIME-allow-listed |
| Global platform seed | ✅ Live | PR 1 | 10 Latin-American boards preloaded |
| Platform hostname inference | ✅ Live | PR 2 | Pure TS helpers; exact + suffix match |
| Platform combobox + custom persistence | ✅ Live | PR 2 | ARIA combobox + `upsertCustomPlatform` Server Action |
| Contacts directory + Resumes versioning | ✅ Live | PR 3 | CRUD, 1-hour signed URLs, SHA-256 metadata |
| Applications CRUD + status workflow + history | ✅ Live | PR 4 | Immutable history, mandatory platform URL, proposal capture (text/file/URL) |
| Reminder scheduling + Resend email dispatch | ✅ Live | PR 5 | 15-day cadence, idempotent per-day dispatch, protected cron endpoint |
| Dashboard counters + pending list | ✅ Live | PR 5 | Status counters + sorted `next_reminder_at ASC` list |
| Verification + tooling (this PR) | ✅ Live | PR 6 | Vitest, ESLint config, CI, README, smoke checklist |

## MVP slices still to land

| Slice | Phase | What it covers |
|-------|-------|----------------|
| Publication | PR 7 | Public repo, LICENSE, branch protection, first release tag |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Database / Auth / Storage | Supabase (Postgres + Auth + Storage) |
| Email | Resend (transactional reminder email) |
| Tests | Vitest 2 |
| Lint | ESLint 9 via `next lint` (legacy config, `eslint-config-next` 15.5.21) |
| Package manager | pnpm 9 (single-package workspace via `pnpm-workspace.yaml`) |
| Runtime | Node.js ≥ 20 |
| Deployment target | Vercel |

---

## Architecture overview

```
User ──→ Next.js App Router (RSC + Server Actions)
              │
              ├──→ Supabase Auth (magic-link session)
              ├──→ Supabase Postgres  + RLS (tenants = `user_id`)
              ├──→ Supabase Storage (resumes + proposal files; signed URLs)
              │
              ├──→ External cron provider ─→ POST /api/cron/reminders
              │     (cron-job.org / GitHub Actions, never Vercel native)
              │
              └──→ Resend (due reminder email)
```

Every tenant table stores a `user_id`. Row-level security is enforced at the database layer via an `is_owner(user_id)` helper; application code re-checks `auth.uid()` on every write as a defence-in-depth guarantee. Service-role keys are scoped to the cron route only.

See [`openspec/changes/gestjobs-mvp/design.md`](openspec/changes/gestjobs-mvp/design.md) for the full data flow and decision matrix.

---

## Environment setup

Copy `.env.example` to `.env.local` and fill in real values. `.env.local` is gitignored.

| Variable | Source | Used by |
|----------|--------|---------|
| `NEXT_PUBLIC_APP_URL` | Set to `http://localhost:3000` locally; your preview URL on Vercel | App links |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | Client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API | **Server only** — cron route uses it to bypass RLS |
| `SUPABASE_PROJECT_REF` | Project URL slug | Supabase CLI |
| `RESEND_API_KEY` | Resend → API Keys | Reminder dispatch |
| `RESEND_FROM_EMAIL` | A verified Resend sender (e.g. `GestJobs <noreply@yourdomain.com>`) | Reminder email `from` |
| `RESEND_REPLY_TO` | Optional. Your email address | Reminder email `reply-to` |
| `CRON_SECRET` | `openssl rand -hex 32` | Auth gate for `POST /api/cron/reminders` |

> **Security:** never commit `.env.local` or real keys. Rotate leaked credentials immediately. The service-role key is only ever used in `src/app/api/cron/reminders/route.ts` and never crosses the client bundle.

### Supabase setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Note the **Project ref** and **Project URL**.
2. Pull request API keys from Dashboard → Project Settings → API → anon / service_role.
3. Apply the migrations:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push    # applies 001_initial_schema.sql + 002_storage_buckets.sql + 003_reminder_trigger.sql
   ```
4. Configure Auth → URL Configuration → Site URL = `http://localhost:3000` for local dev (your preview URL on Vercel for staging).
5. (Optional but recommended) Regenerate the typed Database stub after migrations:
   ```bash
   supabase gen types typescript --linked > src/lib/supabase/database.types.ts
   ```
   The committed stub is hand-maintained for development without a Supabase project; the generated output supersedes it once you have a linked project.

The default statuses (`Applied`, `Screening`, `Interview`, `Offer`, `Hired`, `Rejected`, `Withdrawn`) are created automatically for every user by the `create_default_statuses()` trigger in `001_initial_schema.sql` — no separate seed step is needed.

### Resend setup

1. Create an account at [resend.com](https://resend.com).
2. Add and verify a sending domain (e.g. `yourdomain.com`).
3. Generate an API key at Dashboard → API Keys.
4. Set `RESEND_FROM_EMAIL` to a verified sender (e.g. `GestJobs <noreply@yourdomain.com>`).
5. Optionally set `RESEND_REPLY_TO` to your personal email so reminder replies route back to you.

### Vercel setup + external cron strategy

The protected reminder endpoint is **POST-only by spec**, and Vercel native cron fires **GET requests**. Vercel's native cron cannot call this route without a wrapper, and we deliberately do not loosen the spec. The selected production approach is an **external cron service**.

1. Create a Vercel project and import this GitHub repo.
2. Copy every variable from `.env.local` into Vercel Project Settings → Environment Variables.
3. Generate `CRON_SECRET` with `openssl rand -hex 32` and store it in Vercel as a secret.
4. Configure your external cron provider (e.g. [cron-job.org](https://cron-job.org), GitHub Actions on `schedule: cron: "0 9 * * *"`):
   - **URL:** `https://<your-vercel-domain>/api/cron/reminders`
   - **Method:** `POST`
   - **Headers:** `Authorization: Bearer <CRON_SECRET>`
   - **Schedule:** `0 9 * * *` (09:00 UTC daily)
5. Keep `vercel.json` as a fallback schedule; the GET-style Vercel entry returns 410 by design (matches the PR 5 rollback note).

> **Alternative (documented but not selected):** a Vercel middleware / proxy function that listens on GET, translates to POST with the secret, and proxies to the same route. Out of scope for Phase 6; the external cron approach is the lower-overhead path and keeps the route spec intact.

---

## Operational notes

### Idempotency on reminder dispatch

`POST /api/cron/reminders` enforces "send at most one email per application per day" via three layers:

1. **DB unique partial index** `reminder_dispatches_app_day_success_idx` on `(application_id, sent_at::date)` WHERE `error IS NULL` (`003_reminder_trigger.sql`). A second successful dispatch on the same calendar day is rejected by the database.
2. **Resend SDK `idempotencyKey`** set to `reminder/<application_id>/<YYYY-MM-DD>`. A same-day retry produces the same provider message id.
3. **Cron + dashboard "dismissed" predicate.** `selectDueApplications` and `loadPendingReminders` both filter out rows with a successful dispatch today, so the dashboard does not show the same reminder twice after the cron runs.

### Security posture

| Boundary | Mechanism |
|----------|-----------|
| Auth | Magic link only; no passwords. Session refresh in `src/middleware.ts`. |
| RLS | `is_owner(user_id)` helper applied to every tenant table (001_initial_schema.sql). |
| Storage | Private buckets, 1-hour signed URLs, MIME allow-list (PDF/DOCX), 10 MB cap. |
| Service role | Scoped to `src/app/api/cron/reminders/route.ts`; route re-implements its own "due" filter. |
| Cron secret | `CRON_SECRET` compared on every POST; missing env → 503, missing header → 401, wrong value → 403. |
| Method policy | POST only on the cron route; GET → 410 (rollback-safe), PUT/PATCH/DELETE → 405. |

### Runtime verification runbook

When Supabase + Resend + Vercel are provisioned:

1. Apply migrations: `supabase db push`.
2. Create two users via Supabase Auth magic links in a private browser session.
3. Seed an overdue application: `application_date = (today - 16 days)` + a status history row, confirm the trigger writes `next_reminder_at = today`.
4. Trigger the cron: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders` → expect 200 with `{ ok: true, totals: { sent: 1, skipped: 0, failed: 0 } }`.
5. Confirm the email landed in the inbox and `select * from reminder_dispatches order by sent_at desc limit 1` shows the row.
6. Re-run the cron within the same UTC day → expect 200 with `{ totals: { sent: 0, skipped: 1 } }` because the partial index suppresses a duplicate dispatch.
7. Visit `/dashboard` → the dispatched reminder is excluded.

Full per-scenario checklist (every spec scenario mapped to a static check or runtime check) is in [`docs/smoke-tests.md`](docs/smoke-tests.md).

---

## Local commands

| Command | Purpose |
|---------|---------|
| `pnpm install --frozen-lockfile` | Install from the committed lockfile |
| `pnpm dev` | Start the Next.js dev server on `:3000` |
| `pnpm typecheck` | TypeScript check without emit |
| `pnpm lint` | ESLint (exits 0; legacy config via `eslint-config-next`) |
| `pnpm test` | Vitest unit tests (one-shot, CI mode) |
| `pnpm test:watch` | Vitest in interactive watch mode |
| `pnpm test:coverage` | Vitest with V8 coverage (HTML + JSON summary) |
| `pnpm build` | Production build (10 routes; static prerender + dynamic) |
| `pnpm start` | Serve the production build locally |
| `pnpm audit --prod` | Production-only dependency audit (zero findings today) |

---

## Project layout

```
.
├── src/
│   ├── app/                  Next.js App Router routes
│   │   ├── (auth)/login/     Magic-link sign-in
│   │   ├── api/cron/reminders/  POST-only reminder endpoint
│   │   ├── applications/     List, new, detail + Server Actions (8 actions)
│   │   ├── contacts/         Directory + CRUD Server Actions
│   │   ├── dashboard/        Counters + pending reminders RSC
│   │   └── resumes/          Upload + signed-URL download
│   ├── components/           PlatformCombobox (native ARIA, 336 lines)
│   ├── lib/
│   │   ├── email/resend.ts   Idempotent email sender
│   │   ├── platforms/        infer + seed (PR 2)
│   │   ├── reminders/        schedule.ts (PR 5)
│   │   ├── supabase/         SSR + browser clients + Database stub
│   │   └── validation/       Zod schemas for application / contact / resume
│   └── middleware.ts         Supabase session refresh
├── supabase/
│   ├── migrations/           001 schema, 002 buckets, 003 reminder trigger
│   └── seed.sql              10 global platforms (LinkedIn, Indeed, etc.)
├── tests/                    Vitest unit tests (PR 6)
│   ├── platforms/infer.test.ts
│   ├── reminders/schedule.test.ts
│   └── validation/schemas.test.ts
├── docs/
│   ├── requirements.md       Setup guide (Node, pnpm, Supabase, Resend, Vercel)
│   └── smoke-tests.md        Spec-scenario → automated / runtime mapping
├── openspec/
│   └── changes/gestjobs-mvp/ SDD proposal / specs / design / tasks
├── .github/
│   └── workflows/ci.yml      Frozen install + typecheck + lint + test + build
├── pnpm-workspace.yaml       Workspace + overrides (post I5 migration)
├── package.json              Scripts + dependencies
├── tsconfig.json             Path alias `@/* → ./src/*`
├── vitest.config.ts          Test runner + V8 coverage config
├── .eslintrc.json            ESLint config (legacy format for next lint)
└── README.md                 This file
```

---

## Planning artifacts

| Document | Purpose |
|----------|---------|
| [Proposal](openspec/changes/gestjobs-mvp/proposal.md) | Intent, scope, capabilities, approach, risks |
| [Exploration](openspec/changes/gestjobs-mvp/exploration.md) | Requirement clarification |
| [Design](openspec/changes/gestjobs-mvp/design.md) | Architecture, data flow, decisions |
| [Tasks](openspec/changes/gestjobs-mvp/tasks.md) | Hierarchical implementation plan (Phase 1–7) |
| [Smoke checklist](docs/smoke-tests.md) | Per-spec-scenario verification |
| [Setup guide](docs/requirements.md) | Prereqs + Supabase / Resend / Vercel provisioning |

## Module specifications

| Module | Spec |
|--------|------|
| Applications | [spec.md](openspec/changes/gestjobs-mvp/specs/applications/spec.md) |
| Contacts | [spec.md](openspec/changes/gestjobs-mvp/specs/contacts/spec.md) |
| Dashboard | [spec.md](openspec/changes/gestjobs-mvp/specs/dashboard/spec.md) |
| Platforms | [spec.md](openspec/changes/gestjobs-mvp/specs/platforms/spec.md) |
| Reminders | [spec.md](openspec/changes/gestjobs-mvp/specs/reminders/spec.md) |
| Resumes | [spec.md](openspec/changes/gestjobs-mvp/specs/resumes/spec.md) |

---

## License

MIT (added in PR 7 — Publication phase).
