## Exploration: gestjobs MVP — Job Application Tracker

### Current State

gestjobs is an **empty skeleton**. The repository at `C:\Users\jlima\Documents\Proyects\gestjobs` contains only two top-level folders:

- `.atl/` — tool bookkeeping (skill registry, testing-capabilities cache)
- `openspec/` — SDD-driven change management scaffolding (`config.yaml`, `changes/`, `specs/`)

No source code, no manifest (no `package.json`, `Cargo.toml`, `pyproject.toml`, `Gemfile`, `go.mod`), no Dockerfile, no test runner, no DB schema, and no prior changes/archives under `openspec/changes/`. `sdd-init` ran on `2026-08-17` and recorded the configuration below:

| Setting | Value |
| --- | --- |
| `artifact_store.mode` | `openspec` |
| `execution_mode` | `interactive` |
| `delivery_strategy` | `ask-always` |
| `review_budget_lines` | `400` |
| `strict_tdd` | `false` (no test runner provisioned) |

There is nothing to refactor, integrate with, or migrate. This exploration is **net-new design**, not a refactor of existing behavior.

### Affected Areas

Because the repo is empty, no existing files change. The following paths will be created by later SDD phases:

- `openspec/specs/applications/spec.md` — main spec for the job-application domain
- `openspec/specs/companies/spec.md` (optional) — shared sub-domain
- `openspec/specs/contacts/spec.md` (optional) — networking sub-domain
- `openspec/specs/resumes/spec.md` (optional) — versioned-resume sub-domain
- `openspec/specs/reminders/spec.md` (optional) — reminder/notification sub-domain
- `openspec/changes/gestjobs-mvp/{proposal,specs,design,tasks}.md` — change artifacts
- Project root — stack manifests, source tree, migrations, seed data

### Domain Concepts

**Core domain**: an individual job seeker tracking every job they have applied to, where each application has a lifecycle, a status, follow-up cadence, related contacts, attached artifacts (resumes, links, job description), and a timeline.

#### Entities (tentative)

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `Application` | Root aggregate for a single application to a company for a position. | `id, user_id, company_name, position_title, source_url, job_proposal_text, status, application_date, last_update_date, next_reminder_at, salary_range, location, notes, created_at, updated_at` |
| `StatusHistory` | Append-only audit row for every status change on an application. | `id, application_id, from_status, to_status, changed_at, reason` |
| `Contact` | Person involved in one or more applications (recruiter, hiring manager, employee referrer). | `id, user_id, name, role, email, phone, linkedin_url, notes` |
| `ApplicationContact` | Join table — which contact plays which role on which application. | `application_id, contact_id, role, is_primary` |
| `Link` | Typed URL attached to an application (posting, ATS, offer, online assessment). | `id, application_id, kind, url, label` |
| `JobProposal` | Structured snapshot of the job posting the user applied to. Can be inline on `Application` or a child entity. | `description, requirements, salary_min, salary_max, currency, location, employment_type, seniority, tech_stack[]` |
| `Resume` | Versioned resume artifact owned by the user. | `id, user_id, label, version, file_path_or_url, file_hash, created_at, notes` |
| `ApplicationResume` | Join table — which resume was attached to which application and when. | `application_id, resume_id, attached_at` |
| `Reminder` | Scheduled reminder. MVP rule: fire `15 days` after `last_update_date` while application is in an open status. | `id, application_id, kind, due_at, fired_at, dismissed_at` |
| `Note` | Free-text journal entry on an application (interview notes, follow-ups, conversations). | `id, application_id, body, occurred_at` |

#### Sub-domains (Bounded Contexts)

1. **Applications** — CRUD + status workflow + timeline view.
2. **Companies** — lookup, deduplication, applied-to count.
3. **Contacts** — directory independent of any single application.
4. **Resumes** — version lifecycle, file storage, reuse across applications.
5. **Reminders** — scheduling, dispatching, snoozing.
6. **Reporting** — optional stretch (count by status, weekly cadence, age buckets).

#### Workflow

A typical application walks through:

```
draft → applied → screening → interview → offer → hired
                                    ↘ rejected (terminal)
                                    ↘ withdrawn (terminal)
                                    ↘ ghosted (terminal, soft)
```

`last_update_date` advances on every status change, note add, or contact log. A `Reminder` is recomputed to `last_update_date + 15 days` whenever `last_update_date` moves and the application is still open.

### Assumptions (explicit)

These are reasonable defaults we will adopt **unless** the user overrides them in the questions below.

