-- supabase/migrations/008_fit_keywords.sql
-- ATS keyword matches for each analysis: the posting's keywords, whether
-- the profile covers them (exact, renamed, related, missing) and, for
-- renamed ones, whether the CV uses the posting's wording. Older analyses
-- keep an empty array and render as before.

alter table public.fit_analyses
  add column keywords jsonb not null default '[]'::jsonb;
