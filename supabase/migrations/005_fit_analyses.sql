-- supabase/migrations/005_fit_analyses.sql
-- AI job-fit analyses: a 1-10 fit score with a short summary, a brief
-- cover letter and a tailored CV for one job posting. An analysis may be
-- linked to an application or stand alone (pasted posting / URL).

create table public.fit_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete set null,
  job_title text not null default '',
  company text not null default '',
  job_source_url text,
  job_text text not null,
  language text not null default 'en',
  score smallint not null check (score between 1 and 10),
  summary text not null,
  cover_letter text not null default '',
  cv jsonb not null default '{}'::jsonb,
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fit_analyses_user_created_idx on public.fit_analyses (user_id, created_at desc);
create index fit_analyses_application_idx on public.fit_analyses (application_id);

alter table public.fit_analyses enable row level security;

create policy "Users read their own fit analyses"
  on public.fit_analyses for select
  using (auth.uid() = user_id);

create policy "Users insert their own fit analyses"
  on public.fit_analyses for insert
  with check (
    auth.uid() = user_id
    and (
      application_id is null
      or exists (
        select 1 from public.applications a
        where a.id = application_id and a.user_id = auth.uid()
      )
    )
  );

create policy "Users update their own fit analyses"
  on public.fit_analyses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own fit analyses"
  on public.fit_analyses for delete
  using (auth.uid() = user_id);
