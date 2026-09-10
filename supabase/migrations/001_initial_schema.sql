-- supabase/migrations/001_initial_schema.sql
-- Initial schema for gestjobs MVP.
-- Tables, indexes, update triggers, RLS, and signup bootstrap.
-- See openspec/changes/gestjobs-mvp/design.md for the data model rationale.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- statuses — user-configurable status list per user.
-- A trigger on auth.users inserts the seven defaults on signup.
-- ============================================================================
create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  is_terminal boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index statuses_user_id_idx on public.statuses (user_id);

-- ============================================================================
-- platforms — global seed (user_id null) + per-user custom (user_id set).
-- ============================================================================
create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  hostname text not null,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  -- Allows multiple global seeds (user_id null) but enforces uniqueness for
  -- a single user's custom platforms.
  unique (user_id, hostname)
);
create index platforms_hostname_idx on public.platforms (hostname);
create index platforms_user_id_idx on public.platforms (user_id);

-- ============================================================================
-- applications — root aggregate for a job application.
-- ============================================================================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_name text not null,
  position_title text not null,
  platform_id uuid references public.platforms(id) on delete restrict not null,
  platform_url text not null,
  application_date date not null default current_date,
  status_id uuid references public.statuses(id) on delete restrict not null,
  job_proposal_text text,
  job_proposal_url text,
  job_proposal_file_path text,
  next_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_id_idx on public.applications (user_id);
create index applications_status_id_idx on public.applications (status_id);
create index applications_platform_id_idx on public.applications (platform_id);
create index applications_next_reminder_at_idx on public.applications (next_reminder_at);

-- ============================================================================
-- application_status_history — append-only audit row per status change.
-- ============================================================================
create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade not null,
  from_status_id uuid references public.statuses(id) on delete set null,
  to_status_id uuid references public.statuses(id) on delete restrict not null,
  changed_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id);

-- ============================================================================
-- contacts — directory, reusable across applications.
-- ============================================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_user_id_idx on public.contacts (user_id);

-- ============================================================================
-- application_contacts — join table carrying the per-application role.
-- ============================================================================
create table public.application_contacts (
  application_id uuid references public.applications(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  role text not null,
  primary key (application_id, contact_id, role)
);

-- ============================================================================
-- resumes — versioned files stored in Supabase Storage.
-- ============================================================================
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  file_path text not null,
  file_hash text not null,
  file_size integer not null,
  created_at timestamptz not null default now()
);
create index resumes_user_id_idx on public.resumes (user_id);

-- ============================================================================
-- application_resumes — exactly one resume per application (PK is application_id).
-- ============================================================================
create table public.application_resumes (
  application_id uuid references public.applications(id) on delete cascade primary key,
  resume_id uuid references public.resumes(id) on delete cascade not null,
  attached_at timestamptz not null default now()
);

-- ============================================================================
-- reminder_dispatches — log of reminder email attempts for idempotency.
-- ============================================================================
create table public.reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade not null,
  sent_at timestamptz not null default now(),
  provider_message_id text,
  error text
);
create index reminder_dispatches_app_idx on public.reminder_dispatches (application_id);

-- ============================================================================
-- updated_at maintenance trigger.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_statuses
before update on public.statuses
for each row execute function public.set_updated_at();

create trigger set_updated_at_applications
before update on public.applications
for each row execute function public.set_updated_at();

create trigger set_updated_at_contacts
before update on public.contacts
for each row execute function public.set_updated_at();

-- ============================================================================
-- Signup bootstrap — create the seven default statuses for a new user.
-- Runs after a row is inserted into auth.users. SECURITY DEFINER bypasses RLS
-- so the row is owned by the new user and the same user can edit it later.
-- ============================================================================
create or replace function public.create_default_statuses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.statuses (user_id, name, is_terminal, sort_order) values
    (new.id, 'Applied',   false, 10),
    (new.id, 'Screening', false, 20),
    (new.id, 'Interview', false, 30),
    (new.id, 'Offer',     false, 40),
    (new.id, 'Hired',     true,  50),
    (new.id, 'Rejected',  true,  60),
    (new.id, 'Withdrawn', true,  70);
  return new;
