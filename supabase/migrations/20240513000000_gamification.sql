-- StudyTime: Profile Customization + Gamification system.
-- Tables, RLS, indexes, catalog seed, signup trigger extension, backfill,
-- and leaderboard RPCs (weekly/monthly/all-time) returning XP + cosmetics.
--
-- Table mapping vs. spec:
--   UserProfiles      -> public.user_profiles (cosmetic loadout, 1:1 profiles)
--   UserXP            -> public.user_xp (xp/level/prestige)
--   Ranks             -> public.ranks (catalog)
--   Cosmetics         -> public.cosmetics (catalog)
--   UserCosmetics     -> public.user_cosmetics
--   Achievements      -> public.achievements (catalog)
--   UserAchievements  -> public.user_achievements
--   DailyQuests +     -> public.daily_quests (per-user generated instance +
--   UserQuestProgress    inline progress columns; scope = daily|weekly)
--   Streaks           -> public.streaks
--   Prestiges         -> public.prestiges (audit log; live count on user_xp)
--   StudyBuddies      -> public.study_buddies

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table if not exists public.user_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  avatar_id text not null default 'avatar_starter',
  frame_id text not null default 'frame_none',
  theme_id text not null default 'theme_default',
  title_id text,
  bio text not null default '',
  status text not null default 'Locked in',
  pinned_badges text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_xp (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level between 1 and 50),
  prestige integer not null default 0 check (prestige >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.ranks (
  slug text primary key,
  title text not null,
  level_min integer not null,
  level_max integer not null,
  sort_order integer not null
);

create table if not exists public.cosmetics (
  id text primary key,
  type text not null check (type in ('avatar', 'frame', 'theme')),
  name text not null,
  rarity text not null default 'common',
  unlock_level integer not null default 1,
  unlock_prestige integer,
  animated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.user_cosmetics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id text not null references public.cosmetics (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  rarity text not null default 'common',
  icon text not null default 'trophy',
  reward_xp integer not null default 0,
  animated boolean not null default false
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  progress integer not null default 0,
  unlocked_at timestamptz,
  primary key (user_id, achievement_id)
);

-- Per-user generated quest instance (daily or weekly) + inline progress.
create table if not exists public.daily_quests (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'daily' check (scope in ('daily', 'weekly')),
  period_key text not null,
  template_id text not null,
  title text not null,
  metric text not null,
  target integer not null,
  progress integer not null default 0,
  reward_xp integer not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists daily_quests_user_period_idx
  on public.daily_quests (user_id, scope, period_key);

create table if not exists public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_study_date date,
  freeze_tokens integer not null default 0,
  claimed_milestones integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.prestiges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prestige_level integer not null,
  created_at timestamptz not null default now()
);

create index if not exists prestiges_user_idx on public.prestiges (user_id);

create table if not exists public.study_buddies (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a <> user_b)
);

create index if not exists study_buddies_user_a_idx on public.study_buddies (user_a);
create index if not exists study_buddies_user_b_idx on public.study_buddies (user_b);

-- ============================================================================
-- 2. Row Level Security
-- ============================================================================

alter table public.user_profiles enable row level security;
alter table public.user_xp enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_achievements enable row level security;
alter table public.daily_quests enable row level security;
alter table public.streaks enable row level security;
alter table public.prestiges enable row level security;
alter table public.study_buddies enable row level security;
alter table public.ranks enable row level security;
alter table public.cosmetics enable row level security;
alter table public.achievements enable row level security;

-- Per-user owned rows: full CRUD when user_id = auth.uid().
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_profiles', 'user_xp', 'user_cosmetics', 'user_achievements',
    'daily_quests', 'streaks', 'prestiges'
  ] loop
    execute format('drop policy if exists %I_select_own on public.%I;', t, t);
    execute format('drop policy if exists %I_insert_own on public.%I;', t, t);
    execute format('drop policy if exists %I_update_own on public.%I;', t, t);
    execute format('drop policy if exists %I_delete_own on public.%I;', t, t);
    execute format('create policy %I_select_own on public.%I for select using (auth.uid() = user_id);', t, t);
    execute format('create policy %I_insert_own on public.%I for insert with check (auth.uid() = user_id);', t, t);
    execute format('create policy %I_update_own on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t, t);
    execute format('create policy %I_delete_own on public.%I for delete using (auth.uid() = user_id);', t, t);
  end loop;
end $$;

-- Catalog tables: read-only for authenticated users.
do $$
declare
  t text;
begin
  foreach t in array array['ranks', 'cosmetics', 'achievements'] loop
    execute format('drop policy if exists %I_select_all on public.%I;', t, t);
    execute format('create policy %I_select_all on public.%I for select to authenticated using (true);', t, t);
  end loop;
end $$;

-- Study buddies: either side can read; a user may create/modify rows they are part of.
drop policy if exists study_buddies_select on public.study_buddies;
drop policy if exists study_buddies_insert on public.study_buddies;
drop policy if exists study_buddies_update on public.study_buddies;
drop policy if exists study_buddies_delete on public.study_buddies;
create policy study_buddies_select on public.study_buddies
  for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy study_buddies_insert on public.study_buddies
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);
create policy study_buddies_update on public.study_buddies
  for update using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);
