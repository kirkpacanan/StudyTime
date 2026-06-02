-- StudyTime: Friends + friend requests (parallel to study buddies).
-- friend_requests holds pending/declined/blocked edges; friends holds the
-- undirected accepted graph (user_a < user_b). All mutations go through
-- SECURITY DEFINER RPCs so RLS can stay strict.
--
-- Run order: after 20240601000000_social_identity.sql.

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friend_requests_addressee_pending_idx
  on public.friend_requests (addressee_id) where status = 'pending';
create index if not exists friend_requests_requester_idx
  on public.friend_requests (requester_id);

create table if not exists public.friends (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friends_user_b_idx on public.friends (user_b);

-- ============================================================================
-- 2. RLS (read own rows; writes via RPCs only)
-- ============================================================================

alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;

drop policy if exists friend_requests_select on public.friend_requests;
create policy friend_requests_select on public.friend_requests
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists friends_select on public.friends;
create policy friends_select on public.friends
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- ============================================================================
-- 3. RPCs
-- ============================================================================

create or replace function public.send_friend_request(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_allows boolean;
  v_a uuid;
  v_b uuid;
begin
  if v_self is null then raise exception 'Not authenticated'; end if;
  if v_self = p_target then raise exception 'You cannot friend yourself.'; end if;

  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'User not found.';
  end if;

  v_a := least(v_self, p_target);
  v_b := greatest(v_self, p_target);
  if exists (select 1 from public.friends where user_a = v_a and user_b = v_b) then
    return jsonb_build_object('status', 'friend');
  end if;

  -- Blocked check (either direction).
  if exists (
    select 1 from public.friend_requests
    where status = 'blocked'
      and ((requester_id = v_self and addressee_id = p_target)
        or (requester_id = p_target and addressee_id = v_self))
  ) then
    raise exception 'Unable to send request.';
  end if;

  select allow_friend_requests into v_allows from public.profiles where id = p_target;
  if not coalesce(v_allows, true) then
    raise exception 'This user is not accepting friend requests.';
  end if;

  -- If they already requested us, accept immediately.
  if exists (
    select 1 from public.friend_requests
    where requester_id = p_target and addressee_id = v_self and status = 'pending'
  ) then
    update public.friend_requests
    set status = 'accepted', responded_at = now()
    where requester_id = p_target and addressee_id = v_self;
    insert into public.friends (user_a, user_b) values (v_a, v_b)
    on conflict do nothing;
    return jsonb_build_object('status', 'accepted');
  end if;

  insert into public.friend_requests (requester_id, addressee_id, status)
  values (v_self, p_target, 'pending')
  on conflict (requester_id, addressee_id)
  do update set status = 'pending', created_at = now(), responded_at = null;

  return jsonb_build_object('status', 'pending');
end;
$$;

create or replace function public.respond_friend_request(
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
begin
  if v_self is null then raise exception 'Not authenticated'; end if;

  select * into v_req from public.friend_requests
  where id = p_request_id and addressee_id = v_self and status = 'pending';
  if not found then
    raise exception 'Request not found.';
  end if;

  if p_accept then
    update public.friend_requests
    set status = 'accepted', responded_at = now() where id = p_request_id;
    v_a := least(v_req.requester_id, v_req.addressee_id);
    v_b := greatest(v_req.requester_id, v_req.addressee_id);
    insert into public.friends (user_a, user_b) values (v_a, v_b)
    on conflict do nothing;
    return jsonb_build_object('status', 'accepted');
  else
    update public.friend_requests
    set status = 'declined', responded_at = now() where id = p_request_id;
    return jsonb_build_object('status', 'declined');
  end if;
end;
$$;

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

-- Note: list_friends() (which joins presence) is defined in the presence
-- migration so it can reference public.user_presence after it exists.

-- Pending requests: inbox (default) or outbox.
create or replace function public.list_friend_requests(p_inbox boolean default true)
returns table (
  request_id uuid,
  user_id uuid,
  username citext,
  public_uid text,
  display_name text,
  avatar_id text,
  frame_id text,
  level integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    other.id,
    other.username,
    other.public_uid,
    coalesce(other.display_name, other.name, 'Student'),
    up.avatar_id,
    up.frame_id,
    coalesce(x.level, 1),
    r.created_at
  from public.friend_requests r
  join public.profiles other
    on other.id = case when p_inbox then r.requester_id else r.addressee_id end
  left join public.user_profiles up on up.user_id = other.id
  left join public.user_xp x on x.user_id = other.id
  where r.status = 'pending'
    and (
      (p_inbox and r.addressee_id = auth.uid())
      or (not p_inbox and r.requester_id = auth.uid())
    )
  order by r.created_at desc;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.list_friend_requests(boolean) to authenticated;
