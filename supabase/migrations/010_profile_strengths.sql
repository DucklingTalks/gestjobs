-- supabase/migrations/010_profile_strengths.sql
-- Strengths: qualities the candidate confirmed (by hand or through the AI
-- interview), each with concrete evidence, e.g. "Algorithmic thinking" plus
-- the story that shows it. They feed the fit analysis and the tailored CV
-- as facts, like the rest of the profile. Shape validated in
-- src/lib/validation/profile.ts.

alter table public.profiles
  add column strengths jsonb not null default '[]'::jsonb;