create policy study_buddies_delete on public.study_buddies
  for delete using (auth.uid() = user_a or auth.uid() = user_b);

-- ============================================================================
-- 3. Catalog seed (mirrors lib/gamification code catalogs)
-- ============================================================================

insert into public.ranks (slug, title, level_min, level_max, sort_order) values
  ('brainrot_victim', 'Brainrot Victim', 1, 5, 1),
  ('tryhard_apprentice', 'Tryhard Apprentice', 6, 10, 2),
  ('locked_in', 'Locked In', 11, 15, 3),
  ('main_character', 'Main Character', 16, 20, 4),
  ('no_cap_scholar', 'No Cap Scholar', 21, 25, 5),
  ('academic_weapon', 'Academic Weapon', 26, 30, 6),
  ('rizz_professor', 'Rizz Professor', 31, 40, 7),
  ('study_goat', 'Study GOAT', 41, 50, 8)
on conflict (slug) do nothing;

insert into public.cosmetics (id, type, name, rarity, unlock_level, unlock_prestige, animated) values
  ('avatar_starter', 'avatar', 'Fresh Start', 'common', 1, null, false),
  ('avatar_bot', 'avatar', 'Focus Bot', 'common', 6, null, false),
  ('avatar_locked_neon', 'avatar', 'Neon Scholar', 'rare', 11, null, false),
  ('avatar_locked_pixel', 'avatar', 'Pixel Grinder', 'rare', 11, null, false),
  ('avatar_locked_fun', 'avatar', 'Lo-fi Hero', 'rare', 11, null, false),
  ('avatar_main_lorelei', 'avatar', 'Main Character', 'epic', 16, null, false),
  ('avatar_weapon_thumbs', 'avatar', 'Academic Weapon', 'epic', 26, null, false),
  ('avatar_goat', 'avatar', 'The GOAT', 'legendary', 41, null, false),
  ('frame_none', 'frame', 'No Frame', 'common', 1, null, false),
  ('frame_apprentice', 'frame', 'Emerald Ring', 'common', 11, null, false),
  ('frame_locked_in', 'frame', 'Locked-In Glow', 'rare', 6, null, false),
  ('frame_main_animated', 'frame', 'Animated Aura', 'epic', 31, null, true),
  ('frame_professor', 'frame', 'Prismatic Pulse', 'epic', 16, null, true),
  ('frame_goat_crown', 'frame', 'GOAT Crown', 'legendary', 41, null, true),
  ('frame_prestige', 'frame', 'Prestige Halo', 'legendary', 1, 1, true),
  ('theme_default', 'theme', 'Sky Default', 'common', 1, null, false),
  ('theme_forest', 'theme', 'Forest', 'common', 6, null, false),
  ('theme_focus_pack', 'theme', 'Focus Pack', 'rare', 11, null, false),
  ('theme_main_banner', 'theme', 'Spotlight Banner', 'epic', 16, null, false),
  ('theme_sunset', 'theme', 'Sunset', 'rare', 21, null, false),
  ('theme_goat_gold', 'theme', 'GOAT Gold', 'legendary', 41, null, false)
