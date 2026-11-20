---
name: audit-compliance
description: "Trigger ONLY when the user explicitly asks for a compliance, legal, or privacy audit (\"auditoría de cumplimiento\", \"auditoría legal\", \"auditoría de privacidad\", \"compliance audit\", \"audit-compliance\"). Do not trigger on generic publish, release, launch, review, or QA requests. Fans out parallel read-only audits of 15 legal/privacy launch controls and produces a publish-gate checklist; it never gives legal sign-off."
license: Apache-2.0
metadata:
  author: ultria-labs
  version: "1.0"
---

## Activation Contract

Load only when the user explicitly requests a compliance, legal, or privacy audit of a project, or a re-check of an existing compliance checklist. Do not load it on your own initiative; at most, mention that a compliance audit is available. Security controls belong to `skills/audit-project/SKILL.md`; this skill reuses that audit's result for control 11 instead of repeating it.

## Hard Rules

- **Not legal advice.** Ultria is not a law firm. The audit checks facts: whether a document exists, whether it matches how the system really works, and whether a process is defined and followed. Whether a text is legally sufficient is always `LEGAL-REVIEW`, never `PASS`, unless a lawyer's review is recorded (who, when, which version).
- The audit is **read-only**. Do not edit policies, code, or contracts while auditing. Remediation happens afterwards as separate work units (`skills/ultria-work-unit-commit/SKILL.md`).
- Never copy personal data (names, IDs, emails, addresses of real people or clients) into the checklist or subagent output. Point to where it lives.
- Never run commands against cloud accounts or SaaS admin consoles. Propose the check for the user to run.
- Every status needs evidence: `file:line`, document and section, or a stated reason. `N/A` needs a concrete reason tied to the product (for example "no payments: informational site").
- Jurisdiction first. Uruguay (Ley 18.331, Decreto 414/009, Decreto 64/020, consumer Ley 17.250) is the default for Ultria and Uruguayan clients. Add GDPR only when the product targets people in the EU, and other regimes (LGPD, CCPA, etc.) only when their users are targeted. Record the decision in the checklist.
- A control may be marked `ACCEPTED` only by the user, with owner, reason, and a `reviewBy` date. Expired acceptances revert to `FAIL`.

## Execution Steps

1. **Scope.** Confirm the target (repository path, public URL, and whether it is Ultria's own product or a client's), the jurisdictions, and whether this is a new audit or a re-check.
2. **Recon (you, not subagents).** Build a **data map** in one pass: which personal data is collected (form fields, signup, analytics, logs), where it is stored, which processors receive it and in which region, what the cookies and local storage hold, payments, and outgoing email or marketing. Locate the legal documents (privacy policy, terms, cookie notice, DPA records, contracts, licence files). The data map is the baseline every subagent checks the documents against.
3. **Fan out.** Launch **one read-only subagent per domain below, all in a single message so they run in parallel**. Give each its controls copied from `references/controls.md`, the data map, the jurisdictions, the target path, and the output format below. If subagents are unavailable, run the domains sequentially yourself with the same format.

   | Domain | Controls |
   |---|---|
   | A. Published documents | 1, 2, 10 |
   | B. Lawful basis & consent | 3, 4, 5, 6 |
   | C. Data lifecycle | 7, 8 |
   | D. Vendors & contracts | 9, 13, 15 |
   | E. Security & incidents | 11, 12 |
   | F. Open-source licences | 14 |

   Required subagent output, one block per control:

   ```
   #<n> <control> | PASS | FAIL | PARTIAL | N/A | VERIFY | LEGAL-REVIEW
   Evidence: <file:line / document § / reason>
   Mismatch: <where the document says something the system does not do, or the reverse; empty if none>
   Gap: <what is missing; empty if PASS or N/A>
   Fix: <smallest concrete remediation; mark "lawyer" when it needs legal drafting>
   Severity: critical | high | medium | low
   ```

4. **Consolidate.** Spot-check every `FAIL`, `N/A`, and mismatch yourself. Fill `assets/checklist-template.md` and write it to `<target>/docs/audits/compliance-audit-YYYY-MM-DD.md` (create the folder if needed; ask before writing into a client repository). Collect every `LEGAL-REVIEW` item into one list of questions for a lawyer.
5. **Gate verdict.** **Ready to publish** only when every control is `PASS`, `N/A`, or `ACCEPTED` with an unexpired `reviewBy`. `LEGAL-REVIEW` and `VERIFY` block until they are resolved or accepted by the user.
6. **Re-check mode.** When a compliance checklist already exists, re-audit the items that are not `PASS` or `N/A`, plus any control affected by changes to data collection, processors, cookies, payments, or legal documents since the audit date. Update the statuses in place and append a dated history entry.

## Output Contract

Report the checklist path, the jurisdictions applied, the gate verdict (ready / blocked), the counts per status, the blocking items with severity and fix, and the questions for a lawyer. Offer to turn each non-legal fix into its own work unit. Do not paste the full checklist into chat.
