-- supabase/migrations/002_storage_buckets.sql
-- Private storage buckets for resumes and job-proposal files.
-- Signed URLs default to a 1-hour expiry (Supabase Storage default and the
-- convention documented in openspec/changes/gestjobs-mvp/design.md).

-- ============================================================================
-- Bucket: resumes — versioned resume files uploaded by the user.
-- Path convention: resumes/{user_id}/{file_id}-{original_filename}
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10 * 1024 * 1024,  -- 10 MB; configurable per project via Supabase dashboard.
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- ============================================================================
-- Bucket: proposals — job proposal files attached to applications.
-- Path convention: proposals/{user_id}/{application_id}-{original_filename}
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposals',
  'proposals',
  false,
  10 * 1024 * 1024,  -- 10 MB; matches resumes default.
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- ============================================================================
-- Row-Level Security on storage.objects for the resumes bucket.
-- A user can list/upload/update/delete only under their own folder
-- (the path starts with the user's auth.uid()).
-- ============================================================================
create policy "Users can read their own resume files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload to their own resume folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own resume files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own resume files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Row-Level Security on storage.objects for the proposals bucket.
-- ============================================================================
create policy "Users can read their own proposal files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'proposals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload to their own proposal folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'proposals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own proposal files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'proposals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own proposal files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'proposals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );