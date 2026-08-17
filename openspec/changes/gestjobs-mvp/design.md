# Design: gestjobs MVP

## Technical Approach

Build a full-stack web app on the **Next.js 15 App Router** with TypeScript and Tailwind CSS, deployed to **Vercel**. Use **Supabase** for PostgreSQL, authentication, and object storage. Use **Resend** for transactional reminder email. The domain model keeps `user_id` on every tenant-scoped table so the app can grow into multi-account later without a migration. Client-side URL hostname parsing infers the job platform; a seeded directory plus per-user custom platforms provides the searchable combobox fallback. Reminders are recomputed idempotently from the latest status-change timestamp (falling back to `application_date`) and surfaced in-app; email dispatch is secondary and logged.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| Framework | Next.js 15 App Router vs Express+React SPA vs Django | App Router gives one deploy, Server Actions, RSC, and fastest Vercel integration; SPA needs two builds; Django adds a second language. | Next.js 15 App Router |
| Database / Auth / Storage | Supabase vs PlanetScale+Clerk+S3 | Supabase bundles Postgres, Auth, and Storage with generous free tier and built-in RLS; PlanetScale has no storage. | Supabase |
| Email provider | Resend vs Postmark vs AWS SES | Resend free tier is 100 emails/day, easy domain verification, and good deliverability; SES is cheaper but more setup. | Resend |
| Auth method | Magic link vs OAuth (Google/GitHub) vs email+password | Magic link avoids password management and fits a single-user tool; OAuth can be added later without schema changes. | Supabase Auth magic link (OAuth ready) |
| File storage | Supabase Storage vs Vercel Blob | Storage is included in Supabase free tier and shares RLS/auth context; Blob adds another vendor. | Supabase Storage |
| Reminder base time | `last_update_date` vs latest status change vs `application_date` | Status change is the strongest signal for follow-up; fallback to `application_date` satisfies the reminder spec. | Latest status-change timestamp, fallback to `application_date` |
| Multi-tenancy prep | Add `user_id` now vs migrate later | Adding `user_id` later touches every query and RLS policy; cost now is one column per table. | Include `user_id` on all tenant tables now |
| Platform inference | Client-side hostname parse vs server action | Hostname extraction is deterministic and avoids a network round-trip; validation still runs server-side. | Client-side parse + server validation |

## Data Flow

```
User ──→ Next.js App Router (RSC / Server Action)
              │
              ├──→ Supabase Auth (session / user_id)
              │
              ├──→ Supabase Postgres (applications, history, reminders, etc.)
              │         │
              │         └──→ pg_cron / Vercel Cron  (reminder recompute)
              │
              ├──→ Supabase Storage (resumes + proposal files)
              │         └──→ signed URLs for download
              │
              └──→ Resend (due reminder email)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Create | Next.js 15, React 19, TypeScript, Tailwind, Supabase SSR client, Resend SDK |
| `.env.example` | Create | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` |
| `src/lib/supabase/client.ts` | Create | Browser + server Supabase clients with cookie auth |
| `src/lib/supabase/database.types.ts` | Create | Generated TypeScript types from Supabase schema |
| `supabase/migrations/001_initial_schema.sql` | Create | Tables, indexes, RLS policies, functions |
| `supabase/seed.sql` | Create | Default statuses and Latin-American platforms (Gallito, Computrabajo, BuscoJobs, LinkedIn, Indeed, etc.) |
| `src/lib/platforms/infer.ts` | Create | `inferPlatformFromUrl(url, platforms)` hostname normalizer + matcher |
| `src/components/platform-combobox.tsx` | Create | Searchable combobox with custom-entry fallback |
| `src/app/(auth)/login/page.tsx` | Create | Magic-link login page |
| `src/app/dashboard/page.tsx` | Create | Status counters + pending reminders |
| `src/app/applications/page.tsx` | Create | Application list |
| `src/app/applications/[id]/page.tsx` | Create | Application detail, status history, contacts, resume |
| `src/app/applications/new/page.tsx` | Create | Create application form with platform inference |
| `src/app/api/cron/reminders/route.ts` | Create | Vercel cron route: recompute reminders, send emails |
| `src/lib/email/resend.ts` | Create | Idempotent reminder email sender with logging |
| `src/lib/reminders/schedule.ts` | Create | Pure function `computeNextReminderAt(lastStatusChangedAt, applicationDate)` |
| `src/lib/validation/application.ts` | Create | Zod schemas for application, platform URL, proposal URL |
| `vercel.json` | Create | Cron schedule: `"0 9 * * *"` |

