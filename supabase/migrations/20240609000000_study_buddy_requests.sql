-- Study Buddy request/approval flow with strict one-to-one active relationships.
-- Run after 20240608000000_library_rooms.sql

-- ============================================================================
-- 1. study_buddy_requests table
-- ============================================================================

create table if not exists public.study_buddy_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists study_buddy_requests_addressee_pending_idx
  on public.study_buddy_requests (addressee_id) where status = 'pending';

create index if not exists study_buddy_requests_requester_pending_idx
  on public.study_buddy_requests (requester_id) where status = 'pending';

alter table public.study_buddy_requests enable row level security;

drop policy if exists study_buddy_requests_select on public.study_buddy_requests;
create policy study_buddy_requests_select on public.study_buddy_requests
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ============================================================================
-- 2. Enforce one active study buddy per user (trigger — partial indexes are not enough)
-- ============================================================================

create or replace function public.user_has_active_buddy(p_user uuid)
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
      and (b.user_a = p_user or b.user_b = p_user)
  );
$$;

create or replace function public.enforce_one_active_study_buddy()
returns trigger
language plpgsql
as $$
declare
  v_user uuid;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  foreach v_user in array array[new.user_a, new.user_b] loop
    if exists (
      select 1
      from public.study_buddies b
      where b.status = 'active'
        and b.id is distinct from new.id
        and (b.user_a = v_user or b.user_b = v_user)
    ) then
      raise exception 'User already has an active study buddy.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists study_buddies_one_active on public.study_buddies;
create trigger study_buddies_one_active
  before insert or update on public.study_buddies
  for each row execute function public.enforce_one_active_study_buddy();

-- ============================================================================
-- 3. Profile payload helper
-- ============================================================================

create or replace function public.study_buddy_profile_payload(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'buddyId', p.id,
    'username', p.username,
    'publicUid', p.public_uid,
    'displayName', coalesce(p.display_name, p.name, 'Student'),
    'avatarId', up.avatar_id,
    'frameId', up.frame_id,
    'level', coalesce(x.level, 1),
    'prestige', coalesce(x.prestige, 0),
    'currentStreak', coalesce(s.current_streak, 0)
  )
  from public.profiles p
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id
  left join public.streaks s on s.user_id = p.id
  where p.id = p_user;
$$;

-- ============================================================================
-- 4. Study buddy RPCs
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
  v_req record;
begin
  if v_self is null then return null; end if;

  select b.user_a, b.user_b, b.status, b.created_at
    into v_row
  from public.study_buddies b
  where b.status = 'active'
    and (b.user_a = v_self or b.user_b = v_self)
  limit 1;

  if found then
    v_buddy_id := case when v_row.user_a = v_self then v_row.user_b else v_row.user_a end;
    return public.study_buddy_profile_payload(v_buddy_id)
      || jsonb_build_object(
        'status', 'active',
        'pairedSince', v_row.created_at
      );
  end if;

  select r.id, r.requester_id, r.addressee_id, r.created_at
    into v_req
  from public.study_buddy_requests r
  where r.status = 'pending'
    and (r.requester_id = v_self or r.addressee_id = v_self)
  order by r.created_at desc
  limit 1;

  if not found then return null; end if;

  if v_req.requester_id = v_self then
    return public.study_buddy_profile_payload(v_req.addressee_id)
      || jsonb_build_object(
        'status', 'pending_out',
        'requestId', v_req.id,
        'requestedAt', v_req.created_at
      );
  end if;

  return public.study_buddy_profile_payload(v_req.requester_id)
    || jsonb_build_object(
      'status', 'pending_in',
      'requestId', v_req.id,
      'requestedAt', v_req.created_at
    );
end;
$$;

