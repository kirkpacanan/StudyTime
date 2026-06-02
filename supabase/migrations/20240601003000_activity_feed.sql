-- StudyTime: Activity feed + notifications.
-- activity_events is append-only; emit_activity_event writes server-side so XP
-- cannot be forged. get_activity_feed returns friends' (and public) events.
-- notifications power the topbar bell.
--
-- Run order: after 20240601002000_presence.sql.

-- ============================================================================
-- 1. Activity events
-- ============================================================================

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  verb text not null check (verb in (
    'session_completed', 'streak_milestone', 'achievement_unlocked',
    'level_up', 'friend_request_accepted', 'buddy_paired', 'started_studying'
  )),
  object_type text,
  object_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_created_idx
  on public.activity_events (created_at desc);
create index if not exists activity_events_actor_idx
  on public.activity_events (actor_id, created_at desc);

alter table public.activity_events enable row level security;

-- Reads go through the RPC; no direct table SELECT for other users.
drop policy if exists activity_events_select_own on public.activity_events;
create policy activity_events_select_own on public.activity_events
  for select using (auth.uid() = actor_id);

create or replace function public.emit_activity_event(
  p_verb text,
  p_object_type text default null,
  p_object_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.activity_events (actor_id, verb, object_type, object_id, metadata)
  values (auth.uid(), p_verb, p_object_type, p_object_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Feed: events from accepted friends who allow activity sharing, plus public
-- profiles. Keyset paginated by created_at.
create or replace function public.get_activity_feed(
  p_before timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  actor_id uuid,
  username citext,
  public_uid text,
  display_name text,
  avatar_id text,
  frame_id text,
  verb text,
  object_type text,
  object_id text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.actor_id,
    p.username,
    p.public_uid,
    coalesce(p.display_name, p.name, 'Student'),
    up.avatar_id,
    up.frame_id,
    e.verb,
    e.object_type,
    e.object_id,
    e.metadata,
    e.created_at
  from public.activity_events e
  join public.profiles p on p.id = e.actor_id
  left join public.user_profiles up on up.user_id = e.actor_id
  where coalesce(p.show_activity_feed, true)
    and (p_before is null or e.created_at < p_before)
    and (
      e.actor_id = auth.uid()
      or exists (
        select 1 from public.friends f
        where (f.user_a = auth.uid() and f.user_b = e.actor_id)
           or (f.user_b = auth.uid() and f.user_a = e.actor_id)
      )
    )
  order by e.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

-- ============================================================================
-- 2. Notifications
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any(p_ids));
$$;

grant execute on function public.emit_activity_event(text, text, text, jsonb) to authenticated;
grant execute on function public.get_activity_feed(timestamptz, integer) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ============================================================================
-- 3. Notify addressee when a friend request is created/accepted
-- ============================================================================

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    values (new.addressee_id, 'friend_request',
      jsonb_build_object('requesterId', new.requester_id, 'requestId', new.id));
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, type, payload)
    values (new.requester_id, 'friend_request_accepted',
      jsonb_build_object('userId', new.addressee_id));
    insert into public.activity_events (actor_id, verb, object_type, object_id)
    values (new.addressee_id, 'friend_request_accepted', 'user', new.requester_id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists on_friend_request_change on public.friend_requests;
create trigger on_friend_request_change
  after insert or update on public.friend_requests
  for each row execute function public.notify_friend_request();

-- Enable Realtime on notifications + activity.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.activity_events;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
