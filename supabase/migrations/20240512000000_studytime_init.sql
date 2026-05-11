-- StudyTime: profiles, settings, sessions + RLS
-- Run in Supabase SQL Editor or via `supabase db push` after linking the project.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default 'Student',
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  focus_ms integer not null,
  break_ms integer not null,
  average_focus integer not null,
  focused_ratio integer not null,
  distraction_events integer not null,
  samples jsonb not null default '[]'::jsonb,
  events jsonb
);

create index if not exists study_sessions_user_started_idx
  on public.study_sessions (user_id, started_at desc);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.study_sessions enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id);

create policy "study_sessions_select_own"
  on public.study_sessions for select
  using (auth.uid() = user_id);

create policy "study_sessions_insert_own"
  on public.study_sessions for insert
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trigger runs when a new row is inserted into `auth.users`.
  -- At that moment `auth.uid()` may be NULL, and RLS policies for INSERT
  -- can prevent the profile/settings rows from being created.
  -- Disable row-level security for this internal bootstrap operation.
  set row_security = off;
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Student')
  );
  insert into public.user_settings (user_id, settings)
  values (new.id, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