create or replace function public.send_study_buddy_request(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_request_id uuid;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_self = p_target then raise exception 'You cannot send a study buddy request to yourself.'; end if;

  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'User not found.';
  end if;

  if public.user_has_active_buddy(v_self) then
    raise exception 'You already have an active study buddy. Remove your current buddy before sending a new request.';
  end if;

  if public.user_has_active_buddy(p_target) then
    raise exception 'This user already has an active study buddy.';
  end if;

  v_a := least(v_self, p_target);
  v_b := greatest(v_self, p_target);

  if not exists (
    select 1 from public.friends f where f.user_a = v_a and f.user_b = v_b
  ) then
    raise exception 'You must be friends before becoming study buddies.';
  end if;

  if public.get_user_relationship(v_self, p_target) = 'blocked' then
    raise exception 'Unable to send a study buddy request to this user.';
  end if;

  if exists (
    select 1 from public.study_buddy_requests r
    where r.status = 'pending'
      and (
        (r.requester_id = v_self and r.addressee_id = p_target)
        or (r.requester_id = p_target and r.addressee_id = v_self)
      )
  ) then
    raise exception 'A study buddy request is already pending between you and this user.';
  end if;

  if exists (
    select 1 from public.study_buddy_requests r
    where r.status = 'pending' and r.requester_id = v_self
  ) then
    raise exception 'You already have a pending study buddy request. Cancel it before sending another.';
  end if;

  insert into public.study_buddy_requests (requester_id, addressee_id, status)
  values (v_self, p_target, 'pending')
  on conflict (requester_id, addressee_id)
  do update set status = 'pending', created_at = now(), responded_at = null
  returning id into v_request_id;

  return jsonb_build_object('status', 'pending', 'requestId', v_request_id);
end;
$$;

create or replace function public.respond_study_buddy_request(
  p_request_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_req record;
  v_a uuid;
  v_b uuid;
  v_buddy_name text;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  select * into v_req
  from public.study_buddy_requests
  where id = p_request_id
    and addressee_id = v_self
    and status = 'pending';

  if not found then
    raise exception 'Request not found.';
  end if;

  if p_accept then
    if public.user_has_active_buddy(v_self) then
      raise exception 'You already have an active study buddy.';
    end if;

    if public.user_has_active_buddy(v_req.requester_id) then
      raise exception 'The requester already has an active study buddy.';
    end if;

    v_a := least(v_req.requester_id, v_req.addressee_id);
    v_b := greatest(v_req.requester_id, v_req.addressee_id);

    if not exists (
      select 1 from public.friends f where f.user_a = v_a and f.user_b = v_b
    ) then
      raise exception 'You must be friends before becoming study buddies.';
    end if;

    update public.study_buddy_requests
    set status = 'accepted', responded_at = now()
    where id = p_request_id;

    insert into public.study_buddies (user_a, user_b, status, created_at)
    values (v_a, v_b, 'active', now())
    on conflict (user_a, user_b)
    do update set status = 'active', created_at = now();

    update public.study_buddy_requests
    set status = 'declined', responded_at = now()
    where status = 'pending'
      and id <> p_request_id
      and (requester_id in (v_req.requester_id, v_req.addressee_id)
        or addressee_id in (v_req.requester_id, v_req.addressee_id));

    select coalesce(display_name, name, 'Study buddy')
      into v_buddy_name
    from public.profiles where id = v_req.requester_id;

    insert into public.activity_events (actor_id, verb, object_type, object_id, metadata)
    values (
      v_self, 'buddy_paired', 'user', v_req.requester_id::text,
      jsonb_build_object('buddyName', v_buddy_name)
    );

    return jsonb_build_object('status', 'accepted', 'buddyId', v_req.requester_id);
  end if;

  update public.study_buddy_requests
  set status = 'declined', responded_at = now()
  where id = p_request_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_req.requester_id,
    'buddy_request_declined',
    jsonb_build_object(
      'userId', v_self,
      'displayName', (select coalesce(display_name, name, 'Someone') from public.profiles where id = v_self),
      'username', (select username from public.profiles where id = v_self),
      'publicUid', (select public_uid from public.profiles where id = v_self),
      'requestId', p_request_id
    )
  );

  return jsonb_build_object('status', 'declined');
end;
$$;

create or replace function public.cancel_study_buddy_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_addressee uuid;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  update public.study_buddy_requests
  set status = 'declined', responded_at = now()
  where id = p_request_id
    and requester_id = v_self
    and status = 'pending'
  returning addressee_id into v_addressee;

  if not found then
    raise exception 'Request not found or already handled.';
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    v_addressee,
    'buddy_request_canceled',
    jsonb_build_object(
      'userId', v_self,
      'displayName', (select coalesce(display_name, name, 'Someone') from public.profiles where id = v_self),
      'username', (select username from public.profiles where id = v_self),
      'publicUid', (select public_uid from public.profiles where id = v_self),
      'requestId', p_request_id
    )
  );

  return jsonb_build_object('status', 'cancelled');
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
  v_row record;
  v_buddy_id uuid;
  v_self_name text;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  select b.user_a, b.user_b
    into v_row
  from public.study_buddies b
  where b.status = 'active'
    and (b.user_a = v_self or b.user_b = v_self)
  limit 1;

  if not found then
    raise exception 'No active study buddy.';
  end if;

  v_buddy_id := case when v_row.user_a = v_self then v_row.user_b else v_row.user_a end;

  update public.study_buddies
  set status = 'ended'
  where status = 'active'
    and user_a = v_row.user_a
    and user_b = v_row.user_b;

  select coalesce(display_name, name, 'Someone')
    into v_self_name
  from public.profiles where id = v_self;

  insert into public.notifications (user_id, type, payload)
  values
    (
      v_buddy_id,
      'buddy_removed',
      jsonb_build_object(
        'userId', v_self,
        'displayName', v_self_name,
        'username', (select username from public.profiles where id = v_self),
        'publicUid', (select public_uid from public.profiles where id = v_self)
      )
    ),
    (
      v_self,
      'buddy_removed',
      jsonb_build_object(
        'userId', v_buddy_id,
        'displayName', (select coalesce(display_name, name, 'Someone') from public.profiles where id = v_buddy_id),
        'username', (select username from public.profiles where id = v_buddy_id),
        'publicUid', (select public_uid from public.profiles where id = v_buddy_id)
      )
    );

  return jsonb_build_object('status', 'ended', 'buddyId', v_buddy_id);
