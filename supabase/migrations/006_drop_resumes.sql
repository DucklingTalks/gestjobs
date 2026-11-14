-- supabase/migrations/006_drop_resumes.sql
-- The uploaded-resume library is replaced by the structured profile
-- (004_profiles.sql) and AI-tailored CVs (005_fit_analyses.sql).
--
-- Drops the resume tables and their policies. The private `resumes`
-- storage bucket is left in place: Supabase blocks deleting storage rows
-- from SQL. Empty and delete it from Dashboard -> Storage if you no longer
-- need the files.

drop table if exists public.application_resumes;
drop table if exists public.resumes;
