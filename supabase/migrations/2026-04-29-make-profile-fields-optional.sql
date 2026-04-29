-- Migration: relax profile NOT-NULL constraints so onboarding can be 2 fields.
-- After this, grade/campus/major are optional and get collected later on /profile.
-- Run this once in Supabase → SQL Editor.

alter table public.profiles
  alter column grade drop not null,
  alter column campus drop not null,
  alter column major drop not null;
