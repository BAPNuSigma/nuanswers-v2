-- =====================================================================
-- NuAnswers v2 — Direct-to-Storage uploads (bypass Vercel 4.5 MB body cap)
-- Adds the storage bucket + RLS policies so the browser can upload large
-- files (PowerPoint slide decks, etc.) directly to Supabase Storage,
-- and tracks the storage path on each document row so the server can
-- read the file back during text extraction.
-- Apply in Supabase: Dashboard → SQL Editor → paste → Run.
-- =====================================================================

-- ---- documents.storage_path -----------------------------------------
-- Where the raw file lives in Storage, e.g. "<user_id>/1714841522-Kieso_Ch23.pptx".
-- NULL for documents uploaded via the legacy 4.5 MB API route (still supported).
alter table public.documents
  add column if not exists storage_path text;

-- ---- storage bucket -------------------------------------------------
-- "course-materials" bucket holds raw uploaded files. Private (not public)
-- so RLS controls access. The bucket-level public flag is false; signed
-- URLs are not used — the server reads via service role from the API route.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  -- 50 MB hard cap on individual files. Generous for Kieso chapters but
  -- keeps a single rogue upload from exhausting our Storage quota.
  52428800,
  null  -- mime-type allowlist enforced in app code, not at storage layer
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      public = excluded.public;

-- ---- storage RLS ----------------------------------------------------
-- Files live at "<auth_uid>/<timestamp>-<filename>". The first path
-- segment must equal the authenticated user's UUID, which gives every
-- student their own private folder without a separate join table.
drop policy if exists "Course materials: own upload" on storage.objects;
create policy "Course materials: own upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Course materials: own read" on storage.objects;
create policy "Course materials: own read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'course-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Course materials: own delete" on storage.objects;
create policy "Course materials: own delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'course-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
