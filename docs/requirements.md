# Setup Requirements

This guide covers everything needed to run **gestjobs** locally and deploy it. Read it once, check the boxes, and you are ready to code.

> **Scope:** Foundation is implemented; later MVP slices (Applications, Platforms, Reminders, Dashboard, etc.) are deferred to upcoming PRs. This document reflects what you need **today** plus the accounts required for those future phases.

---

## Prerequisites checklist

- [ ] **Node.js** ≥ 20.0.0 (check `node --version` against `package.json#engines`)
- [ ] **pnpm** 9.x (`corepack enable` or `npm install -g pnpm@9`)
- [ ] **Git** (any recent version)
- [ ] **GitHub account** (for publication in PR 7)

---

## Required services and accounts

### 1. Supabase (required now)

Supabase provides PostgreSQL, authentication, and file storage.

| Step | Action |
|------|--------|
| Create project | [supabase.com](https://supabase.com) → New Project → note the **Project ref** and **Project URL** |
| API keys | Dashboard → Project Settings → API → copy **anon public** and **service_role secret** keys |
| Auth settings | Dashboard → Authentication → URL Configuration → set Site URL to `http://localhost:3000` for local dev |

**What the app uses:**
- `auth.users` for magic-link sign-in
- PostgreSQL tables with Row-Level Security (RLS)
- Storage buckets `resumes` and `proposals` with signed URLs

### 2. Resend (required for PR 5 — Reminders)

Resend sends transactional reminder emails.

| Step | Action |
|------|--------|
| Create account | [resend.com](https://resend.com) → Sign up |
| Verify domain | Add and verify a sending domain (e.g., `your-domain.com`) |
| Generate API key | Dashboard → API Keys → create a key starting with `re_` |

> **Deferred:** No email features exist until PR 5. You can skip Resend until then, but creating the account early avoids blocking later work.

### 3. Vercel (required for deployment)

Vercel hosts the Next.js app and runs the cron job for reminders.

| Step | Action |
|------|--------|
| Create account | [vercel.com](https://vercel.com) → Sign up (free Hobby tier is sufficient) |
| Link project | Import the GitHub repo, or use `vercel` CLI to link an existing project |
| Add env vars | Copy every variable from `.env.local` into Vercel Project Settings → Environment Variables |
| Enable cron | PR 5 adds `vercel.json` with `"0 9 * * *"` schedule; no cron exists today |

---

## Local commands

Run these from the repo root after prerequisites are satisfied.

| Command | Purpose | When to run |
|---------|---------|-------------|
| `pnpm install` | Resolve and lock dependencies | First clone, or after `package.json` changes |
| `pnpm dev` | Start Next.js dev server on `:3000` | Every coding session |
| `pnpm build` | Production build with static prerendering | Before pushing, or to verify bundle |
| `pnpm typecheck` | TypeScript check without emit | Before every PR |
| `pnpm lint` | ESLint pass (config deferred to PR 6) | After PR 6 lands |
| `pnpm start` | Serve the production build locally | After `pnpm build` |

---

## Supabase project setup

After creating a Supabase project, apply the schema and seed data.

| Step | Command / Action |
|------|----------------|
| Install Supabase CLI | `npm install -g supabase` (or use the latest installer for your OS) |
| Link project | `supabase link --project-ref <your-project-ref>` |
| Push migrations | `supabase db push` — applies `001_initial_schema.sql` + `002_storage_buckets.sql` |
| Reset + seed (local) | `supabase db reset` — applies migrations + runs `seed.sql` (global platforms) |
| Generate types | `supabase gen types typescript --linked > src/lib/supabase/database.types.ts` |

> **Note:** The schema includes an `after insert on auth.users` trigger that creates the seven default statuses for every new user (`Applied`, `Screening`, `Interview`, `Offer`, `Hired`, `Rejected`, `Withdrawn`). You do **not** need to run a separate status seed.

---

## Environment setup

1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and replace every placeholder with real values from your Supabase (and Resend, if ready) dashboards.
3. Verify `.env.local` is gitignored:
   ```bash
   git check-ignore .env.local
   ```
   Expected output: `.env.local`

### Variable reference

| Variable | Example value | Where it comes from |
|----------|---------------|---------------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Your local/dev base URL |
| `SUPABASE_PROJECT_REF` | `abc123` | Supabase project URL/dashboard; used by the CLI |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc123.supabase.co` | Supabase Dashboard → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase Dashboard → API (public anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Supabase Dashboard → API (service role key — keep secret) |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxx` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | `GestJobs <noreply@your-domain.com>` | Verified Resend domain |
| `RESEND_REPLY_TO` | `you@example.com` | Your personal email |
| `CRON_SECRET` | `a1b2c3d4...` (64 hex chars) | `openssl rand -hex 32` |

---

## Security rules for secrets

| Rule | Why it matters |
|------|----------------|
| **Never commit `.env.local` or real keys.** | It is already gitignored; double-check before every commit. |
| **Rotate immediately if leaked.** | Supabase and Resend both allow key regeneration in seconds. |
| **Use `NEXT_PUBLIC_` only for values safe in browser bundles.** | The anon key is designed for the client; the service role key is server-only. |
| **Scope service_role to server actions and cron routes.** | Never expose it in client-side code or logs. |
| **CRON_SECRET must be long and random.** | It is the only gate on the reminder dispatch endpoint. |

---

## What is deferred to later implementation phases

| Feature | Planned PR | What is missing today |
|---------|-----------|----------------------|
| Platform inference + combobox | PR 2 | No `infer.ts`, no combobox component, no custom platform upsert |
| Contacts directory + Resumes | PR 3 | No contact/resume pages, no upload actions |
| Applications CRUD + status workflow | PR 4 | No application list, create form, detail view, or status history |
| Reminder scheduling + email | PR 5 | No reminder trigger, no Resend integration, no cron route, no dashboard |
| Testing + CI | PR 6 | No Vitest, no ESLint config, no GitHub Actions workflow |
| Publication | PR 7 | No public repo, no LICENSE, no release tag |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `pnpm dev` fails with module not found | Dependencies not installed | Run `pnpm install` |
| `pnpm typecheck` reports Supabase type errors | `database.types.ts` is out of sync | Run `supabase gen types typescript --linked` |
| Magic link never arrives | Site URL mismatch in Supabase Auth | Set Site URL to `http://localhost:3000` |
| 401 on server actions | Missing or mismatched `SUPABASE_SERVICE_ROLE_KEY` | Verify `.env.local` matches the Supabase project |
