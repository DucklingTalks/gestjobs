# Proposal: ATS keyword matching

## Intent

Recruiters filter applicants in an ATS by searching for exact keywords from
the job posting. A candidate who knows "Next.js" but wrote "Next" or "NextJS"
can drop out of those searches. Outcome: the tailored CV uses **the exact
wording the posting uses** for every skill, tool and certification the
candidate really has. The user sees which keywords they cover, which ones were
renamed and which ones are missing.

Guiding constraints:
- **Truthful.** The app only renames something the profile already supports.
  It never adds a skill the candidate does not have.
- **Cheap.** No extra AI calls. The existing fit call also returns the
  posting's keywords. A deterministic dictionary does the matching, and the
  AI only gives its opinion on the ambiguous cases.

## Current state

- `src/lib/ai/fit.ts` makes one AI call that returns the score, strengths and
  gaps, the cover letter and the tailored CV (JSON). The prompt already says
  "mirror the posting's keywords only where the profile genuinely supports
  them", but nothing checks it and the user cannot see it.
- `profiles.skills` is a free-text `text[]`. Nothing normalizes it.
- The CV PDF is rendered locally from the stored `cv` jsonb, so it can be
  re-rendered without calling the AI again.

## Approach

### 1. Keyword extraction (same AI call)
Add a `keywords` array to the fit output. Each item is a term copied
**verbatim** from the posting, plus:
- `kind`: `skill` | `tool` | `certification` | `language` | `other`
- `required`: true for must-haves, false for nice-to-haves
- `profileTerm`: the profile entry the AI thinks it matches, or null
- `relation`: `same` | `related` | `none` (the AI's opinion)

### 2. Deterministic matching (code, no AI)
A pure module `src/lib/ats/keywords.ts`:
- **normalize(term)**: lowercase, remove accents, treat `.js`/`js` suffixes,
  dots, dashes and spaces as equivalent (`Next.js` = `nextjs` = `Next JS`).
- **Alias dictionary**: about 150 common tech terms, each with one canonical
  name and its variants (`PostgreSQL` ↔ `Postgres`, `Kubernetes` ↔ `K8s`,
  `JavaScript` ↔ `JS`, `Amazon Web Services` ↔ `AWS`).
- **False friends**: pairs that must never be merged, even if the AI says
  they are the same (`Java` ≠ `JavaScript`, `Angular` ≠ `AngularJS`,
  `React` ≠ `React Native`, `.NET Framework` ≠ `.NET Core`).
- It matches each posting keyword against the profile (skills, certification
  names, language names and the text of experience bullets) and returns one
  of four statuses:

| Status | Meaning | CV action |
|---|---|---|
| `exact` | Same normalized term in the profile | none |
| `renamed` | Dictionary alias, or AI `same` that is not vetoed | use the posting's wording |
| `related` | AI `related` (e.g. has AWS, posting asks for AWS Lambda) | suggest only, no rename |
| `missing` | No support in the profile | listed as a gap |

The dictionary wins over the AI. The AI is used only for terms the dictionary
does not know.

### 3. Apply to the CV (code, no AI)
After the AI returns, a post-processing step rewrites `cv.skills`,
`cv.certifications` and the mentions in experience bullets to the posting's
wording for every `renamed` keyword. Rules:
- For acronyms, write both forms the first time: "Amazon Web Services (AWS)".
- For certifications, use the full official name when the dictionary knows it.
- Courses count as evidence for the skills they cover.

### 4. Review and coverage (UI)
On the analysis page:
- A **coverage** figure next to Fit/Gap, e.g. "18/22 keywords covered
  (required: 9/10)".
- A **keyword table** (posting term, profile term, status). Each `renamed` row
  has a toggle to undo it. Toggling re-renders the PDF locally, with no AI call.

### 5. Personal aliases (phase 2)
When the user keeps or adds a rename, it is saved to their own alias list and
applied automatically in future analyses before the shared dictionary.

## Scope

### In Scope
- `keywords` in the fit AI output and stored with the analysis
- Deterministic normalization, alias dictionary and false-friend list
- CV post-processing for `renamed` keywords
- Coverage figure and keyword table with per-row undo
- Phase 2: per-user alias list

### Out of Scope
- Scoring the CV against a specific ATS vendor
- Fetching keyword lists from external taxonomies (ESCO, O*NET, Lightcast)
- Rewriting the user's stored profile. Renames only affect the generated CV.
- Re-running the AI when a toggle changes

## Capabilities

### New Capabilities
- `ats-keywords`: posting keyword extraction, normalization, alias and
  false-friend matching, coverage, and CV rename post-processing

### Modified Capabilities
- `fit-analysis`: output gains `keywords`; the stored analysis gains
  `keywords` and the user's rename choices; the page shows coverage and the table
- `profile` (phase 2): per-user alias list

## Data changes

- Migration `008_fit_keywords.sql`: `fit_analyses.keywords jsonb not null
  default '[]'`. Older analyses keep an empty array and render as they do now.
- Phase 2 migration: `skill_aliases (user_id, canonical, alias)` with the same
  `auth.uid() = user_id` RLS pattern as the other tables.

## Delivery

1. **PR 1:** `keywords.ts` (normalization, dictionary, false friends,
   matching) with Vitest tests. Pure code, no UI.
2. **PR 2:** prompt and schema change, migration 008, CV post-processing,
   coverage and keyword table on the analysis page.
3. **PR 3 (phase 2):** personal aliases.

## Assumptions and unknowns

- The AI copies terms verbatim reliably enough. Mitigation: the code keeps
  only keywords that actually appear in the posting text after normalization.
- About 150 dictionary entries cover most cases for the user's market (tech
  roles, LatAm). The list lives in code so it is easy to extend.
- Experience bullets are free text. Rewriting a term inside a sentence must
  match whole words only, to avoid partial replacements such as "Java" inside
  "JavaScript".
- Token cost: `keywords` adds roughly 300-600 output tokens per analysis.

## Rollback

- The `keywords` column is additive and the UI hides the section when it is
  empty, so reverting the code is safe without touching the database.
- The CV post-processing is a pure function applied when rendering. Turning it
  off brings back the AI's original CV.
