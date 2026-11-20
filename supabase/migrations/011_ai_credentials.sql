-- supabase/migrations/011_ai_credentials.sql
-- Each user's own AI API key, so the app no longer spends the deployment's
-- key on everyone. The key is encrypted by the app (AES-256-GCM, secret in
-- AI_KEY_ENCRYPTION_SECRET, bound to the user id) before it is stored; the
-- database only ever sees ciphertext. key_hint keeps the last 4 characters
-- for display.

create table public.ai_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('opencode-go', 'opencode-zen', 'anthropic')),
  encrypted_key text not null check (char_length(encrypted_key) between 1 and 4000),
  key_hint text not null default '' check (char_length(key_hint) <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;

create policy "Users read their own AI credential"
  on public.ai_credentials for select
  using (auth.uid() = user_id);

create policy "Users insert their own AI credential"
  on public.ai_credentials for insert
  with check (auth.uid() = user_id);

create policy "Users update their own AI credential"
  on public.ai_credentials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own AI credential"
  on public.ai_credentials for delete
  using (auth.uid() = user_id);
