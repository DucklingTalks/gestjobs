# Apply Progress — gestjobs-mvp (PR 1 + PR 2 + PR 3)

## Summary

Three autonomous implementation slices are recorded cumulatively:

- **PR 1 — Foundation**: merged into `feature/gestjobs-mvp`; Next.js 15 scaffold, Supabase Auth clients, schema/RLS, private storage buckets, seed data, magic-link login, and middleware.
- **PR 2 — Platforms**: implemented on `feat/pr2-platforms` and still under review; hostname inference, seed directory, accessible combobox, and custom platform persistence.
- **PR 3 — Contacts + Resumes**: implemented on `feat/pr3-contacts-resumes`, branched from the latest `origin/feature/gestjobs-mvp` after PR 1. It adds authenticated contact-directory CRUD and private versioned resume uploads with metadata, SHA-256 hashes, and one-hour signed download URLs.

PR 3 passes static verification (`pnpm typecheck`, `pnpm build`). Runtime checks that require Supabase remain deferred until the project is provisioned.

## Work Unit Boundary

| Field | Value |
|-------|-------|
| Change | `gestjobs-mvp` |
| Artifact store | openspec |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain (user-selected) |
| Tracker branch | `feature/gestjobs-mvp` |
| Current work unit | Contacts + Resumes (PR 3 of 7) |
| Branch / base | `feat/pr3-contacts-resumes` from latest `origin/feature/gestjobs-mvp` (`ea650eb`) |
| PR target when opened | `feature/gestjobs-mvp` (parallel child while independent PR 2 is under review) |
| Mode | Standard (`strict_tdd=false`, no test runner) |
| Verification | Static complete; Supabase runtime checks deferred |
| Rollback | Revert PR 3 only; no migration or external resource is introduced by this slice |

## Completed Tasks (Cumulative)

### Phase 1 — Foundation (PR 1, merged)

| # | Description | Status |
|---|-------------|--------|
| 1.1 | Next.js 15 App Router + TypeScript + Tailwind scaffold | done |
| 1.2 | Environment placeholders | done |
| 1.3 | Supabase SSR clients | done |
| 1.4 | Initial schema and per-user RLS | done |
| 1.5 | Private storage buckets and storage RLS | done |
| 1.6 | Global platform seeds | done |
| 1.7 | Database types stub | done |
| 1.8 | Magic-link login | done |
| 1.9 | Session middleware | done |
| 1.10 | Static verification; runtime deferred | done |
| 1.11 | Rollback documented | done |

### Phase 2 — Platforms (PR 2, under review)

| # | Description | Status |
|---|-------------|--------|
| 2.1 | Hostname normalization and inference | done |
| 2.2 | Client platform seed directory | done |
| 2.3 | Accessible combobox with custom fallback | done |
| 2.4 | Authenticated custom-platform upsert | done |
| 2.5 | Static verification; Supabase runtime deferred | done |
| 2.6 | Rollback documented | done |

PR 2 remains on its own child branch and is not part of PR 3's source diff. Its completed status and prior verification evidence are retained here from the previous cumulative apply-progress record.

### Phase 3 — Contacts + Resumes (PR 3, current)

| # | Description | Status | Files |
|---|-------------|--------|-------|
| 3.1 | Contact directory CRUD Server Actions and UI | done | `src/app/contacts/{actions,page}.tsx` |
| 3.2 | Contact Zod validation | done | `src/lib/validation/contact.ts` |
| 3.3 | Private versioned resume upload, metadata, SHA-256 hash, and signed download UI | done | `src/app/resumes/{actions,page}.tsx` |
| 3.4 | Resume label, MIME, and size validation | done | `src/lib/validation/resume.ts`, `next.config.mjs` |
| 3.5 | Static verification; Supabase upload/signed URL/RLS checks deferred | done (static) | — |
| 3.6 | Independent rollback documented | done | this file |

## PR 3 Implementation Details

### Contacts

- Every page load and mutation validates the current user with `supabase.auth.getUser()`.
- RLS remains the primary data boundary; update/delete actions also constrain mutations by both `id` and `user_id`.
- Zod rejects blank names, malformed email values, non-HTTP(S) LinkedIn URLs, oversized text, and invalid contact IDs.
- Create, update, and delete failures are surfaced through accessible status/error messages.

### Resumes

- The action accepts PDF and DOCX only and rejects files larger than 10 MB before storage access.
- Next.js Server Actions allow 11 MB request bodies so the 10 MB domain limit plus multipart overhead reaches action validation.
- Files are stored in the private `resumes` bucket at `{user_id}/{uuid}-{sanitized-name}.{pdf|docx}`. The full storage location is therefore `resumes/{user_id}/...`, matching the migration's RLS path convention.
- SHA-256 is computed server-side and persisted with label, object path, byte size, owner, and upload timestamp.
- If metadata insertion fails after upload, the action removes the uploaded object as compensating cleanup.
- The page creates one-hour signed URLs; raw public URLs are never exposed.
- Re-uploading identical content creates a distinct version with the same hash, which is permitted by the resume specification.

## Work-Unit Commits

### PR 1 — Foundation

