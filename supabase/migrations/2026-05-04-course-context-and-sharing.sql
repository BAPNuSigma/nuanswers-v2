-- =====================================================================
-- NuAnswers v2 — course context + shared RAG search
-- Adds (course_id, professor_email, professor_name) to profiles & documents.
-- Updates match_document_chunks() to also include chunks from other
-- students in the SAME professor's same course (when set).
-- Apply in Supabase: Dashboard → SQL Editor → paste → Run.
-- =====================================================================

-- ---- profiles: a student's "current class" --------------------------
-- These three fields together identify which class context the student is
-- working in right now. When they upload files, the files inherit these
-- values. When they ask the tutor, the RAG search pools their classmates'
-- files alongside their own.
alter table public.profiles
  add column if not exists current_course_id text
    check (current_course_id is null
           or current_course_id ~ '^(ACCT|ECON|FIN|MIS|WMA)_[0-9]{4}_[0-9]{2}$'),
  add column if not exists current_course_name text,
  add column if not exists current_professor_name text,
  add column if not exists current_professor_email text
    check (current_professor_email is null
           or current_professor_email ~* '@fdu\.edu$');

-- ---- documents: tag every uploaded file with class context ----------
alter table public.documents
  add column if not exists course_id text
    check (course_id is null
           or course_id ~ '^(ACCT|ECON|FIN|MIS|WMA)_[0-9]{4}_[0-9]{2}$'),
  add column if not exists course_name text,
  add column if not exists professor_name text,
  add column if not exists professor_email text
    check (professor_email is null
           or professor_email ~* '@fdu\.edu$');

create index if not exists documents_class_idx
  on public.documents (professor_email, course_id)
  where professor_email is not null and course_id is not null;

-- ---- match_document_chunks: add class-scoped sharing ---------------
-- Drop and recreate (signature changes). The RPC now returns chunks where:
--   (a) c.user_id = match_user_id (the student's own files), OR
--   (b) the chunk's document is tagged with the same (course_id,
--       professor_email) as match_course_id + match_professor_email.
--
-- If match_course_id or match_professor_email is null, only own files
-- are returned (no sharing). This means: a student who hasn't set their
-- current class only sees their own materials — no privacy surprises.
drop function if exists public.match_document_chunks(vector, uuid, int);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_course_id text default null,
  match_professor_email text default null,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  content text,
  similarity float,
  is_own boolean,
  is_shared boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    d.filename,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    (c.user_id = match_user_id) as is_own,
    (
      c.user_id <> match_user_id
      and match_professor_email is not null
      and match_course_id is not null
      and d.professor_email = match_professor_email
      and d.course_id = match_course_id
    ) as is_shared
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where
    c.user_id = match_user_id
    or (
      match_professor_email is not null
      and match_course_id is not null
      and d.professor_email = match_professor_email
      and d.course_id = match_course_id
    )
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_document_chunks(vector, uuid, text, text, int) to authenticated;
