-- supabase/migrations/009_skill_aliases.sql
-- Personal ATS aliases: pairs the user confirmed are the same thing, e.g.
-- the posting says "Hexagonal Architecture" and the profile says "Ports and
-- Adapters". Future analyses match them automatically, before the shared
-- dictionary. Deleting an alias does not change existing analyses.

create table public.skill_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  posting_term text not null check (char_length(posting_term) between 1 and 80),
  profile_term text not null check (char_length(profile_term) between 1 and 160),
  created_at timestamptz not null default now()
);

create unique index skill_aliases_user_pair_idx
  on public.skill_aliases (user_id, lower(posting_term), lower(profile_term));

alter table public.skill_aliases enable row level security;

create policy "Users read their own skill aliases"
  on public.skill_aliases for select
  using (auth.uid() = user_id);

create policy "Users insert their own skill aliases"
  on public.skill_aliases for insert
  with check (auth.uid() = user_id);

create policy "Users delete their own skill aliases"
  on public.skill_aliases for delete
  using (auth.uid() = user_id);
