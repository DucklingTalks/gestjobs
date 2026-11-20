---
name: audit-design
description: "Trigger ONLY when the user explicitly asks for a design audit (\"auditoría de diseño\", \"design audit\", \"audit-design\"). Do not trigger on generic UI work, frontend changes, reviews, or QA. Fans out parallel read-only audits of 30 \"generic AI-template\" design tells, judges each against the project's own brand and design system, and produces a checklist with a publish verdict."
license: Apache-2.0
metadata:
  author: ultria-labs
  version: "1.0"
---

## Activation Contract

Load only when the user explicitly requests a design audit of a site, app, page, or prototype, or a re-check of an existing design audit. Do not load it on your own initiative; at most, mention that a design audit is available. Legal pages are only checked for presence here; their content belongs to `skills/audit-compliance/SKILL.md`.

## Core idea

None of the 30 tells is wrong in itself. The problem is the **unchosen default**: the pattern appears because a generator or template put it there, not because the brand needs it. Each finding therefore answers two questions: *is the pattern present?* and *is it intentional?* Something counts as intentional only when it is backed by the project's design system, brand guidelines, or an explicit, recorded decision. A taste argument doesn't count.

## Hard Rules

- The audit is **read-only**. Do not restyle, refactor, or commit while auditing. Remediation happens afterwards as separate work units (`skills/ultria-work-unit-commit/SKILL.md`), using the `frontend-design` skill when available.
- **Brand first.** Locate and read the project's design system, tokens, and brand guidelines before judging anything. For Ultria's own projects these live in `docs/brand/ultria-design-system.md`, `ultria-design-tokens.css`, `ultria-brand-identity.md`, and `docs/business/04_Brand_Guidelines_Messaging.md`. A pattern the brand defines is `INTENTIONAL`, not a tell.
- **No replacement clichés.** A fix must come from the brand (its palette, type, voice, real assets), not from swapping one trend for another: "remove the purple gradient" must not become "add a beige grain texture" unless the brand says so.
- **Never trade away accessibility.** A fix may not lower contrast below WCAG AA, remove focus states, or ignore `prefers-reduced-motion`. When a tell and accessibility conflict, accessibility wins and the finding says so.
- Every finding needs evidence: `file:line`, a token or CSS rule, a screenshot region, or copied text. Judge what users actually see: rendered screenshots outrank source code.
- Content tells (fake testimonials, missing demos) are reported, never "fixed" by inventing content. Ask for the real material.

## Execution Steps

1. **Scope.** Confirm the target (repository path and/or URL), the key pages (home, landing, pricing, product, contact), and whether this is a new audit or a re-check.
2. **Recon (you, not subagents).**
   - Read the brand sources above (or the client's equivalents) and summarize the intended palette, typefaces, radius, shadow, iconography, and voice in ~10 lines. If there are none, say so: every present pattern then defaults to `TELL` unless the user states the intent.
   - Capture screenshots of the key pages at desktop (1440 px) and mobile (390 px) widths, above the fold and full page. Use the project's own capture script if it has one (for example `website/scripts/capture-ux.mjs`), otherwise Playwright. If screenshots can't be taken, ask the user for them and say that the audit is code-only.
3. **Fan out.** Launch **one read-only subagent per domain below, all in a single message so they run in parallel**. Give each its tells copied from `references/tells.md`, the brand summary, the screenshot paths (subagents must look at them), the target path, and the output format below. If subagents are unavailable, run the domains sequentially yourself.

   | Domain | Tells |
   |---|---|
   | A. Color & surfaces | 1, 3, 4, 20, 22, 23, 29, 30 |
   | B. Depth & effects | 5, 8, 19, 25, 28 |
   | C. Typography & copy | 7, 9, 10, 15 |
   | D. Icons & decoration | 2, 11, 16, 24 |
   | E. Layout & composition | 6, 13, 14, 17 |
   | F. Content, trust & states | 12, 18, 21, 26, 27 |

   Required subagent output, one block per tell:

   ```
   #<n> <tell> | CLEAN | INTENTIONAL | TELL | N/A
   Where: <page + region (hero / above the fold / body / footer) + file:line or screenshot>
   Evidence: <token, CSS rule, component, copied text>
   Brand check: <what the design system says, or "not defined">
   Fix: <brand-derived change; empty if CLEAN/INTENTIONAL/N/A>
   Weight: high (hero / above the fold / repeated sitewide) | medium (main sections) | low (isolated, below the fold)
   ```

4. **Consolidate.** Look at the screenshots yourself and spot-check every `TELL` and `INTENTIONAL`. Several low-weight tells stacked in the same section count as one high-weight finding: clustering is what makes a page read as a template. Fill `assets/checklist-template.md` and write it to `<target>/docs/audits/design-audit-YYYY-MM-DD.md` (ask before writing into a client repository).
5. **Verdict.**
   - **Ready:** no high-weight `TELL` remains, and every content and trust tell (12, 18, 26, 27) is resolved.
   - **Needs work:** otherwise. List the findings by weight, each with its brand-derived fix.
   - Also report the **genericness index**: the count of `TELL` findings weighted high 3 / medium 2 / low 1. Use it to compare re-checks over time, not as an absolute grade.
6. **Re-check mode.** Re-audit only the open tells plus any page or component changed since the audit date, using fresh screenshots. Update the statuses in place and append a dated history entry with the new genericness index.

## Output Contract

Report the checklist path, the verdict, the genericness index (and the previous one when re-checking), the high-weight findings with their fixes, and any content the user must supply (real testimonials, product screenshots or demo video, legal pages). Offer to turn each fix into its own work unit. Do not paste the full checklist into chat.
