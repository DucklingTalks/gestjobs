-- supabase/seed.sql
-- Seed data that runs after migrations on `supabase db reset`.
--
-- Statuses are NOT seeded here: the create_default_statuses() trigger on
-- auth.users populates the seven defaults per user on signup. This seed
-- only owns the global, user_id-NULL platform directory.

insert into public.platforms (user_id, name, hostname, is_custom) values
  (null, 'LinkedIn',          'linkedin.com',         false),
  (null, 'Indeed',            'indeed.com',           false),
  (null, 'Glassdoor',         'glassdoor.com',        false),
  (null, 'Greenhouse',        'boards.greenhouse.io', false),
  (null, 'Lever',             'jobs.lever.co',        false),
  (null, 'Computrabajo',      'computrabajo.com.uy',  false),
  (null, 'Gallito Uruguay',   'gallito.com.uy',       false),
  (null, 'BuscoJobs',         'buscojobs.com.uy',     false),
  (null, 'Workable',          'apply.workable.com',   false),
  (null, 'SmartRecruiters',   'jobs.smartrecruiters.com', false)
on conflict (user_id, hostname) do nothing;