on conflict (id) do nothing;

insert into public.achievements (id, title, description, category, rarity, icon, reward_xp, animated) values
  ('focus_master', 'Focus Master', 'Maintain ≥90% focus accuracy across your last 10 sessions.', 'focus', 'epic', 'target', 250, false),
  ('deep_focus_champion', 'Deep Focus Champion', 'Finish a session with ≥85 avg focus and ≥20 minutes focused.', 'focus', 'rare', 'zap', 150, false),
  ('iron_focus', 'Iron Focus', 'Complete a single focus block of 45 minutes or more.', 'focus', 'rare', 'award', 150, false),
  ('night_owl', 'Night Owl', 'Complete a study session between 10 PM and 6 AM.', 'seasonal', 'common', 'moon', 80, false),
  ('early_bird', 'Early Bird', 'Complete a study session between 4 AM and 7 AM.', 'seasonal', 'rare', 'sunrise', 120, false),
  ('weekend_warrior', 'Weekend Warrior', 'Study on both Saturday and Sunday.', 'seasonal', 'common', 'calendar', 100, false),
  ('streak_7', '7-Day Study Streak', 'Study at least once per day for 7 consecutive days.', 'consistency', 'common', 'flame', 120, false),
  ('streak_14', 'Fortnight Flame', 'Keep a 14-day study streak alive.', 'consistency', 'rare', 'flame', 220, false),
  ('streak_30', 'Unbreakable', 'Reach a 30-day study streak.', 'consistency', 'legendary', 'flame', 500, true),
  ('speed_demon', 'Speed Demon', 'Finish 3 study sessions in a single day.', 'speed', 'rare', 'rocket', 180, false),
  ('buddy_bond', 'Buddy Bond', 'Pair up with a study buddy.', 'social', 'common', 'users', 100, false),
  ('top_100_global', 'Top 100 Global User', 'Reach top 100 on the all-time leaderboard.', 'social', 'epic', 'trophy', 300, false),
  ('monthly_top_performer', 'Monthly Top Performer', 'Rank in the top 10 for the current monthly leaderboard.', 'social', 'legendary', 'crown', 400, true)
on conflict (id) do nothing;

