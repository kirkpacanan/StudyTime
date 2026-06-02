-- ============================================================================
-- CONTINUE after APPLY_SOCIAL.sql failed at remove_friend (42P13)
-- ============================================================================
-- Do NOT re-run APPLY_SOCIAL.sql. Run this file once in SQL Editor instead.
-- ============================================================================
-- StudyTime: Social system repair â€” relationships, study buddies, search, notifications.
-- Run order: after 20240601004000_scale.sql

-- ============================================================================
-- 1. Normalize study_buddies ordering (match friends table: user_a < user_b)
-- ============================================================================

-- Remove duplicate reversed pairs, keeping the row with the earliest created_at.
delete from public.study_buddies sb
where sb.user_a > sb.user_b
  and exists (
    select 1 from public.study_buddies other
    where other.user_a = sb.user_b
      and other.user_b = sb.user_a
  );

update public.study_buddies
set user_a = least(user_a, user_b),
    user_b = greatest(user_a, user_b)
where user_a > user_b;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'study_buddies_order_check'
  ) then
    alter table public.study_buddies
      add constraint study_buddies_order_check check (user_a < user_b);
  end if;
end $$;

-- Only one active buddy per user (each user appears once across active rows).
create unique index if not exists study_buddies_active_user_a_idx
  on public.study_buddies (user_a) where status = 'active';
create unique index if not exists study_buddies_active_user_b_idx
  on public.study_buddies (user_b) where status = 'active';

create index if not exists study_buddies_active_pair_idx
  on public.study_buddies (user_a, user_b) where status = 'active';

-- Blocked-user lookups for search / send request.
create index if not exists friend_requests_blocked_idx
  on public.friend_requests (requester_id, addressee_id) where status = 'blocked';

-- ============================================================================
-- 2. Relationship helper (reused by profile + search RPCs)
-- ============================================================================

