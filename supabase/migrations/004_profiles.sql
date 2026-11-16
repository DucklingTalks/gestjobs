-- supabase/migrations/004_profiles.sql
-- One structured candidate profile per user. It feeds the AI fit analysis,
-- the cover letter and the tailored CV.
--
-- Repeating sections (experience, education, links, languages,
-- certifications) are stored as jsonb arrays. They are always edited and
-- read as a whole, so one row avoids join tables and keeps saves atomic.
-- Shapes are validated in the app (src/lib/validation/profile.ts).

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  headline text not null default '',
  email text not null default '',
  phone text not null default '',
  location text not null default '',
  bio text not null default '',
  skills text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  experiences jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own profile"
  on public.profiles for delete
  using (auth.uid() = user_id);
