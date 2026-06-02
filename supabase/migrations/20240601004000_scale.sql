-- StudyTime: Scale-prep.
-- 1. Materialized all-time leaderboard (cached aggregate) + refresh + cron.
-- 2. Privacy-aware all-time leaderboard RPC reading the MV.
-- 3. Lightweight session summary view (no heavy samples/events JSON).
-- 4. Session retention/archival helper.
--
-- Run order: after 20240601003000_activity_feed.sql.

-- ============================================================================
-- 1. Materialized all-time leaderboard
-- ============================================================================

drop materialized view if exists public.leaderboard_all_time_mv;
create materialized view public.leaderboard_all_time_mv as
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
  )
  select
    p.id as user_id,
    coalesce(p.display_name, p.name) as display_name,
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
  where coalesce(p.show_on_leaderboard, true);

create unique index if not exists leaderboard_all_time_mv_user_idx
  on public.leaderboard_all_time_mv (user_id);

create or replace function public.refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.leaderboard_all_time_mv;
exception when others then
  -- CONCURRENTLY needs a populated unique index; fall back on first run.
  refresh materialized view public.leaderboard_all_time_mv;
end;
$$;

-- ============================================================================
-- 2. All-time leaderboard RPC reads the cached MV (privacy filter baked in)
-- ============================================================================

drop function if exists public.leaderboard_all_time();
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
  select
    m.user_id, m.display_name, m.total_focus_score,
    m.streak_days, m.study_hours, m.focus_accuracy,
    round(
      m.total_focus_score * 1
      + m.streak_days * 180
      + m.study_hours * 70
      + m.focus_accuracy * 40
    )::bigint as composite_score,
    m.level, m.xp, m.prestige,
    m.avatar_id, m.frame_id, m.title_id, m.pinned_badges
  from public.leaderboard_all_time_mv m
  order by composite_score desc, m.display_name asc nulls last;
$$;

grant execute on function public.leaderboard_all_time() to authenticated;
grant execute on function public.refresh_leaderboards() to authenticated;

-- Initial population.
select public.refresh_leaderboards();

-- Schedule a refresh every 10 minutes when pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'refresh-leaderboards',
      '*/10 * * * *',
      'select public.refresh_leaderboards();'
    );
  end if;
exception when others then
  -- pg_cron not installed / insufficient privileges: refresh manually or via Edge cron.
  null;
end $$;

-- ============================================================================
-- 3. Lightweight session summary view (omits samples/events JSON)
-- ============================================================================

create or replace view public.study_session_summaries as
  select
    s.id,
    s.user_id,
    s.started_at,
    s.ended_at,
    s.focus_ms,
    s.break_ms,
    s.average_focus,
    s.focused_ratio,
    s.distraction_events
  from public.study_sessions s;

-- View inherits RLS from study_sessions via security_invoker.
alter view public.study_session_summaries set (security_invoker = true);
grant select on public.study_session_summaries to authenticated;

-- ============================================================================
-- 4. Session retention helper (archive heavy JSON beyond a cutoff)
-- ============================================================================

-- Nulls out samples/events JSON for sessions older than p_days to cap storage
-- and egress; aggregate columns (focus_ms, average_focus, ...) are preserved.
create or replace function public.prune_old_session_samples(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.study_sessions
  set samples = '[]'::jsonb, events = null
  where ended_at < now() - make_interval(days => greatest(1, p_days))
    and (jsonb_array_length(samples) > 0 or events is not null);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
