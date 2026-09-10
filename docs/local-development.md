# Local development guide — gestjobs

Get the project running on your machine, verify the static pipeline, and run the full smoke-test flow against real services.

> **Two tracks:**
> - **Static checks** (typecheck, lint, unit tests, build) run entirely offline and are exercised in CI on every PR.
> - **Real-service checks** require a provisioned Supabase project, a Resend account, and a `CRON_SECRET`. Steps that need real services are marked with **[Real service required]**.

---

## Prerequisites

| Tool | Version | How to verify |
|------|---------|---------------|
| Node.js | ≥ 20.0.0 | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Git | any recent | `git --version` |
| Supabase CLI | latest | `npx supabase --version` *(for migrations)* |

Install pnpm if missing:

```bash
corepack enable
# or
npm install -g pnpm@9
```

Install the Supabase CLI (required only for pushing migrations). The quickest cross-platform path is `npx`:

```bash
npx supabase --version
```

If you run CLI commands often, install a permanent binary via the [official Supabase CLI guide](https://supabase.com/docs/guides/cli/getting-started) for your platform.

---

## Install dependencies

```bash
pnpm install --frozen-lockfile
```

The lockfile is the source of truth; CI enforces `--frozen-lockfile` so local installs should do the same.

---

## Environment variables

1. Copy the template:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in the variables.

> **Static checks** (typecheck, lint, test, build) accept placeholder values — CI runs the static pipeline with stubs.  
> **Runtime checks** (dev server, smoke tests, cron) require real credentials from your hosted services.

| Variable | Example local value | Where it comes from |
|----------|---------------------|---------------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Your local base URL |
| `SUPABASE_PROJECT_REF` | `abc123def` | Supabase Dashboard → Project Settings |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc123def.supabase.co` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase Dashboard → Project Settings → API *(public anon key)* |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Supabase Dashboard → Project Settings → API *(service role — keep secret)* |
| `RESEND_API_KEY` | `re_xxxxxxxx` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | `GestJobs <noreply@your-domain.com>` | A verified Resend sender |
| `RESEND_REPLY_TO` | `you@example.com` | Your personal email *(optional)* |
| `CRON_SECRET` | `a1b2...` *(64 hex chars)* | `openssl rand -hex 32` |

3. Confirm `.env.local` is gitignored:

   ```bash
   git check-ignore .env.local
   # Expected: .env.local
   ```

> **Security rules**
> - Never commit `.env.local` or real keys.
> - `SUPABASE_SERVICE_ROLE_KEY` is **server-only**; it is used only by the cron route.
> - `CRON_SECRET` must be long and random; it is the only gate on `POST /api/cron/reminders`.
> - Rotate any leaked key immediately from the relevant dashboard.

---

## Supabase project setup **[Real service required]**

The app needs a live Supabase project for Auth, Postgres, and Storage.

This repository contains migrations and seed data, but it does **not** include local Supabase configuration or Docker Compose files. Choose one of the following workflows.

### Option A — Hosted Supabase (recommended)

Use the managed project you created at [supabase.com/dashboard](https://supabase.com/dashboard).

1. Authenticate the CLI:

   ```bash
   npx supabase login
   ```

2. Link to your project:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```

3. Push the migrations to the remote database:

   ```bash
   npx supabase db push
   ```

   This applies:
   - `001_initial_schema.sql` — 9 tables, RLS, `create_default_statuses()` trigger
   - `002_storage_buckets.sql` — `resumes` and `proposals` private buckets
   - `003_reminder_trigger.sql` — `compute_next_reminder_at()` function, history trigger, partial unique index

4. Seed the global platforms.  
   `supabase/seed.sql` is not executed automatically on hosted projects. Open the Supabase Dashboard SQL Editor and run the contents of `supabase/seed.sql`, or insert the 10 preloaded Latin-American job boards manually.

5. Configure Auth → URL Configuration → Site URL = `http://localhost:3000`.

6. *(Optional)* Regenerate typed stubs after migrations:

   ```bash
   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
   ```

   The committed stub is hand-maintained for development without a linked project; a generated file supersedes it once linked.

### Option B — Local Supabase containers (advanced)

A fully local Supabase stack requires Docker and a local CLI configuration (`supabase/config.toml`). This repository does **not** provide that configuration, so local containers are **not ready out of the box**.

If you want a local stack you must:
1. Run `npx supabase init` to generate `supabase/config.toml`.
2. Start the local services with `npx supabase start`.
3. Apply migrations and seed data with `npx supabase db reset`.

> **Warning:** `supabase db reset` destroys **all data** in the **local** database and re-applies migrations plus `supabase/seed.sql`. Only use it against a local database; never run it against a hosted project.

---

## Start the Next.js dev server

```bash
pnpm dev
```

The dev server starts on `http://localhost:3000`.

> Without real service credentials in `.env.local` you can still start the server, but every page that reads auth or database data will fail at runtime.

---

## Static pipeline (no services needed)

Run these before every PR. They match the CI workflow in `.github/workflows/ci.yml`.

| Command | What it does | Expected result |
|---------|--------------|-----------------|
| `pnpm typecheck` | TypeScript check without emit | Exits 0 |
| `pnpm lint` | ESLint via `next lint` | Exits 0 |
| `pnpm test` | Vitest unit tests (one-shot) | 63 tests pass across 3 files |
| `pnpm test:watch` | Vitest interactive watch mode | — |
| `pnpm test:coverage` | Vitest with V8 coverage | HTML + JSON summary in `coverage/` |
| `pnpm build` | Next.js production build | 10 routes built |
| `pnpm start` | Serve the production build locally | Runs after `pnpm build` |
| `pnpm audit --prod` | Production dependency audit | Zero findings today |

These checks require **no** live Supabase project, Resend key, or Vercel account. CI substitutes placeholder environment variables during `pnpm build` so the static pipeline can run entirely on GitHub-hosted runners.

---

## Manual smoke-test flow **[Real service required]**

Complete these once after provisioning Supabase + Resend. They map directly to the checklist in [`smoke-tests.md`](smoke-tests.md).

### Auth

1. Visit `http://localhost:3000/login`.
2. Enter your email and click **Sign in**.
3. Expect redirect to `?status=otp-sent`.
4. Click the magic link in your inbox.
5. Confirm you land on `/dashboard`.
6. Sign out, then visit `/dashboard` directly → you are redirected to `/login`.

### Applications

1. From `/dashboard`, click to create a new application.
2. Fill company, position, and a platform URL.
   - Use a known hostname (e.g. `https://linkedin.com/jobs/...`) → the combobox pre-selects **LinkedIn**.
   - Use an unknown hostname (e.g. `https://example.com/job/123`) → the combobox falls back to a custom platform that is upserted automatically.
3. Save and reopen the detail page → confirm platform and URL persisted.
4. Change status → confirm the timeline shows the new history row.
5. Paste proposal text, upload a PDF/DOCX, or link a proposal URL → confirm each persists.
6. Attach a resume → confirm it appears on the detail page. Attach a different resume → confirm the previous one is replaced.
7. Attach a contact with a role → confirm the contact appears. Remove the role → confirm the contact still exists in `/contacts`.
8. Delete the application → confirm `application_status_history` and `application_resumes` rows are gone.

### Contacts

1. Visit `/contacts` and create a contact with name, email, LinkedIn URL, and notes.
2. Edit the contact → confirm changes persist.
3. Link the same contact to two different applications with independent roles → both role rows persist.
4. Delete an unlinked (orphan) contact → confirm 200 and the row is gone.

### Resumes

1. Visit `/resumes` and upload a PDF or DOCX under 10 MB.
2. Confirm the file is stored under `resumes/<your-user-id>/...` in Supabase Storage.
3. Open the signed URL → file downloads.
4. Attach the resume to an application → confirm it appears on the detail page.
5. Detach the resume → confirm the detail page shows “No resume attached”.

### Reminders

1. Create an application with a non-terminal status such as `Applied`.
2. Remember that reminders are scheduled 15 days after the **last status change**, not simply from `application_date`. For a deterministic test fixture, run the following in the Supabase SQL Editor, replacing the application ID:

   ```sql
   update public.application_status_history
   set changed_at = now() - interval '16 days'
   where application_id = '<application-id>';

   update public.applications
   set next_reminder_at = now() - interval '1 day'
   where id = '<application-id>';
   ```

3. Confirm `next_reminder_at` is overdue:

   ```sql
   select id, next_reminder_at
   from public.applications
   where id = '<application-id>';
   ```

4. Visit `/dashboard` → the overdue application appears in the pending list.

### Dashboard

1. Create 3 applications in `Applied` and 1 in `Interview`.
2. Visit `/dashboard` → status counters show `3` and `1`.
3. Confirm the pending list is sorted by `next_reminder_at ASC` (oldest first).
4. Click any reminder card → navigates to `/applications/[id]`.

---

## Running the cron endpoint safely **[Real service required]**

The reminder dispatch route is `POST /api/cron/reminders`. It is **POST-only by design**; `GET` returns `410 Gone`.

### Local curl ( against `pnpm dev` )

```powershell
curl -X POST `
  -H "Authorization: Bearer $env:CRON_SECRET" `
  http://localhost:3000/api/cron/reminders
```

Expected responses:

| Scenario | Status | Body |
|----------|--------|------|
| Valid secret | 200 | `{ ok: true, totals: { due, sent, skipped, failed }, results: [...] }` |
| Missing `Authorization` | 401 | `{ error: "Missing cron authorization." }` |
| Wrong secret | 403 | `{ error: "Invalid cron secret." }` |
| `CRON_SECRET` env unset | 503 | `{ error: "CRON_SECRET is not configured." }` |
| `GET` request | 410 | `Gone` |
| `PUT/PATCH/DELETE` | 405 | `Method Not Allowed` |

### What the cron does

1. Selects every application whose `next_reminder_at <= now()` and status is non-terminal.
2. Skips applications that already have a successful dispatch today (the partial unique index `reminder_dispatches_app_day_success_idx` enforces this at the DB layer).
3. Sends one email per due application via Resend with a stable idempotency key.
4. Writes a row to `reminder_dispatches` regardless of success or failure.

### Re-run safely on the same day

Because of the idempotency layers, re-running the cron within the same UTC day should return `totals.skipped: 1` (or more) instead of sending duplicate emails. Confirm by querying:

```sql
select * from reminder_dispatches order by sent_at desc limit 5;
```

### Production/external cron

In production the route is triggered by an **external cron service** (e.g. cron-job.org, GitHub Actions) because Vercel native cron fires `GET` requests, and this route rejects `GET`.

- **URL:** `https://<your-domain>/api/cron/reminders`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <CRON_SECRET>`
- **Schedule:** `0 9 * * *` (09:00 UTC daily)

---

## Common failures and fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `pnpm install` fails with lockfile mismatch | `package.json` changed without updating `pnpm-lock.yaml` | Run `pnpm install` (without `--frozen-lockfile`) and commit the updated lockfile |
| `pnpm dev` fails with module not found | Dependencies not installed | Run `pnpm install --frozen-lockfile` |
| `pnpm typecheck` reports Supabase type errors | `database.types.ts` is out of sync with migrations | Run `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts` |
| `pnpm build` fails with missing env | Next.js reads env at build time | Ensure `.env.local` exists (values can be placeholders for the static pipeline) |
| Magic link never arrives | Site URL mismatch in Supabase Auth | Set Auth → URL Configuration → Site URL to `http://localhost:3000` |
| 401 on server actions | Missing Supabase URL/key or unauthenticated session | Verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the active login session |
| Cron returns 503 | `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` missing | Check `.env.local` and restart `pnpm dev` |
| Cron returns 0 sent but dashboard shows reminders | Resend env missing or invalid | Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set and the sender domain is verified |
| Upload rejected | File size > 10 MB or wrong MIME type | Use PDF or DOCX under 10 MB |

---

## Static checks vs. real-service checks

| Category | Checks | Needs live Supabase? | Needs Resend? | Runs in CI? |
|----------|--------|----------------------|---------------|-------------|
| **Static** | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` | No | No | Yes |
| **Real-service** | Auth, CRUD, storage uploads, email dispatch, cron | Yes | Yes *(for reminders)* | No |

- Static checks prove code correctness, types, and pure-function behaviour.
- Real-service checks prove RLS policies, storage permissions, trigger behaviour, and external integrations.
- The [`smoke-tests.md`](smoke-tests.md) checklist maps every spec scenario to either a ✅ static test or a 🔁 manual runtime check.

---

## Next steps

- See [`requirements.md`](requirements.md) for the full provisioning checklist (Supabase / Resend / Vercel accounts).
- See [`smoke-tests.md`](smoke-tests.md) for the per-spec-scenario verification matrix.
- See [`../openspec/changes/gestjobs-mvp/design.md`](../openspec/changes/gestjobs-mvp/design.md) for architecture decisions.