- A1. Single-user accounts; no team collaboration in MVP.
- A2. Web app only. No native iOS/Android in MVP.
- A3. English UI and seeded fixtures.
- A4. The `15-day` reminder is fired from `last_update_date` (not from `application_date`) and only while the application is in a non-terminal status.
- A5. `JobProposal`/`JobDescription` is **structured + freeform**. MVP uses both: structured fields (salary, location, type, seniority, tech) and an optional blob of the original posting.
- A6. Resumes are user-owned, versioned, and may be reused across applications. Each application records which version was attached.
- A7. Contacts are user-owned, may be reused across applications, with a join table for role-per-application.
- A8. Reminders are surfaced **in-app at minimum** (badge + dashboard widget + per-application banner). Email/push/bot delivery is a stretch goal.
- A9. Status is **free-form configurable** by the user (manageable list, not hard-coded), but ships with a sane default set.
- A10. Files are stored in **the app's filesystem or object storage**, not as base64 blobs in the DB. PDFs for resumes are the expected format; uploads of DOCX are accepted.
- A11. Authentication is required; no anonymous/local-only mode.

### Scope Boundaries

**In scope for MVP (`gestjobs-mvp`)**

- Create / read / update / delete applications
- Status workflow + history
- Application date + last-update-date (auto-managed)
- 15-day follow-up reminders (in-app surface; cron-driven)
- Per-application links (posting, ATS, offer letter, etc.)
- Job proposal/descrption (structured + freeform)
- Contacts (create/edit/reuse, attach to applications)
- Multiple resume versions (upload/label/attach)
- Lightweight dashboard: counts by status, upcoming reminders

**Out of scope for MVP (post-MVP candidates)**

- Team collaboration / shared trackers
- Analytics dashboards and reports beyond the simple counters
- Browser extension for one-click capture from LinkedIn / Indeed
- Auto-import via email parsing or ATS scraping
- Interview round scheduling and calendar integration
- Public portfolio / shareable profile pages
- Mobile apps (iOS/Android, PWA is acceptable stretch)
- Salary history tracking and negotiation assistant
- AI-generated cover letters or resume tailoring
- Webhook / Zapier / Make integrations
- Multi-language UI and localization

### Approaches

Three viable stack/architecture directions. All three satisfy the requirements; the differences are in team fit, deployment, and iteration speed.

| # | Approach | Summary | Pros | Cons | Effort |
| - | --- | --- | --- | --- | --- |
| 1 | **Next.js (App Router) + PostgreSQL + Prisma + Auth.js** | Single full-stack TypeScript app. Server Actions, route handlers, RSC, server-side rendering, file-based routing. | Fastest path to a polished web UI; one repo, one deploy (Vercel, Render, Fly); strong type-safety with Prisma; Auth.js gives us social login (Google, GitHub, LinkedIn) trivially. | Tied to React/Next; serverless cold starts if deployed serverless; some lock-in to App Router conventions. | Low–Med |
| 2 | **Express/Fastify + React (Vite) + PostgreSQL + Drizzle + Lucia** | Decoupled front-end SPA + REST/tRPC API. Clear separation between UI and API services. | Portable across hosts (Docker, VPS, bare-metal); cleaner mental model for "web API + web client"; easy to add a second client (mobile, CLI) later. | Two repos or one with two apps; more glue code; auth/SSR considerations must be done explicitly. | Med |
| 3 | **Django + DRF + HTMX (or React) + PostgreSQL** | Batteries-included Python backend with auto-generated admin; optional React/HTMX front-end. | Built-in admin is a free dev win; ORM, migrations, auth, sessions, file uploads, i18n all included; great for solo builders; one language (Python) end-to-end. | Two ecosystems (Django back-end + chosen front-end); smaller modern TypeScript/React ecosystem if you want SPA UX. | Med |

All three support the same functional surface; the choice is mostly **stack preference** rather than feasibility.

For each architecture, the reminder pipeline is identical:

1. Application update bumps `last_update_date`.
2. A scheduled job (cron, pg_cron, or a worker) recomputes `next_reminder_at = last_update_date + 15 days` for any open application.
3. UI queries `/dashboard` to surface due/overdue reminders.
4. User dismisses or acts → reminder advances.

### Ambiguities & Concrete Product Questions

The 15 questions below are ordered by **how much they block downstream phases**. The first cluster is blocking; the rest can wait until apply.

**Blocking (must answer before `sdd-propose`)**

1. **Stack & deployment.**
   - Which stack do you want to commit to? Next.js full-stack (Approach 1), decoupled Express/Fastify + React (Approach 2), or Django + DRF (Approach 3)?
   - Deployment target? Vercel / Fly.io / Render / VPS / Docker?

2. **Multi-user / tenancy.**
   - Single-user accounts only, or will there be shared trackers (e.g., career coaches and their clients)? This affects every entity (`user_id` columns, auth, row-level isolation).

3. **Authentication provider.**
   - Email + password, magic-link, OAuth (Google / LinkedIn / GitHub), or a combination?
   - LinkedIn OAuth would be the most useful for a job-tracking app; do you want it?

4. **Reminder delivery channel.**
   - In-app only (badge + dashboard), or also email, browser push, or webhook?
   - If email: do you want a managed provider (Resend, Postmark, SES) or self-hosted SMTP?

