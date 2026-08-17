# Proposal: gestjobs MVP

## Intent

Help individual job seekers track every application, its status history, contacts, resumes, and reminders in one place. Outcome: a web app that reduces dropped follow-ups and keeps the job search organized. **Clarified scope: every application must be tied to a job platform with URL-based inference and a searchable combobox fallback.**

## Scope

### In Scope
- CRUD applications with status workflow, history, and **mandatory platform association**
- **Platform inference from URL hostname/domain, with searchable combobox + free-text fallback**
- **Preloaded well-known job platforms in Latin America (especially Uruguay)**
- 15-day follow-up reminders (in-app + email)
- Job proposal capture (text, file, URL)
- Multiple resume versions with metadata and per-application attachment
- Contacts (directory + per-application role)
- Lightweight dashboard: counts by status, pending reminders

### Out of Scope
- Team collaboration / multi-tenant sharing
- Analytics beyond simple counters
- Browser extension, auto-import, calendar sync
- Mobile apps (PWA acceptable stretch)
- AI-generated cover letters, salary tracking
- Localization beyond English
- Content scraping for platform detection (hostname only)

## Capabilities

### New Capabilities
- `applications`: create, read, update, delete, status workflow, history, reminders, **mandatory platform linked by URL with inference fallback**
- `platforms`: preloaded Latin-American job boards (especially Uruguay), searchable combobox with free-text/custom entry, hostname-to-platform inference
- `resumes`: versioned uploads, metadata, per-application attachment
- `contacts`: directory, reusable across applications with roles
- `reminders`: 15-day schedule, in-app surface, email dispatch
- `dashboard`: status counts, pending reminders list

### Modified Capabilities
- None

## Approach

Next.js 15 (App Router) + TypeScript + Tailwind CSS, deployed to Vercel. Supabase for PostgreSQL, auth, and file storage (resumes). Resend for transactional email. **Platform inference runs client-side from URL hostname; failed inference falls back to a searchable combobox with free-text entry. Seed data includes well-known Latin-American boards. Store normalized platform URL on every application.** Single-user accounts with `user_id` on every entity to preserve future multi-account possibility. Reminders computed from `last_update_date` and surfaced in-app; email sent via scheduled job. Free-tier limits (Supabase storage/DB, Resend) need validation before heavy usage.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app` | New | Next.js app router pages and layouts |
| `src/lib/db` | New | Supabase client, schema, migrations |
| `src/lib/auth` | New | Auth setup (Supabase Auth) |
| `src/lib/email` | New | Resend integration for reminders |
| `src/lib/platforms` | New | Seed data, inference logic, platform directory |
| `src/components` | New | UI components (Tailwind), including platform combobox |
| `openspec/specs` | New | Specs for applications, platforms, resumes, contacts, reminders, dashboard |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Free-tier limits exceeded | Med | Validate Supabase/Resend limits before launch; add usage guards |
| Reminder silent failure | Med | In-app pending section is primary surface; email is secondary |
| Stack lock-in | Low | Next.js + Supabase is portable to self-hosted if needed |
| Resume PII exposure | Med | Row-level security via Supabase; signed URLs for downloads |
| **Platform inference misses obscure boards** | **Med** | **Free-text fallback + allow user to save new custom platform** |
| **Seed data stale/incomplete** | **Low** | **User adds custom platforms; seed via migration** |

## Rollback Plan

Database is fresh; rollback = delete Vercel project and Supabase project. No migration of existing user data needed.

## Dependencies

- Supabase project provisioned
- Resend account + domain verified
- Vercel project linked

## Success Criteria

- [ ] User can create an application, change status, and see history
- [ ] **Application form requires platform URL and infers platform automatically from hostname**
- [ ] **Manual fallback (searchable combobox + free text) works when inference fails**
- [ ] **Well-known Latin-American platforms are preloaded and selectable**
- [ ] Reminder appears in pending section 15 days after last update
- [ ] Email reminder is sent for due items
- [ ] Resume can be uploaded, versioned, and attached to an application
- [ ] Dashboard shows application counts and upcoming reminders

## Assumptions & Decisions

- Single-user app; schema keeps `user_id` for future multi-account.
- Reminder fires 15 days after `last_update_date` while status is non-terminal.
- Job proposal: pasted text, uploaded file, or URL.
- Status values ship with sensible defaults and are user-configurable.
- English UI only.
- **Platform is mandatory on every application.**
- **Platform inference is hostname-based only (no content scraping).**
- **Custom platforms entered by users are persisted for reuse.**
- **Platform seed list targets Latin America, especially Uruguay.**

## Proposal Question Round

Since the user already clarified platform requirements in detail, this round flags assumptions needing review rather than asking new questions:

1. **Inference scope**: We assume hostname-only inference (no page scraping). Confirm this is acceptable.
2. **Custom platforms privacy**: We assume custom platforms a user enters are private to that user (not shared/crowdsourced). Confirm.
3. **Seed maintenance**: We assume the initial seed list is hardcoded and updated via migrations, not fetched from an external API. Confirm.
