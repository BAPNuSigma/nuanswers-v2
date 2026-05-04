-- =====================================================================
-- NuAnswers v2 — RAG (Retrieval-Augmented Generation) tables
-- Enables file upload + semantic search so the tutor cites student materials.
-- Apply in Supabase: Dashboard → SQL Editor → paste → Run.
-- =====================================================================

-- ---- enable pgvector extension --------------------------------------
-- Supabase ships pgvector pre-installed; this just turns it on.
create extension if not exists vector;

-- ---- documents ------------------------------------------------------
-- One row per uploaded file (PDF, DOCX, XLSX, CSV, TXT).
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  filename text not null,
  file_type text not null,
  file_size_bytes integer,
  chunk_count integer not null default 0,
  status text not null default 'ready' check (status in ('processing','ready','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_idx on public.documents (user_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "Documents: own select" on public.documents;
create policy "Documents: own select"
  on public.documents for select
  using (auth.uid() = user_id);

drop policy if exists "Documents: own insert" on public.documents;
create policy "Documents: own insert"
  on public.documents for insert
  with check (auth.uid() = user_id);

drop policy if exists "Documents: own update" on public.documents;
create policy "Documents: own update"
  on public.documents for update
  using (auth.uid() = user_id);

drop policy if exists "Documents: own delete" on public.documents;
create policy "Documents: own delete"
  on public.documents for delete
  using (auth.uid() = user_id);

-- ---- document_chunks ------------------------------------------------
-- One row per ~500-token chunk of a document, with its embedding vector.
-- The vector(1536) matches OpenAI's text-embedding-3-small output size.
create table if not exists public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Use ivfflat for fast cosine-similarity search at our scale.
-- Lists=100 is fine for up to ~100k chunks; bump later if needed.
create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists document_chunks_user_idx
  on public.document_chunks (user_id);

alter table public.document_chunks enable row level security;

drop policy if exists "Chunks: own select" on public.document_chunks;
create policy "Chunks: own select"
  on public.document_chunks for select
  using (auth.uid() = user_id);

drop policy if exists "Chunks: own insert" on public.document_chunks;
create policy "Chunks: own insert"
  on public.document_chunks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Chunks: own delete" on public.document_chunks;
create policy "Chunks: own delete"
  on public.document_chunks for delete
  using (auth.uid() = user_id);

-- ---- match_document_chunks RPC --------------------------------------
-- Returns the top-K most similar chunks for a user's query embedding.
-- Used from the chat API to inject relevant context into the system prompt.
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  content text,
  similarity float
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
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = match_user_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Grant execute to authenticated users (RLS still applies via match_user_id check).
grant execute on function public.match_document_chunks(vector, uuid, int) to authenticated;
