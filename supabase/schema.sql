-- =====================================================================
-- NuAnswers v2 — initial database schema
-- Apply this in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run; uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- =====================================================================

-- ---- profiles --------------------------------------------------------
-- Extends auth.users with FDU-specific fields. One row per user.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  student_id text not null check (student_id ~ '^[0-9]{7}$'),
  grade text not null check (grade in ('Freshman','Sophomore','Junior','Senior','Graduate')),
  campus text not null check (campus in ('Florham','Metro','Vancouver')),
  major text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles: own select" on public.profiles;
create policy "Profiles: own select"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles: own insert" on public.profiles;
create policy "Profiles: own insert"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles: own update" on public.profiles;
create policy "Profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- ---- chat_sessions ---------------------------------------------------
-- One row per chat (a student starts a new session for each course/topic).
create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  course_name text,
  course_id text check (course_id is null or course_id ~ '^(ACCT|ECON|FIN|MIS|WMA)_[0-9]{4}_[0-9]{2}$'),
  professor text,
  professor_email text check (professor_email is null or professor_email ~* '@fdu\.edu$'),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  message_count integer not null default 0,
  feedback_rating int check (feedback_rating between 1 and 5),
  feedback_topic text,
  feedback_difficulty int check (feedback_difficulty between 1 and 5),
  feedback_comments text
);

create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, started_at desc);

alter table public.chat_sessions enable row level security;

drop policy if exists "Sessions: own select" on public.chat_sessions;
create policy "Sessions: own select"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Sessions: own insert" on public.chat_sessions;
create policy "Sessions: own insert"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Sessions: own update" on public.chat_sessions;
create policy "Sessions: own update"
  on public.chat_sessions for update
  using (auth.uid() = user_id);

-- ---- messages --------------------------------------------------------
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_idx on public.messages (session_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Messages: own select" on public.messages;
create policy "Messages: own select"
  on public.messages for select
  using (auth.uid() = user_id);

drop policy if exists "Messages: own insert" on public.messages;
create policy "Messages: own insert"
  on public.messages for insert
  with check (auth.uid() = user_id);

-- ---- analytics_events ------------------------------------------------
-- One row per tracked event. Single table by design — easy to query.
create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  session_id uuid references public.chat_sessions on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_type_idx on public.analytics_events (event_type, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Events: own insert" on public.analytics_events;
create policy "Events: own insert"
  on public.analytics_events for insert
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Events: own select" on public.analytics_events;
create policy "Events: own select"
  on public.analytics_events for select
  using (auth.uid() = user_id);

-- ---- updated_at trigger ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
