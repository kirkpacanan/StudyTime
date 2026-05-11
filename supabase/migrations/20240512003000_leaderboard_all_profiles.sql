-- Include every profile on the leaderboard (zero score when no sessions).

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
      p.id as user_id,
      p.name as display_name,
      coalesce(a.total_focus_score, 0)::bigint as total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((coalesce(a.total_focus_ms, 0)::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when coalesce(a.total_focus_ms, 0) > 0
          then round(coalesce(a.weighted, 0) / nullif(coalesce(a.total_focus_ms, 0), 0))::integer
        else 0
      end as focus_accuracy
    from public.profiles p
    left join agg a on a.user_id = p.id
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
  order by composite_score desc, scored.display_name asc nulls last;
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
      p.id as user_id,
      p.name as display_name,
      coalesce(a.total_focus_score, 0)::bigint as total_focus_score,
      public.leaderboard_streak_days(a.days) as streak_days,
      round((coalesce(a.total_focus_ms, 0)::numeric / 3600000.0) * 10) / 10 as study_hours,
      case
        when coalesce(a.total_focus_ms, 0) > 0
          then round(coalesce(a.weighted, 0) / nullif(coalesce(a.total_focus_ms, 0), 0))::integer
        else 0
      end as focus_accuracy
    from public.profiles p
    left join agg a on a.user_id = p.id
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
  order by composite_score desc, scored.display_name asc nulls last;
$$;
