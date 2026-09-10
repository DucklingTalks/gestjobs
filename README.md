# gestjobs

A personal job-application tracker that keeps every role, status change, contact, resume version, and follow-up reminder in one place — so nothing falls through the cracks.

> **Current status:** The MVP is implemented, tested, and ready to run with Supabase, Resend, and Vercel.

---

## Quick start

```bash
# 1. Prerequisites: Node >= 20, pnpm 9, accounts on Supabase / Resend / Vercel.
#    See docs/local-development.md for the install-and-run guide,
#    and docs/requirements.md for the account provisioning checklist.

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
| `RESEND_FROM_EMAIL` | A verified Resend sender | Reminder email `from` |
| `RESEND_REPLY_TO` | Optional. Your email address | Reminder email `reply-to` |
| `CRON_SECRET` | `openssl rand -hex 32` | Auth gate for `POST /api/cron/reminders` |

> **Security:** never commit `.env.local` or real keys. Rotate leaked credentials immediately. The service-role key is only ever used in `src/app/api/cron/reminders/route.ts` and never crosses the client bundle.

### Supabase setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Note the **Project ref** and **Project URL**.
2. Pull the API keys from Dashboard → Project Settings → API.
3. Apply the migrations:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. Configure Auth → URL Configuration → Site URL = `http://localhost:3000` for local development.

### Resend setup

1. Create an account at [resend.com](https://resend.com).
2. Add and verify a sending domain.
3. Generate an API key and configure `RESEND_FROM_EMAIL`.

### Vercel setup + external cron strategy

The reminder endpoint is **POST-only**, while Vercel native cron sends **GET** requests. Use an external cron provider.

1. Import this repository into Vercel.
2. Copy the environment variables into Vercel Project Settings → Environment Variables.
3. Configure the external cron provider (for example, [cron-job.org](https://cron-job.org)):
   - **URL:** `https://<your-vercel-domain>/api/cron/reminders`
   - **Method:** `POST`
   - **Header:** `Authorization: Bearer <CRON_SECRET>`
   - **Schedule:** `0 9 * * *` (09:00 UTC daily)

---

## What ships in this repo

| Area | Included |
|------|----------|
| Authentication and security | Magic-link auth, SSR sessions, Postgres RLS, private storage, and scoped service-role access |
| Job tracking | Applications CRUD, statuses, immutable history, platform URLs, and proposal capture |
| Platforms and contacts | Seeded platform catalog, hostname inference, custom platforms, contacts, and resume versioning |
| Reminders and dashboard | Scheduled reminders, idempotent Resend delivery, protected cron endpoint, counters, and pending list |
| Developer workflow | Vitest tests, ESLint, CI, smoke-test checklist, and production build |

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

MIT License — see [LICENSE](LICENSE).

## Service Provisioning

Follow the [service provisioning guides](docs/services/README.md) for Supabase, Resend, Vercel, and GitHub Actions.

## MVP slices still to land

| Slice | What it covers |
|-------|----------------|
| Publication | First public release, branch protection, and release tag |
