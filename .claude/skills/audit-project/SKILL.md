---
name: audit-project
description: "Trigger ONLY when the user explicitly asks for a security audit (\"auditoría de seguridad\", \"security audit\", \"audit-project\"). Do not trigger on generic publish, release, launch, review, or QA requests. Fans out parallel read-only audits of the 25 pre-launch security controls and produces a publish-gate checklist."
license: Apache-2.0
metadata:
  author: ultria-labs
  version: "1.0"
---

## Activation Contract

Load only when the user explicitly requests a security audit of a project, or a re-check of an existing security audit checklist. Do not load it on your own initiative for publishing, deployment, code review, or general QA; at most, mention that a security audit is available. It complements the Internal review and Testing gates of `docs/business/07_Project_Management_Framework.md`; it does not replace functional QA.

## Hard Rules

- The audit is **read-only**. Do not fix, refactor, commit, or install anything while auditing. Remediation happens afterwards as separate work units (`skills/ultria-work-unit-commit/SKILL.md`).
- Never print a secret value in the checklist, chat, or subagent output. Report its location (`file:line`, commit hash) and type only, masked (`sk_live_…4f2a`).
- Never run commands against cloud accounts (AWS, Supabase, Firebase, Vercel, etc.). Propose them for the user to run. Live HTTP checks of a public URL (`curl -sI`) need the user's OK first.
- Every status needs evidence: `file:line`, command plus output, or a stated reason. "Looks fine" is not evidence.
- `N/A` is allowed only with a concrete reason tied to the architecture (for example "no database: static site plus one Lambda, no queries"). When unsure, use `VERIFY`, not `N/A`.
- A control may be marked `ACCEPTED` only by the user, with owner, reason, and a `reviewBy` date. Expired acceptances revert to `FAIL`.

## Execution Steps

1. **Scope.** Confirm the target path, the public URL (if any), and whether this is a new audit or a re-check of an existing checklist.
2. **Recon (you, not subagents).** Map the stack in one pass: languages and frameworks, hosting and IaC, database and ORM, auth provider, file uploads, public endpoints and forms, CI, dependency manifests, `.env*` and `.gitignore`. Write a short architecture summary. The subagents get it so they don't repeat the mapping.
3. **Fan out.** Launch **one read-only subagent per domain below, all in a single message so they run in parallel** (Explore or general-purpose type). Give each its domain's controls copied from `references/controls.md`, the architecture summary, the target path, and the output format below. If subagents are unavailable, run the domains sequentially yourself with the same format.

   | Domain | Controls |
   |---|---|
   | A. Secrets & configuration | 1, 2, 3 |
   | B. Data & access | 4, 5, 7, 13 |
   | C. Identity & session | 6, 9, 10, 23 |
   | D. Input & output handling | 8, 14, 15, 16, 17, 22 |
   | E. Abuse prevention | 11, 12 |
   | F. Transport & platform | 18, 19, 21 |
   | G. Supply chain | 20 |
   | H. Accounts & operations | 24, 25 |

   Domain H is mostly outside the code. Its subagent lists the accounts and backup targets it can infer (git remote, cloud provider, DNS, email, CRM, deploy platform, databases), checks what the repository can show (IaC backup settings, documented restore tests), and reports the rest as `VERIFY` with a concrete list for the user to confirm. It never logs into a console.

   Required subagent output, one block per control:

   ```
   #<n> <control> | PASS | FAIL | PARTIAL | N/A | VERIFY
   Evidence: <file:line / command + result / reason>
   Gap: <what is missing; empty if PASS or N/A>
   Fix: <smallest concrete remediation; empty if PASS or N/A>
   Severity: critical | high | medium | low
   ```

4. **Consolidate.** Spot-check every `FAIL` and every `N/A` yourself before accepting it. Then fill `assets/checklist-template.md` and write it to `<target>/docs/audits/security-audit-YYYY-MM-DD.md` (create the folder if needed; ask before writing into a client repository).
5. **Gate verdict.** The project is **ready to publish** only when every control is `PASS`, `N/A`, or `ACCEPTED` with an unexpired `reviewBy`. Otherwise it is **blocked**, and the verdict lists the blocking items ordered by severity.
6. **Re-check mode.** When an audit checklist already exists, re-audit only the items that are not `PASS` or `N/A`, plus any control affected by code changed since the audit date. Update the statuses in place and append a dated entry to the checklist history.

## Output Contract

Report the checklist path, the gate verdict (ready / blocked), the counts per status, and the blocking items with severity and proposed fix. Offer to turn each fix into its own work unit. Do not paste the full checklist into chat.
