# Supabase setup

Supabase provides PostgreSQL, Auth, Storage, and row-level security for GestJobs.

## Create the project

1. Create an account at [supabase.com](https://supabase.com/).
2. Create a new project in the free tier.
3. Save the database password in a password manager.
4. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable/anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service-role key → `SUPABASE_SERVICE_ROLE_KEY` (server-only).

Never expose the service-role key to the browser or commit it.

## Apply the schema

Install the Supabase CLI, authenticate, link the project, and run from the repository root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create the tables, RLS policies, and private `resumes`/`proposals` buckets. Apply `supabase/seed.sql` using the CLI or SQL editor if the migration workflow does not seed it automatically.

Generate authoritative types after migrations are applied:

```bash
supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Configure Auth

In **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` for local work.
- Add the Vercel preview and production URLs when available.
- Enable email magic links.

## Validate before continuing

- Create a test user and request a magic link.
- Confirm migrations and seed data are present.
- Test that one user cannot read another user's rows.
- Confirm Storage buckets are private and signed URLs expire.
