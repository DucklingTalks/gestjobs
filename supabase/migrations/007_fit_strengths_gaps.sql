-- supabase/migrations/007_fit_strengths_gaps.sql
-- Split the fit explanation into reasons for (strengths) and against (gaps)
-- so the analysis page can show them separately. Older analyses keep only
-- the prose summary and render as before.

alter table public.fit_analyses
  add column strengths text[] not null default '{}',
  add column gaps text[] not null default '{}';