-- ============================================================================
-- 4. Signup trigger extension + backfill
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  set row_security = off;
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Student')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id, settings)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  insert into public.user_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_xp (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.streaks (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill gamification rows for existing profiles.
insert into public.user_profiles (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.user_xp (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.streaks (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- ============================================================================
-- 5. Buddy activity RPC (RLS-safe peek at a paired buddy's study activity)
-- ============================================================================

create or replace function public.buddy_studied_today(p_buddy uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_buddies b
    where b.status = 'active'
      and (
        (b.user_a = auth.uid() and b.user_b = p_buddy)
        or (b.user_b = auth.uid() and b.user_a = p_buddy)
      )
  )
  and exists (
    select 1
    from public.study_sessions s
    where s.user_id = p_buddy
      and s.focus_ms > 0
      and (s.started_at at time zone 'utc')::date = (timezone('utc', now()))::date
  );
$$;

revoke all on function public.buddy_studied_today(uuid) from public;
grant execute on function public.buddy_studied_today(uuid) to authenticated;

-- ============================================================================
-- 6. Leaderboard RPCs (now include level / xp / prestige / cosmetics)
-- ============================================================================

drop function if exists public.leaderboard_all_time();
drop function if exists public.leaderboard_monthly(text);

create function public.leaderboard_all_time()
returns table (
  user_id uuid,
  display_name text,
  total_focus_score bigint,
  streak_days integer,
  study_hours numeric,
  focus_accuracy integer,
  composite_score bigint,
  level integer,
  xp bigint,
  prestige integer,
  avatar_id text,
  frame_id text,
  title_id text,
  pinned_badges text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with sess as (
    select
      s.user_id,
      round((s.focus_ms::numeric / 60000.0) * (s.average_focus::numeric / 100.0) * 12)::bigint as pts,
      s.focus_ms,
      s.focused_ratio::numeric as fr,
      case when s.focus_ms > 0 then (s.started_at at time zone 'utc')::date end as day
    from public.study_sessions s
  ),
  agg as (
    select
      sess.user_id,
      coalesce(sum(sess.pts), 0)::bigint as total_focus_score,
      coalesce(sum(sess.focus_ms), 0)::bigint as total_focus_ms,
      coalesce(sum(sess.fr * sess.focus_ms), 0::numeric) as weighted,
      array_remove(array_agg(distinct sess.day), null) as days
    from sess
    group by sess.user_id
  ),
  scored as (
    select
      p.id as user_id,
      p.name as display_name,
      coalesce(a.total_focus_score, 0)::bigint as total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((coalesce(a.total_focus_ms, 0)::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when coalesce(a.total_focus_ms, 0) > 0
          then round(coalesce(a.weighted, 0) / nullif(coalesce(a.total_focus_ms, 0), 0))::integer
        else 0
      end as focus_accuracy,
      coalesce(ux.level, 1) as level,
      coalesce(ux.xp, 0)::bigint as xp,
      coalesce(ux.prestige, 0) as prestige,
      up.avatar_id,
      up.frame_id,
      up.title_id,
      coalesce(up.pinned_badges, '{}') as pinned_badges
    from public.profiles p
    left join agg a on a.user_id = p.id
    left join public.user_xp ux on ux.user_id = p.id
    left join public.user_profiles up on up.user_id = p.id
  )
  select
    scored.user_id, scored.display_name, scored.total_focus_score,
    scored.streak_days, scored.study_hours, scored.focus_accuracy,
    round(
      scored.total_focus_score * 1
      + scored.streak_days * 180
      + scored.study_hours * 70
      + scored.focus_accuracy * 40
    )::bigint as composite_score,
    scored.level, scored.xp, scored.prestige,
    scored.avatar_id, scored.frame_id, scored.title_id, scored.pinned_badges
  from scored
  order by composite_score desc, scored.display_name asc nulls last;
$$;

create function public.leaderboard_monthly(p_year_month text)
returns table (
  user_id uuid,
  display_name text,
  total_focus_score bigint,
  streak_days integer,
  study_hours numeric,
  focus_accuracy integer,
  composite_score bigint,
  level integer,
  xp bigint,
  prestige integer,
  avatar_id text,
  frame_id text,
  title_id text,
  pinned_badges text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with sess as (
    select
      s.user_id,
      round((s.focus_ms::numeric / 60000.0) * (s.average_focus::numeric / 100.0) * 12)::bigint as pts,
      s.focus_ms,
      s.focused_ratio::numeric as fr,
      case when s.focus_ms > 0 then (s.started_at at time zone 'utc')::date end as day
    from public.study_sessions s
    where (s.started_at at time zone 'utc')::date >= (p_year_month || '-01')::date
      and (s.started_at at time zone 'utc')::date < ((p_year_month || '-01')::date + interval '1 month')::date
  ),
  agg as (
    select
      sess.user_id,
      coalesce(sum(sess.pts), 0)::bigint as total_focus_score,
      coalesce(sum(sess.focus_ms), 0)::bigint as total_focus_ms,
      coalesce(sum(sess.fr * sess.focus_ms), 0::numeric) as weighted,
      array_remove(array_agg(distinct sess.day), null) as days
    from sess
    group by sess.user_id
  ),
  scored as (
    select
      p.id as user_id,
      p.name as display_name,
      coalesce(a.total_focus_score, 0)::bigint as total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((coalesce(a.total_focus_ms, 0)::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when coalesce(a.total_focus_ms, 0) > 0
          then round(coalesce(a.weighted, 0) / nullif(coalesce(a.total_focus_ms, 0), 0))::integer
        else 0
      end as focus_accuracy,
      coalesce(ux.level, 1) as level,
      coalesce(ux.xp, 0)::bigint as xp,
      coalesce(ux.prestige, 0) as prestige,
      up.avatar_id,
      up.frame_id,
      up.title_id,
      coalesce(up.pinned_badges, '{}') as pinned_badges
    from public.profiles p
    left join agg a on a.user_id = p.id
    left join public.user_xp ux on ux.user_id = p.id
    left join public.user_profiles up on up.user_id = p.id
  )
  select
    scored.user_id, scored.display_name, scored.total_focus_score,
    scored.streak_days, scored.study_hours, scored.focus_accuracy,
    round(
      scored.total_focus_score * 1
      + scored.streak_days * 180
      + scored.study_hours * 70
      + scored.focus_accuracy * 40
    )::bigint as composite_score,
    scored.level, scored.xp, scored.prestige,
    scored.avatar_id, scored.frame_id, scored.title_id, scored.pinned_badges
  from scored
  order by composite_score desc, scored.display_name asc nulls last;
$$;

create or replace function public.leaderboard_weekly(p_week_start text)
returns table (
  user_id uuid,
  display_name text,
  total_focus_score bigint,
  streak_days integer,
  study_hours numeric,
  focus_accuracy integer,
  composite_score bigint,
  level integer,
  xp bigint,
  prestige integer,
  avatar_id text,
  frame_id text,
  title_id text,
  pinned_badges text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with sess as (
    select
      s.user_id,
      round((s.focus_ms::numeric / 60000.0) * (s.average_focus::numeric / 100.0) * 12)::bigint as pts,
      s.focus_ms,
      s.focused_ratio::numeric as fr,
      case when s.focus_ms > 0 then (s.started_at at time zone 'utc')::date end as day
    from public.study_sessions s
    where (s.started_at at time zone 'utc')::date >= p_week_start::date
      and (s.started_at at time zone 'utc')::date < (p_week_start::date + interval '7 days')::date
  ),
  agg as (
    select
      sess.user_id,
      coalesce(sum(sess.pts), 0)::bigint as total_focus_score,
      coalesce(sum(sess.focus_ms), 0)::bigint as total_focus_ms,
      coalesce(sum(sess.fr * sess.focus_ms), 0::numeric) as weighted,
      array_remove(array_agg(distinct sess.day), null) as days
    from sess
    group by sess.user_id
  ),
  scored as (
    select
      p.id as user_id,
      p.name as display_name,
      coalesce(a.total_focus_score, 0)::bigint as total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((coalesce(a.total_focus_ms, 0)::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when coalesce(a.total_focus_ms, 0) > 0
          then round(coalesce(a.weighted, 0) / nullif(coalesce(a.total_focus_ms, 0), 0))::integer
        else 0
      end as focus_accuracy,
      coalesce(ux.level, 1) as level,
      coalesce(ux.xp, 0)::bigint as xp,
      coalesce(ux.prestige, 0) as prestige,
      up.avatar_id,
      up.frame_id,
      up.title_id,
      coalesce(up.pinned_badges, '{}') as pinned_badges
    from public.profiles p
    left join agg a on a.user_id = p.id
    left join public.user_xp ux on ux.user_id = p.id
    left join public.user_profiles up on up.user_id = p.id
  )
  select
    scored.user_id, scored.display_name, scored.total_focus_score,
    scored.streak_days, scored.study_hours, scored.focus_accuracy,
    round(
      scored.total_focus_score * 1
      + scored.streak_days * 180
      + scored.study_hours * 70
      + scored.focus_accuracy * 40
    )::bigint as composite_score,
    scored.level, scored.xp, scored.prestige,
    scored.avatar_id, scored.frame_id, scored.title_id, scored.pinned_badges
  from scored
  order by composite_score desc, scored.display_name asc nulls last;
$$;

revoke all on function public.leaderboard_all_time() from public;
revoke all on function public.leaderboard_monthly(text) from public;
revoke all on function public.leaderboard_weekly(text) from public;

grant execute on function public.leaderboard_all_time() to authenticated;
grant execute on function public.leaderboard_monthly(text) to authenticated;
grant execute on function public.leaderboard_weekly(text) to authenticated;