end;
$$;

create trigger on_auth_user_created_default_statuses
after insert on auth.users
for each row execute function public.create_default_statuses();

-- ============================================================================
-- Row-Level Security — every tenant table is locked down by default.
-- ============================================================================
alter table public.statuses                  enable row level security;
alter table public.platforms                 enable row level security;
alter table public.applications              enable row level security;
alter table public.application_status_history enable row level security;
alter table public.contacts                  enable row level security;
alter table public.application_contacts      enable row level security;
alter table public.resumes                   enable row level security;
alter table public.application_resumes       enable row level security;
alter table public.reminder_dispatches       enable row level security;

-- Helper SQL function: true when target_user_id matches the signed-in user.
-- Stable so the planner can fold the predicate into the surrounding query.
create or replace function public.is_owner(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select target_user_id = auth.uid();
$$;

-- statuses — owner-only read/write.
create policy "Users manage their own statuses"
  on public.statuses
  for all
  using      (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- platforms — anyone can read global seeds (user_id is null); owners manage
-- their own custom rows. Writes require auth.uid() = user_id (so global
-- seeds are not editable from the client; they only come from migrations).
create policy "Anyone can read global platform seeds"
  on public.platforms
  for select
  using (user_id is null);

create policy "Users read their own custom platforms"
  on public.platforms
  for select
  using (public.is_owner(user_id));

create policy "Users insert their own custom platforms"
  on public.platforms
  for insert
  with check (public.is_owner(user_id) and is_custom = true);

create policy "Users update their own custom platforms"
  on public.platforms
  for update
  using      (public.is_owner(user_id))
  with check (public.is_owner(user_id));

create policy "Users delete their own custom platforms"
  on public.platforms
  for delete
  using (public.is_owner(user_id));

-- applications — owner-only.
create policy "Users manage their own applications"
  on public.applications
  for all
  using      (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- application_status_history — derived from owner's applications.
create policy "Users manage history of their own applications"
  on public.application_status_history
  for all
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and public.is_owner(a.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id and public.is_owner(a.user_id)
    )
  );

-- contacts — owner-only.
create policy "Users manage their own contacts"
  on public.contacts
  for all
  using      (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- application_contacts — derived from owner's applications AND contacts.
create policy "Users manage contact roles on their applications"
  on public.application_contacts
  for all
  using (
    exists (select 1 from public.applications a
            where a.id = application_id and public.is_owner(a.user_id))
    and
    exists (select 1 from public.contacts c
            where c.id = contact_id and public.is_owner(c.user_id))
  )
  with check (
    exists (select 1 from public.applications a
            where a.id = application_id and public.is_owner(a.user_id))
    and
    exists (select 1 from public.contacts c
            where c.id = contact_id and public.is_owner(c.user_id))
  );

-- resumes — owner-only.
create policy "Users manage their own resumes"
  on public.resumes
  for all
  using      (public.is_owner(user_id))
  with check (public.is_owner(user_id));

-- application_resumes — derived from owner's applications AND resumes.
create policy "Users manage resume attachments on their applications"
  on public.application_resumes
  for all
  using (
    exists (select 1 from public.applications a
            where a.id = application_id and public.is_owner(a.user_id))
    and
    exists (select 1 from public.resumes r
            where r.id = resume_id and public.is_owner(r.user_id))
  )
  with check (
    exists (select 1 from public.applications a
            where a.id = application_id and public.is_owner(a.user_id))
    and
    exists (select 1 from public.resumes r
            where r.id = resume_id and public.is_owner(r.user_id))
  );

-- reminder_dispatches — derived from owner's applications.
create policy "Users see dispatches for their applications"
  on public.reminder_dispatches
  for all
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and public.is_owner(a.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.id = application_id and public.is_owner(a.user_id)
    )
  );