Prior cumulative record retained: 11 reviewable commits ending in merge `ea650eb` on the tracker.

### PR 2 — Platforms

Prior cumulative record retained: pure inference, seed data, combobox, custom persistence, dependency fix, and documentation commits on `feat/pr2-platforms`.

### PR 3 — Contacts + Resumes

| SHA | Message | Scope | Change |
|-----|---------|-------|--------|
| `8ab3394` | `feat(contacts): add authenticated contact directory CRUD` | Contact validation, typed data access, CRUD actions/UI, Zod and Supabase SSR prerequisites | +308 / -29 |
| `44ba21e` | `feat(resumes): add private versioned resume uploads` | Resume validation, upload/hash/metadata association, signed URL UI, Server Action body limit | +230 / -0 |

Each feature commit is independently reviewable and reversible. The Contacts commit establishes shared typed Supabase/Zod prerequisites; the Resumes commit adds only the private-file module on top.

## Verification

### Static — PR 3

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `pnpm typecheck` | Pass — 0 errors |
| Production build | `pnpm build` | Pass — 7 pages generated; `/contacts`, `/login`, and `/resumes` are dynamic; Middleware 86.4 kB |

### Runtime — Deferred Until Supabase Is Provisioned

| Check | Expected proof |
|-------|----------------|
| Create, update, list, and delete a contact | Authenticated CRUD persists and refreshes the directory |
| Submit blank contact name | Action redirects with observable `Name is required.` error |
| Upload valid PDF and DOCX below 10 MB | Object stored at `resumes/{user_id}/...`; metadata row contains SHA-256 and byte size |
| Open generated signed URL | Private file returns 200 before the one-hour expiry |
| Upload invalid MIME or file above 10 MB | Action rejects before storage upload |
| Query/mutate as a second user | Contact/resume table RLS and storage path RLS deny cross-user access |
| Force metadata insert failure after upload | Compensating storage removal prevents an orphaned object |

Runtime checks require a linked Supabase project, applied migrations, a real authenticated session, and at least two test users. No Supabase/Vercel resources exist yet.

## Deviations from Design

- **Database types remain a hand-maintained temporary subset.** PR 3 adds `contacts` and `resumes`; PR 2 independently adds `platforms`. The branches must reconcile these table entries when the tracker includes both children, then PR 6 must replace the subset with `supabase gen types` output.
- **`@supabase/ssr` 0.12.4 is repeated in both parallel child branches.** Typed table operations on the PR 1 dependency pair fail because `@supabase/ssr` 0.5.2 references a removed `GenericSchema` subpath. Whichever child merges second must rebase and drop/reconcile the duplicate dependency change.
- **Oversize validation uses a fixed 10 MB application constant.** This intentionally matches `002_storage_buckets.sql`; there is no environment setting because the migration already defines the project-wide configured limit.

## Issues and Risks

1. **Next.js 15.0.3 security warning** — pnpm reports the pinned version is deprecated due to CVE-2025-66478. A focused framework upgrade is required before deployment, but it is outside PR 3's authorized scope.
2. **Parallel-child merge reconciliation** — PR 2 and PR 3 both touch `package.json`, `pnpm-lock.yaml`, and `database.types.ts`. Rebase the second child after the first merges and preserve the union of `platforms`, `contacts`, and `resumes` types.
3. **Runtime assurance pending** — static checks prove compilation and route generation, not storage/RLS behavior. PR 6 or an earlier preview must execute the deferred matrix above.
4. **No automated test runner** — validation and action behavior have no unit/integration tests yet because `strict_tdd=false` and the runner is deferred to PR 6.

## Workload / PR Boundary

| Field | Value |
|-------|-------|
| Delivery mode | feature-branch-chain autonomous slice |
| Current work unit | Contacts + Resumes (PR 3) |
| Start state | Tracker after merged PR 1 (`origin/feature/gestjobs-mvp` at `ea650eb`) |
| Finish state | Authenticated Contacts CRUD + private Resume versions with validation/hash/signed URLs |
| Feature diff before docs | +538 / -29 across two work-unit commits |
| 400-line review budget | Exceeded by 167 changed lines; split into two cohesive feature commits for focused review. Further separation would break the user-selected Contacts + Resumes PR boundary. |
| Rollback | Revert PR 3; existing schema/buckets from PR 1 remain unused but valid |

## Skills Loaded

- `paths-injected` — exact requested files read before work: `sdd-apply/SKILL.md`, `work-unit-commits/SKILL.md`, and `_shared/SKILL.md`.
- Shared references read: `sdd-phase-common.md`, `openspec-convention.md`, and `sdd-status-contract.md`.

## Next Steps

1. Push `feat/pr3-contacts-resumes` when requested; do not open or merge the PR yet.
2. When opening, target `feature/gestjobs-mvp` as explicitly requested for this independent child.
3. After either PR 2 or PR 3 merges, rebase the other and reconcile the shared Supabase dependency/types changes.
4. Provision Supabase and execute the deferred contact/resume upload, signed URL, and cross-user RLS checks.
5. Start PR 4 only after both PR 2 and PR 3 are represented on the tracker.
6. Schedule a focused Next.js security upgrade before deployment.
