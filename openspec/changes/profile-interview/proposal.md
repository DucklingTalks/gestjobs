# Proposal: AI profile interview and strengths

## Intent

The tailored CV may only use facts that are in the profile. Qualities such as
"algorithmic thinking", mentoring or owning incidents rarely make it into a
job description, so they never reach the CV. Outcome: an AI interviewer
chats with the candidate, asks for concrete examples, and proposes
**strengths with evidence** that the candidate reviews before they are saved
to the profile. Fit analyses and tailored CVs then use them as facts.

Guiding constraints:
- **Truthful.** Strengths come only from what the candidate said. Nothing is
  saved without the candidate's review.
- **Evidence over adjectives.** Each strength carries a short, concrete
  example, so the CV can show it instead of listing empty soft skills.
- **Private.** Contact details typed in the chat are redacted before the AI
  sees them, like the resume import.

## Approach

1. `profiles.strengths jsonb` (migration 010): `{ name, kind: technical|soft,
   context, evidence }[]`, max 30, editable in the profile form.
2. `src/lib/ai/interview.ts`: stateless turns. The client keeps the
   transcript and sends it on each turn; the server reloads the profile.
   - `interviewTurn`: next interviewer message (1-2 questions), `done` when
     there is enough material. Capped at 15 candidate answers.
   - `summarizeInterview`: proposes up to 12 strengths from the answers only.
3. `/profile/interview`: chat page, then a review step (keep / edit /
   discard) that appends the kept strengths to the profile, merging by name.
4. `profileForAi` includes strengths; the CV rules say how to use them
   (summary, relevant bullets under the matching experience).
5. Follow-up (separate PR): an interview focused on one analysis' gaps,
   then re-run the analysis with the updated profile.

## Out of scope

- Persisting interview transcripts.
- Voice input.