end;
$$;

-- Backward-compatible alias: sending a request instead of instant pairing.
create or replace function public.pair_study_buddy(p_buddy uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.send_study_buddy_request(p_buddy);
end;
$$;

create or replace function public.list_study_buddy_requests(p_inbox boolean default true)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
begin
  if v_self is null then return; end if;

  return query
  select jsonb_build_object(
    'requestId', r.id,
    'userId', p.id,
    'username', p.username,
    'publicUid', p.public_uid,
    'displayName', coalesce(p.display_name, p.name, 'Student'),
    'avatarId', up.avatar_id,
    'frameId', up.frame_id,
    'level', coalesce(x.level, 1),
    'createdAt', r.created_at
  )
  from public.study_buddy_requests r
  join public.profiles p on p.id = case
    when p_inbox then r.requester_id
    else r.addressee_id
  end
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id
  where r.status = 'pending'
    and (
      (p_inbox and r.addressee_id = v_self)
      or (not p_inbox and r.requester_id = v_self)
    )
  order by r.created_at desc;
end;
$$;

grant execute on function public.user_has_active_buddy(uuid) to authenticated;
grant execute on function public.get_study_buddy() to authenticated;
grant execute on function public.send_study_buddy_request(uuid) to authenticated;
grant execute on function public.respond_study_buddy_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_study_buddy_request(uuid) to authenticated;
grant execute on function public.unpair_study_buddy() to authenticated;
grant execute on function public.pair_study_buddy(uuid) to authenticated;
grant execute on function public.list_study_buddy_requests(boolean) to authenticated;

-- ============================================================================
-- 5. Cancel pending buddy requests when friendship ends or user is blocked
-- ============================================================================

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

  delete from public.friend_requests
  where (requester_id = p_friend and addressee_id = v_self)
     or (requester_id = v_self and addressee_id = p_friend);

  update public.study_buddies
  set status = 'ended'
  where status = 'active'
    and user_a = v_a and user_b = v_b;

  update public.study_buddy_requests
  set status = 'declined', responded_at = now()
  where status = 'pending'
    and (
      (requester_id = v_self and addressee_id = p_friend)
      or (requester_id = p_friend and addressee_id = v_self)
    );

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

  update public.study_buddy_requests
  set status = 'declined', responded_at = now()
  where status = 'pending'
    and (
      (requester_id = v_self and addressee_id = p_target)
      or (requester_id = p_target and addressee_id = v_self)
    );

  return jsonb_build_object('status', 'blocked');
end;
$$;

-- ============================================================================
-- 6. Notifications for study buddy requests
-- ============================================================================

create or replace function public.notify_study_buddy_request()
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
    values (
      new.addressee_id,
      'buddy_request',
      v_requester || jsonb_build_object('requestId', new.id, 'requesterId', new.requester_id)
    );

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
    values (
      new.requester_id,
      'buddy_request_accepted',
      v_addressee || jsonb_build_object('buddyId', new.addressee_id)
    );

  end if;

  return new;
end;
$$;

drop trigger if exists on_study_buddy_request_change on public.study_buddy_requests;
create trigger on_study_buddy_request_change
  after insert or update on public.study_buddy_requests
  for each row execute function public.notify_study_buddy_request();

-- Realtime (optional)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'study_buddy_requests'
    ) then
      alter publication supabase_realtime add table public.study_buddy_requests;
    end if;
  end if;
end $$;