## Interfaces / Contracts

### Core tables (simplified SQL)

```sql
create table statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  is_terminal boolean not null default false,
  sort_order int not null default 0
);

create table platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id), -- null for global seeds
  name text not null,
  hostname text not null, -- normalized, e.g. "boards.greenhouse.io"
  is_custom boolean not null default false
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  company_name text not null,
  position_title text not null,
  platform_id uuid references platforms(id) not null,
  platform_url text not null,
  application_date date not null default current_date,
  status_id uuid references statuses(id) not null,
  job_proposal_text text,
  job_proposal_url text,
  job_proposal_file_path text,
  next_reminder_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  from_status_id uuid references statuses(id),
  to_status_id uuid references statuses(id) not null,
  changed_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  email text,
  phone text,
  linkedin_url text,
  notes text
);

create table application_contacts (
  application_id uuid references applications(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  role text not null,
  primary key (application_id, contact_id, role)
);

create table resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  label text not null,
  file_path text not null,
  file_hash text not null,
  file_size int not null,
  created_at timestamptz default now()
);

create table application_resumes (
  application_id uuid references applications(id) on delete cascade primary key,
  resume_id uuid references resumes(id) on delete cascade not null,
  attached_at timestamptz default now()
);

create table reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  sent_at timestamptz default now(),
  provider_message_id text,
  error text
);
```

### RLS policy pattern

Every tenant table gets:

```sql
alter table applications enable row level security;
create policy "Users can only access their own applications"
  on applications for all
  using (user_id = auth.uid());
```

Storage buckets (`resumes`, `proposals`) use RLS policies scoped to `auth.uid()` and return signed URLs valid for 1 hour.

### Reminder contract

```ts
function computeNextReminderAt(
  applicationDate: Date,
  lastStatusChangeAt: Date | null,
  statusIsTerminal: boolean
): Date | null {
  if (statusIsTerminal) return null;
  const base = lastStatusChangeAt ?? applicationDate;
  return addDays(base, 15);
}
```

A database trigger on `application_status_history` calls a Postgres function to update `applications.next_reminder_at`. The cron route recalculates any row where `next_reminder_at <= now()` and `sent_at` is null for today, sends one email per application, and writes to `reminder_dispatches` for idempotency.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `inferPlatformFromUrl`, `computeNextReminderAt`, Zod schemas | Vitest (add when runner is provisioned) |
| Integration | Server Actions: create application, status change writes history, RLS isolation | Supabase test project or `supabase test db` |
| E2E | Login, create application, dashboard counters, reminder appears | Playwright against preview deploy |
| Contract | Resend send + idempotency, signed URL generation | Stub provider in integration tests |

## Migration / Rollout

1. Provision Supabase project and run migrations.
2. Seed statuses and platforms.
3. Configure Supabase Auth (magic link template, site URL).
4. Verify Resend domain and set API key.
5. Deploy to Vercel, add environment variables, enable cron.
6. Smoke test: create application, change status, confirm reminder recompute.

Rollback: delete Vercel and Supabase projects; no user data exists yet.

## Provider Free-Tier Assumptions

| Provider | Free Tier | Assumption |
|----------|-----------|------------|
| Vercel | Hobby: 100 GB bandwidth, 10 s serverless functions | Cron + Server Actions fit within limits |
| Supabase | 500 MB DB, 1 GB storage, 2 GB egress, 50k MAU auth | Single-user MVP is far below limits |
| Resend | 100 emails/day | 15-day reminder cadence produces at most ~2 emails/user/day |

## Deferred Decisions

- OAuth providers (Google, LinkedIn) — schema supports them, UI deferred.
- Push notifications / SMS — out of MVP scope.
- Encryption-at-rest for resumes — Supabase handles storage encryption; client-side encryption deferred.
- Custom reminder cadence — hard-coded 15 days.
- Analytics beyond status counters — post-MVP.
- PWA/offline support — stretch goal.
- Organization/team sharing — requires explicit tenant model later.

## Open Questions

- [ ] Confirm Resend sender domain (e.g., `gestjobs.com`) is available and verified.
- [ ] Confirm exact Latin-American/Uruguayan platform seed list.
- [ ] Decide whether `ghosted` is terminal for reminder suppression.
- [ ] Choose whether reminders reset on note addition or only status change (spec says status change only).
