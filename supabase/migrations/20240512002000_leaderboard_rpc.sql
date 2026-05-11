-- Leaderboard aggregates across all users (read-only). Uses SECURITY DEFINER so
-- authenticated clients can see anonymized rankings without broad SELECT on others' sessions.

create or replace function public.leaderboard_streak_days(days date[])
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  today date := (timezone('utc', now()))::date;
  d date := today;
  streak integer := 0;
begin
  if days is null or coalesce(array_length(days, 1), 0) = 0 then
    return 0;
  end if;
  if not (today = any (days)) then
    d := today - 1;
  end if;
  while d = any (days) loop
    streak := streak + 1;
    d := d - 1;
  end loop;
  return streak;
end;
$$;

create or replace function public.leaderboard_all_time()
returns table (
  user_id uuid,
  display_name text,
  total_focus_score bigint,
  streak_days integer,
  study_hours numeric,
  focus_accuracy integer,
  composite_score bigint
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
      case
        when s.focus_ms > 0 then (s.started_at at time zone 'utc')::date
      end as day
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
      a.user_id,
      p.name as display_name,
      a.total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((a.total_focus_ms::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when a.total_focus_ms > 0 then round(a.weighted / a.total_focus_ms)::integer
        else 0
      end as focus_accuracy
    from agg a
    join public.profiles p on p.id = a.user_id
  )
  select
    scored.user_id,
    scored.display_name,
    scored.total_focus_score,
    scored.streak_days,
    scored.study_hours,
    scored.focus_accuracy,
    round(
      scored.total_focus_score * 1
      + scored.streak_days * 180
      + scored.study_hours * 70
      + scored.focus_accuracy * 40
    )::bigint as composite_score
  from scored
  order by composite_score desc;
$$;

create or replace function public.leaderboard_monthly(p_year_month text)
returns table (
  user_id uuid,
  display_name text,
  total_focus_score bigint,
  streak_days integer,
  study_hours numeric,
  focus_accuracy integer,
  composite_score bigint
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
      case
        when s.focus_ms > 0 then (s.started_at at time zone 'utc')::date
      end as day
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
      a.user_id,
      p.name as display_name,
      a.total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((a.total_focus_ms::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when a.total_focus_ms > 0 then round(a.weighted / a.total_focus_ms)::integer
        else 0
      end as focus_accuracy
    from agg a
    join public.profiles p on p.id = a.user_id
  )
  select
    scored.user_id,
    scored.display_name,
    scored.total_focus_score,
    scored.streak_days,
    scored.study_hours,
    scored.focus_accuracy,
    round(
      scored.total_focus_score * 1
      + scored.streak_days * 180
      + scored.study_hours * 70
      + scored.focus_accuracy * 40
    )::bigint as composite_score
  from scored
  order by composite_score desc;
$$;

revoke all on function public.leaderboard_streak_days(date[]) from public;
revoke all on function public.leaderboard_all_time() from public;
revoke all on function public.leaderboard_monthly(text) from public;

grant execute on function public.leaderboard_all_time() to authenticated;
grant execute on function public.leaderboard_monthly(text) to authenticated;
