# gestjobs

A personal job-application tracker that keeps every role, status change, contact, resume version, and follow-up reminder in one place — so nothing falls through the cracks.

> **Current status:** Foundation scaffold is live (Next.js 15 + Supabase Auth + schema + storage). Core features — applications, platforms, contacts, resumes, reminders, and dashboard — are planned in a 7-phase MVP chain and will land in subsequent PRs.

## Quick start

1. **Prerequisites** — see [`docs/requirements.md`](docs/requirements.md) for Node.js, pnpm, Git, and service accounts.
2. **Install & run locally**
   ```bash
   pnpm install
   pnpm dev
   ```
3. **Verify static checks**
   ```bash
   pnpm typecheck   # tsc --noEmit
   pnpm build      # production build
   ```
4. Open [http://localhost:3000](http://localhost:3000) and sign in via magic link.

## What exists today (Foundation)

| Capability | Status | Notes |
|------------|--------|-------|
| Next.js 15 App Router scaffold | ✅ Live | Home page + login page + layout |
| Magic-link authentication | ✅ Live | Supabase Auth `signInWithOtp` |
| Session middleware | ✅ Live | Cookie-based SSR session refresh |
| Postgres schema + RLS | ✅ Live | 9 tables, per-user policies, storage buckets |
| Global platform seed | ✅ Live | 10 Latin-American boards preloaded |
| TypeScript types stub | ✅ Live | `database.types.ts` ready for `supabase gen types` |
| Environment template | ✅ Live | `.env.example` with all required keys |

## What comes next (MVP slices)

| Slice | PR | Features |
|-------|-----|----------|
| Platforms | PR 2 | URL hostname inference, searchable combobox, custom platform persistence |
| Contacts + Resumes | PR 3 | Directory CRUD, versioned uploads, metadata |
| Applications | PR 4 | CRUD, status workflow + history, job proposal capture, attachments |
| Reminders + Dashboard | PR 5 | 15-day reminder scheduling, email dispatch, status counters, pending list |
| Verification + Tooling | PR 6 | Vitest, ESLint/Prettier, CI workflow, smoke tests |
| Publication | PR 7 | Public GitHub repo, license, release tag |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.6 |
| Styling | Tailwind CSS 3 |
| Database / Auth / Storage | Supabase (PostgreSQL + Auth + Storage) |
| Email (future) | Resend |
| Package manager | pnpm 9 |
| Runtime | Node.js ≥ 20 |
| Deployment target | Vercel |

## Local development commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start Next.js dev server on `:3000` |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript check without emit |
| `pnpm lint` | ESLint (config deferred to PR 6) |

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. `.env.local` is gitignored.

| Variable | Source | Used by |
|----------|--------|---------|
| `NEXT_PUBLIC_APP_URL` | Set to `http://localhost:3000` locally | App links |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | Client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API | Server actions / cron |
| `RESEND_API_KEY` | Resend → API Keys | Cron email (PR 5) |
| `RESEND_FROM_EMAIL` | Your verified Resend domain | Cron email (PR 5) |
| `RESEND_REPLY_TO` | Your email address | Cron email (PR 5) |
| `CRON_SECRET` | Generate with `openssl rand -hex 32` | Cron route auth |

> **Security:** never commit `.env.local` or real keys. Rotate leaked credentials immediately.

See [`docs/requirements.md`](docs/requirements.md) for the full setup guide: creating accounts, linking projects, running migrations, and security rules.

## Service provisioning guides

Before continuing implementation or enabling a preview deployment, follow the guides in [`docs/services/`](docs/services/README.md):

- [Supabase](docs/services/supabase.md) — database, Auth, Storage, migrations, and RLS.
- [Resend](docs/services/resend.md) — verified sending domain and reminder email delivery.
- [Vercel](docs/services/vercel.md) — environments, deployment, and cron configuration.
- [GitHub Actions](docs/services/github-actions.md) — CI workflow and branch protection.

## Planning artifacts

| Document | Purpose |
|----------|---------|
| [Proposal](openspec/changes/gestjobs-mvp/proposal.md) | Intent, scope, capabilities, approach, risks, success criteria |
| [Exploration](openspec/changes/gestjobs-mvp/exploration.md) | Requirement clarification and assumption exploration |
| [Design](openspec/changes/gestjobs-mvp/design.md) | Architecture, data model, component map, sequence flows |
| [Tasks](openspec/changes/gestjobs-mvp/tasks.md) | Hierarchical implementation plan with dependencies and estimates |

## Module specifications

| Module | Spec |
|--------|------|
| Applications | [spec.md](openspec/changes/gestjobs-mvp/specs/applications/spec.md) |
| Contacts | [spec.md](openspec/changes/gestjobs-mvp/specs/contacts/spec.md) |
| Dashboard | [spec.md](openspec/changes/gestjobs-mvp/specs/dashboard/spec.md) |
| Platforms | [spec.md](openspec/changes/gestjobs-mvp/specs/platforms/spec.md) |
| Reminders | [spec.md](openspec/changes/gestjobs-mvp/specs/reminders/spec.md) |
| Resumes | [spec.md](openspec/changes/gestjobs-mvp/specs/resumes/spec.md) |

## License

MIT (to be added in PR 7 — Publication phase).