5. **15-day semantics.**
   - Confirm the rule: fire 15 days **after** `last_update_date` while the application is in an open status. Or do you want: (a) 15 days after `application_date` if no update, (b) a customizable cadence per application, (c) a configurable default that the user can override?
   - What "open" means: confirm the terminal states are `rejected`, `withdrawn`, `hired`; "ghosted" remains open or moves to terminal?

6. **Job proposal / job description capture.**
   - Is it just a paste-the-posting freeform blob? Or do you want structured fields (salary range, location, employment type, seniority, tech stack)?
   - If structured, which fields are required vs optional?

7. **Resume versions.**
   - How are versions identified — strict linear (`v1`, `v2`, `v3`) or labeled (`Frontend-Senior`, `Backend-Junior`, `Staff`)?
   - Should versioning be automatic (every upload becomes a new version) or manual (user selects "save as new version")?
   - File format expectation: PDF only, or also DOCX/Markdown?
   - Storage location: app-local filesystem, S3-compatible, or something else?

**Important (recommended before `sdd-design`)**

8. **Status values.**
   - Fixed enum (Applied / Screening / Interview / Offer / Hired / Rejected / Withdrawn / Ghosted) or user-defined?
   - Are statuses a flat list or hierarchical (e.g., `Interview.Round1`)?

9. **Notes / timeline granularity.**
   - Notes per application only, or threaded notes (Q&A within a note)? Do you want to log who-said-what (a contact attached to a note)?

10. **Links taxonomy.**
    - Free-form URL list, or typed (Posting / ATS Portal / Offer Letter / Online Assessment / Take-home Submission / Other)?

11. **Contacts.**
    - Reusable across applications (lookup-style) or created fresh per application?
    - Do you want reminder automation tied to a contact (e.g., follow up with `John from Acme`)?

12. **Data import / export.**
    - CSV/JSON import of historical applications? Export the tracker at any time? (Useful for solo builders; cheap to add.)

**Lower priority**

13. **Dashboard / analytics.**
    - Counts by status only (MVP) or richer analytics (avg days-in-stage, response rate, weekly cadence)?
14. **File size limits.**
    - Max file size per resume upload? Validation rules (must be PDF, must not be password-protected)?
15. **Internationalization.**
    - English only, or i18n from day one?

### Risks

- **R1. Stack lock-in.** Each Approach carries an ecosystem preference that is hard to walk back once the database schema and ORM are committed. ⇒ choose deliberately.
- **R2. Reminder silent failure.** A reminder that fires but is invisible to the user is worse than no reminder. UX must guarantee a visible surface (dashboard banner, badge, list) before anything else.
- **R3. PII / resume files.** Resumes contain PII. Storage location, access control, signed URLs for download, and encryption-at-rest decisions matter. MVP can defer encryption-at-rest but cannot defer access control.
- **R4. Multi-user assumption reversal.** Building single-user then scaling to teams is painful (every entity needs `user_id`, every query needs filtering). Decide tenancy before applying.
- **R5. Scope creep via "small" asks.** Inline tagging, Kanban board, calendar sync, browser extension — each is a real product cycle. The MVP cutoff must be defended during apply.
- **R6. Reminder clock drift.** A scheduled job that drifts or fails silently means reminders stop firing. Need a "missed reminder" surface and idempotent recomputation.
- **R7. Status history corruption.** Status changes without an audit row make "what was it when?" impossible to answer. Ensure status updates write to `StatusHistory` transactionally.
- **R8. Resume file deduplication.** Two uploads of the same PDF will hash-identical. Decide if "versioning" is content-based, label-based, or explicit.
- **R9. Empty skill registry for chosen stack.** The project ships without framework-specific skills (`react-19`, `typescript`, `tailwind-4`, `django`, etc.) loaded. `sdd-init` re-runs and the `skill-registry` cache will need a refresh once the stack is chosen.

### Recommendation

**Hold the proposal phase.** The blocking questions (stack, tenancy, auth, reminder channel, 15-day semantics, resume versioning model) materially shape the schema and the apply surface. Building the proposal without them risks a 400-line overhaul on the first chained PR.

Once the user answers at least questions 1–7 above, the project can move forward:

- `sdd-propose` will declare scope, MVP behavior, and rollback.
- `sdd-spec` will produce the ADDED requirements under the **applications** domain (and sub-domains as chosen).
- `sdd-design` will lock the stack, the reminder scheduler, the file-storage strategy, and the auth model.
- `sdd-tasks` will forecast against the 400-line budget. Forecasts for Approach 1 (Next.js) or 3 (Django) are most likely to fit one chained PR; Approach 2 (decoupled) is most likely to need 2 slices.

### Ready for Proposal

**No** — block on user clarifications before invoking `sdd-propose`.

The orchestrator should surface questions **1, 2, 4, 5, 7** first (the most consequential), in this order or as a single ask. After those are answered (or partially answered with explicit defaults), promote to `sdd-propose`.
