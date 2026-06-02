-- StudyTime: Real-time study status and presence.
-- One row per user, upserted via a heartbeat. Friends read allowed presence
-- through a SECURITY DEFINER RPC; Realtime broadcasts row changes.
--
-- Run order: after 20240601001000_friends.sql.

create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'offline'
    check (status in ('offline', 'online', 'studying')),
  session_id uuid references public.study_sessions (id) on delete set null,
  focus_phase text,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc);

alter table public.user_presence enable row level security;

-- Owner can read/write their own row; friends read via RPC.
drop policy if exists user_presence_select_own on public.user_presence;
create policy user_presence_select_own on public.user_presence
  for select using (auth.uid() = user_id);

drop policy if exists user_presence_upsert_own on public.user_presence;
create policy user_presence_upsert_own on public.user_presence
  for insert with check (auth.uid() = user_id);

drop policy if exists user_presence_update_own on public.user_presence;
create policy user_presence_update_own on public.user_presence
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Heartbeat: upsert presence. Marks offline implicitly via stale last_seen_at.
create or replace function public.heartbeat_presence(
  p_status text default 'online',
  p_session_id uuid default null,
  p_focus_phase text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('offline', 'online', 'studying') then
    raise exception 'Invalid status';
  end if;

  insert into public.user_presence (user_id, status, session_id, focus_phase, last_seen_at, updated_at)
  values (auth.uid(), p_status, p_session_id, p_focus_phase, now(), now())
  on conflict (user_id) do update
  set status = excluded.status,
      session_id = excluded.session_id,
      focus_phase = excluded.focus_phase,
      last_seen_at = now(),
      updated_at = now();
end;
$$;

-- Friends' presence (respects show_study_status + 90s staleness).
create or replace function public.get_friends_presence()
returns table (
  user_id uuid,
  status text,
  focus_phase text,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.user_id,
    case
      when not coalesce(p.show_study_status, true) then 'offline'
      when pr.last_seen_at < now() - interval '90 seconds' then 'offline'
      else pr.status
    end as status,
    pr.focus_phase,
    pr.last_seen_at
  from public.user_presence pr
  join public.profiles p on p.id = pr.user_id
  where exists (
    select 1 from public.friends f
    where (f.user_a = auth.uid() and f.user_b = pr.user_id)
       or (f.user_b = auth.uid() and f.user_a = pr.user_id)
  );
$$;

-- Friends list with identity + presence (defined here so it can reference
-- public.user_presence, which is created above).
create or replace function public.list_friends()
returns table (
  user_id uuid,
  username citext,
  public_uid text,
  display_name text,
  avatar_id text,
  frame_id text,
  level integer,
  current_streak integer,
  presence_status text,
  last_seen_at timestamptz,
  friends_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.public_uid,
    coalesce(p.display_name, p.name, 'Student'),
    up.avatar_id,
    up.frame_id,
    coalesce(x.level, 1),
    coalesce(s.current_streak, 0),
    case
      when not coalesce(p.show_study_status, true) then 'offline'
      when pr.last_seen_at is null or pr.last_seen_at < now() - interval '90 seconds'
        then 'offline'
      else coalesce(pr.status, 'offline')
    end as presence_status,
    pr.last_seen_at,
    f.created_at
  from public.friends f
  join public.profiles p
    on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id
  left join public.streaks s on s.user_id = p.id
  left join public.user_presence pr on pr.user_id = p.id
  where f.user_a = auth.uid() or f.user_b = auth.uid()
  order by
    case
      when coalesce(p.show_study_status, true)
        and pr.last_seen_at >= now() - interval '90 seconds'
        and pr.status = 'studying' then 0
      when coalesce(p.show_study_status, true)
        and pr.last_seen_at >= now() - interval '90 seconds'
        and pr.status = 'online' then 1
      else 2
    end,
    coalesce(p.display_name, p.name);
$$;

grant execute on function public.heartbeat_presence(text, uuid, text) to authenticated;
grant execute on function public.get_friends_presence() to authenticated;
grant execute on function public.list_friends() to authenticated;

-- Enable Realtime on presence changes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.user_presence;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