create or replace function public.get_user_relationship(
  p_self uuid,
  p_target uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
begin
  if p_self is null or p_target is null then
    return 'none';
  end if;
  if p_self = p_target then
    return 'self';
  end if;

  v_a := least(p_self, p_target);
  v_b := greatest(p_self, p_target);

  if exists (
    select 1 from public.friends f
    where f.user_a = v_a and f.user_b = v_b
  ) then
    return 'friend';
  end if;

  if exists (
    select 1 from public.friend_requests
    where status = 'blocked'
      and requester_id = p_self and addressee_id = p_target
  ) then
    return 'blocked';
  end if;

  if exists (
    select 1 from public.friend_requests
    where status = 'blocked'
      and requester_id = p_target and addressee_id = p_self
  ) then
    return 'blocked_by';
  end if;

  if exists (
    select 1 from public.friend_requests
    where status = 'pending'
      and requester_id = p_target and addressee_id = p_self
  ) then
    return 'pending_in';
  end if;

  if exists (
    select 1 from public.friend_requests
    where status = 'pending'
      and requester_id = p_self and addressee_id = p_target
  ) then
    return 'pending_out';
  end if;

  return 'none';
end;
$$;

create or replace function public.get_friend_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.friends f
  where f.user_a = p_user or f.user_b = p_user;
$$;

-- ============================================================================
-- 3. Profile RPCs â€” relationship states, friend count, study buddy card
-- ============================================================================

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'userId', p.id,
    'email', p.email,
    'username', p.username,
    'publicUid', p.public_uid,
    'displayName', coalesce(p.display_name, p.name, 'Student'),
    'memberSince', p.created_at,
    'friendCount', public.get_friend_count(p.id),
    'privacy', jsonb_build_object(
      'profileVisibility', p.profile_visibility,
      'showOnLeaderboard', p.show_on_leaderboard,
      'allowFriendRequests', p.allow_friend_requests,
      'showStudyStatus', p.show_study_status,
      'showActivityFeed', p.show_activity_feed
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.get_public_profile(
  p_target uuid default null,
  p_username text default null,
  p_public_uid text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_self uuid := auth.uid();
  v_visibility text;
  v_is_friend boolean := false;
  v_relationship text := 'none';
  v_card jsonb;
  v_stats jsonb;
  v_buddy jsonb := null;
  v_friend_count integer;
begin
  select id, profile_visibility
    into v_id, v_visibility
  from public.profiles
  where (p_target is not null and id = p_target)
     or (p_username is not null and username = lower(trim(p_username)))
     or (p_public_uid is not null and public_uid = upper(trim(p_public_uid)))
  limit 1;

  if v_id is null then
    return null;
  end if;

  v_relationship := public.get_user_relationship(v_self, v_id);
  v_is_friend := v_relationship = 'friend';
  v_friend_count := public.get_friend_count(v_id);

  select jsonb_build_object(
    'userId', p.id,
    'username', p.username,
    'publicUid', p.public_uid,
    'displayName', coalesce(p.display_name, p.name, 'Student'),
    'memberSince', p.created_at,
    'friendCount', v_friend_count,
    'profileVisibility', p.profile_visibility,
    'allowFriendRequests', p.allow_friend_requests,
    'loadout', jsonb_build_object(
      'avatarId', up.avatar_id,
      'frameId', up.frame_id,
      'themeId', up.theme_id,
      'titleId', up.title_id,
      'bio', up.bio,
      'status', up.status,
      'pinnedBadges', up.pinned_badges
    ),
    'level', coalesce(x.level, 1),
    'prestige', coalesce(x.prestige, 0),
    'xp', coalesce(x.xp, 0)
  )
  into v_card
  from public.profiles p
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id
  where p.id = v_id;

  if v_relationship = 'self'
     or v_visibility = 'public'
     or (v_visibility = 'friends' and v_is_friend) then
    select jsonb_build_object(
      'currentStreak', coalesce(s.current_streak, 0),
      'longestStreak', coalesce(s.longest_streak, 0),
      'totalFocusHours', coalesce(
        (select round(sum(ss.focus_ms) / 3600000.0, 1)
         from public.study_sessions ss where ss.user_id = v_id), 0),
      'sessionsCount', coalesce(
        (select count(*) from public.study_sessions ss where ss.user_id = v_id), 0)
    )
    into v_stats
    from public.streaks s
    where s.user_id = v_id;
    v_card := v_card || jsonb_build_object('stats', coalesce(v_stats, '{}'::jsonb), 'visible', true);
  else
    v_card := v_card || jsonb_build_object('stats', null, 'visible', false);
  end if;

  -- Active study buddy (visible on public/friend/self profiles).
  if v_relationship in ('self', 'friend') or v_visibility = 'public' then
    select jsonb_build_object(
      'buddyId', buddy.id,
      'username', buddy.username,
      'publicUid', buddy.public_uid,
      'displayName', coalesce(buddy.display_name, buddy.name, 'Student'),
      'avatarId', up.avatar_id,
      'frameId', up.frame_id,
      'level', coalesce(x.level, 1),
      'pairedSince', b.created_at
    )
    into v_buddy
    from public.study_buddies b
    join public.profiles buddy
      on buddy.id = case when b.user_a = v_id then b.user_b else b.user_a end
    left join public.user_profiles up on up.user_id = buddy.id
    left join public.user_xp x on x.user_id = buddy.id
    where b.status = 'active'
      and (b.user_a = v_id or b.user_b = v_id)
    limit 1;
  end if;

  v_card := v_card
    || jsonb_build_object('relationship', v_relationship)
    || jsonb_build_object('studyBuddy', v_buddy);
  return v_card;
end;
$$;

-- Search with relationship + blocked exclusion.
drop function if exists public.search_users(text, integer);

create function public.search_users(p_query text, p_limit integer default 20)
returns table (
  user_id uuid,
  username citext,
  public_uid text,
  display_name text,
  avatar_id text,
  frame_id text,
  level integer,
  relationship text
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select lower(trim(p_query)) as term
  )
  select
    p.id,
    p.username,
    p.public_uid,
    coalesce(p.display_name, p.name, 'Student') as display_name,
    up.avatar_id,
    up.frame_id,
    coalesce(x.level, 1) as level,
    public.get_user_relationship(auth.uid(), p.id) as relationship
  from public.profiles p
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id, q
  where q.term <> ''
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and p.profile_visibility <> 'private'
    and public.get_user_relationship(auth.uid(), p.id) not in ('blocked', 'blocked_by')
    and (
      p.username % q.term
      or p.username ilike q.term || '%'
      or lower(coalesce(p.display_name, p.name)) ilike '%' || q.term || '%'
      or upper(p.public_uid) = upper(trim(p_query))
    )
  order by
    (upper(p.public_uid) = upper(trim(p_query))) desc,
    (p.username ilike q.term || '%') desc,
    similarity(coalesce(p.username, ''::citext), q.term) desc
  limit greatest(1, least(p_limit, 50));
$$;

grant execute on function public.search_users(text, integer) to authenticated;

-- ============================================================================
-- 4. Friend RPC improvements â€” cancel outgoing, return errors, cleanup buddies
-- ============================================================================

create or replace function public.cancel_friend_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  update public.friend_requests
  set status = 'declined', responded_at = now()
  where id = p_request_id
    and requester_id = v_self
    and status = 'pending';

  if not found then
    raise exception 'Request not found or already handled.';
  end if;

  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- Return type changed from void â†’ jsonb; Postgres requires DROP first.
drop function if exists public.remove_friend(uuid);
drop function if exists public.block_user(uuid);

create or replace function public.remove_friend(p_friend uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_a uuid;
  v_b uuid;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  v_a := least(v_self, p_friend);
  v_b := greatest(v_self, p_friend);

  delete from public.friends
  where user_a = v_a and user_b = v_b;

  if not found then
    raise exception 'Friendship not found.';
  end if;

  delete from public.friend_requests
  where (requester_id = v_self and addressee_id = p_friend)
     or (requester_id = p_friend and addressee_id = v_self);

  -- End study buddy pairing when friendship ends.
  update public.study_buddies
  set status = 'ended'
  where status = 'active'
    and user_a = v_a and user_b = v_b;

  return jsonb_build_object('status', 'removed');
end;
$$;

create or replace function public.block_user(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_a uuid;
  v_b uuid;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_self = p_target then raise exception 'You cannot block yourself.'; end if;

  v_a := least(v_self, p_target);
  v_b := greatest(v_self, p_target);

  delete from public.friends
  where user_a = v_a and user_b = v_b;

  delete from public.friend_requests
  where (requester_id = p_target and addressee_id = v_self)
     or (requester_id = v_self and addressee_id = p_target);

  insert into public.friend_requests (requester_id, addressee_id, status, responded_at)
  values (v_self, p_target, 'blocked', now())
  on conflict (requester_id, addressee_id)
  do update set status = 'blocked', responded_at = now();

  update public.study_buddies
  set status = 'ended'
  where status = 'active'
    and user_a = v_a and user_b = v_b;

  return jsonb_build_object('status', 'blocked');
end;
$$;

grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;

-- ============================================================================
-- 5. Study buddy RPCs (friendship required; one active buddy; RPC-only writes)
-- ============================================================================

create or replace function public.get_study_buddy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_buddy_id uuid;
  v_row record;
begin
  if v_self is null then return null; end if;

  select b.user_a, b.user_b, b.status, b.created_at
    into v_row
  from public.study_buddies b
  where b.status = 'active'
    and (b.user_a = v_self or b.user_b = v_self)
  limit 1;

  if not found then return null; end if;

  v_buddy_id := case when v_row.user_a = v_self then v_row.user_b else v_row.user_a end;

  return (
    select jsonb_build_object(
      'buddyId', p.id,
      'username', p.username,
      'publicUid', p.public_uid,
      'displayName', coalesce(p.display_name, p.name, 'Student'),
      'avatarId', up.avatar_id,
      'frameId', up.frame_id,
      'level', coalesce(x.level, 1),
      'prestige', coalesce(x.prestige, 0),
      'currentStreak', coalesce(s.current_streak, 0),
      'status', v_row.status,
      'pairedSince', v_row.created_at
    )
    from public.profiles p
    left join public.user_profiles up on up.user_id = p.id
    left join public.user_xp x on x.user_id = p.id
    left join public.streaks s on s.user_id = p.id
    where p.id = v_buddy_id
  );
end;
$$;

create or replace function public.pair_study_buddy(p_buddy uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_buddy_name text;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_self = p_buddy then raise exception 'You cannot pair with yourself.'; end if;

  if not exists (select 1 from public.profiles where id = p_buddy) then
    raise exception 'User not found.';
  end if;

  v_a := least(v_self, p_buddy);
  v_b := greatest(v_self, p_buddy);

  if not exists (
    select 1 from public.friends f where f.user_a = v_a and f.user_b = v_b
  ) then
    raise exception 'You must be friends before becoming study buddies.';
  end if;

  if public.get_user_relationship(v_self, p_buddy) = 'blocked' then
    raise exception 'Unable to pair with this user.';
  end if;

  -- End any existing active buddy for either participant.
  update public.study_buddies
  set status = 'ended'
  where status = 'active'
    and (user_a = v_self or user_b = v_self or user_a = p_buddy or user_b = p_buddy);

  insert into public.study_buddies (user_a, user_b, status, created_at)
  values (v_a, v_b, 'active', now())
  on conflict (user_a, user_b)
  do update set status = 'active', created_at = now();

  select coalesce(display_name, name, 'Study buddy')
    into v_buddy_name
  from public.profiles where id = p_buddy;

  insert into public.activity_events (actor_id, verb, object_type, object_id, metadata)
  values (
    v_self, 'buddy_paired', 'user', p_buddy::text,
    jsonb_build_object('buddyName', v_buddy_name)
  );

  insert into public.notifications (user_id, type, payload)
  values (
    p_buddy, 'buddy_paired',
    jsonb_build_object(
      'userId', v_self,
      'displayName', (select coalesce(display_name, name, 'Someone') from public.profiles where id = v_self)
    )
  );

  return jsonb_build_object('status', 'active', 'buddyId', p_buddy);
end;
$$;

create or replace function public.unpair_study_buddy()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  update public.study_buddies
  set status = 'ended'
  where status = 'active'
    and (user_a = v_self or user_b = v_self);

  if not found then
    raise exception 'No active study buddy.';
  end if;

  return jsonb_build_object('status', 'ended');
end;
$$;

grant execute on function public.get_study_buddy() to authenticated;
grant execute on function public.pair_study_buddy(uuid) to authenticated;
grant execute on function public.unpair_study_buddy() to authenticated;

-- Restrict direct client writes on study_buddies; mutations via RPC only.
drop policy if exists study_buddies_insert on public.study_buddies;
drop policy if exists study_buddies_update on public.study_buddies;
drop policy if exists study_buddies_delete on public.study_buddies;

-- ============================================================================
-- 6. Richer notification payloads (display names + usernames)
-- ============================================================================

create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester jsonb;
  v_addressee jsonb;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select jsonb_build_object(
      'userId', p.id,
      'displayName', coalesce(p.display_name, p.name, 'Someone'),
      'username', p.username,
      'publicUid', p.public_uid
    )
    into v_requester
    from public.profiles p where p.id = new.requester_id;

    insert into public.notifications (user_id, type, payload)
    values (new.addressee_id, 'friend_request',
      v_requester || jsonb_build_object('requestId', new.id, 'requesterId', new.requester_id));

  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    select jsonb_build_object(
      'userId', p.id,
      'displayName', coalesce(p.display_name, p.name, 'Someone'),
      'username', p.username,
      'publicUid', p.public_uid
    )
    into v_addressee
    from public.profiles p where p.id = new.addressee_id;

    insert into public.notifications (user_id, type, payload)
    values (new.requester_id, 'friend_request_accepted', v_addressee);

    insert into public.activity_events (actor_id, verb, object_type, object_id, metadata)
    values (
      new.addressee_id,
      'friend_request_accepted',
      'user',
      new.requester_id::text,
      jsonb_build_object(
        'friendName', (select coalesce(display_name, name, 'Someone') from public.profiles where id = new.requester_id)
      )
    );
  end if;
  return new;
end;
$$;

-- Notify buddy when they study (once per UTC day).
create or replace function public.notify_buddy_studied()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buddy_id uuid;
  v_actor_name text;
begin
  if new.focus_ms <= 0 then return new; end if;

  select case when b.user_a = new.user_id then b.user_b else b.user_a end
    into v_buddy_id
  from public.study_buddies b
  where b.status = 'active'
    and (b.user_a = new.user_id or b.user_b = new.user_id)
  limit 1;

  if v_buddy_id is null then return new; end if;

  -- Skip if buddy already notified today for this pair.
  if exists (
    select 1 from public.notifications n
    where n.user_id = v_buddy_id
      and n.type = 'buddy_studied'
      and n.payload->>'userId' = new.user_id::text
      and (n.created_at at time zone 'utc')::date = (timezone('utc', now()))::date
  ) then
    return new;
  end if;

  select coalesce(display_name, name, 'Your study buddy')
    into v_actor_name
  from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_buddy_id, 'buddy_studied',
    jsonb_build_object('userId', new.user_id, 'displayName', v_actor_name)
  );

  return new;
end;
$$;

drop trigger if exists on_study_session_buddy_notify on public.study_sessions;
create trigger on_study_session_buddy_notify
  after insert on public.study_sessions
  for each row execute function public.notify_buddy_studied();

-- ============================================================================
-- 7. Realtime for friend graph (optional publication)
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.friend_requests;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.friends;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.study_buddies;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

