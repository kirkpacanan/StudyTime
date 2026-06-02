-- ============================================================================
-- StudyTime: APPLY ALL SOCIAL MIGRATIONS (one-shot for hosted Supabase)
-- ============================================================================
-- Run in Supabase SQL Editor if MCP is unavailable.
-- Prefer: npm run check:social to verify RPCs after apply.
-- Note: remove_friend/block_user use jsonb returns; repair section drops before recreate.
-- ============================================================================

-- StudyTime: Social identity + public profiles.
-- Adds usernames, short public UIDs, and privacy settings to public.profiles,
-- routes all cross-user profile reads through SECURITY DEFINER RPCs, and
-- generates a short public_uid on signup.
--
-- Run order: after 20240513000000_gamification.sql.

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ============================================================================
-- 1. Identity + privacy columns on profiles
-- ============================================================================

alter table public.profiles
  add column if not exists username citext,
  add column if not exists public_uid text,
  add column if not exists display_name text,
  add column if not exists profile_visibility text not null default 'friends',
  add column if not exists show_on_leaderboard boolean not null default true,
  add column if not exists allow_friend_requests boolean not null default true,
  add column if not exists show_study_status boolean not null default true,
  add column if not exists show_activity_feed boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_visibility_check'
  ) then
    alter table public.profiles
      add constraint profiles_visibility_check
      check (profile_visibility in ('public', 'friends', 'private'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,24}$');
  end if;
end $$;

create unique index if not exists profiles_username_key on public.profiles (username);
create unique index if not exists profiles_public_uid_key on public.profiles (public_uid);
create index if not exists profiles_username_trgm
  on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_name_trgm
  on public.profiles using gin (display_name gin_trgm_ops);

-- ============================================================================
-- 2. Short public UID generator (Crockford base32, prefix ST-)
-- ============================================================================

create or replace function public.generate_public_uid()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i integer;
  exists_already boolean;
begin
  loop
    candidate := 'ST-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select exists(select 1 from public.profiles where public_uid = candidate)
      into exists_already;
    exit when not exists_already;
  end loop;
  return candidate;
end;
$$;

-- ============================================================================
-- 3. Backfill existing rows
-- ============================================================================

update public.profiles
set public_uid = public.generate_public_uid()
where public_uid is null;

update public.profiles
set display_name = coalesce(nullif(trim(display_name), ''), nullif(trim(name), ''), 'Student')
where display_name is null or trim(display_name) = '';

-- Now that every row has a value, enforce integrity + auto-fill on direct inserts.
alter table public.profiles
  alter column public_uid set default public.generate_public_uid();
alter table public.profiles
  alter column public_uid set not null;

-- ============================================================================
-- 4. Signup trigger extension (assign public_uid + display_name)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  set row_security = off;
  insert into public.profiles (id, email, name, display_name, public_uid)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Student'),
    coalesce(new.raw_user_meta_data->>'name', 'Student'),
    public.generate_public_uid()
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

-- ============================================================================
-- 5. Self profile RPCs
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

-- Update display name + username (validates format + uniqueness).
create or replace function public.update_profile(
  p_display_name text default null,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username citext;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_username is not null then
    v_username := lower(trim(p_username));
    if v_username !~ '^[a-z0-9_]{3,24}$' then
      raise exception 'Username must be 3-24 chars: letters, numbers, underscore.';
    end if;
    if exists (
      select 1 from public.profiles
      where username = v_username and id <> auth.uid()
    ) then
      raise exception 'That username is taken.';
    end if;
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    username = coalesce(v_username, username),
    updated_at = now()
  where id = auth.uid();

  return public.get_my_profile();
end;
$$;

create or replace function public.update_privacy_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    profile_visibility = coalesce(
      nullif(p_settings->>'profileVisibility', ''), profile_visibility
    ),
    show_on_leaderboard = coalesce(
      (p_settings->>'showOnLeaderboard')::boolean, show_on_leaderboard
    ),
    allow_friend_requests = coalesce(
      (p_settings->>'allowFriendRequests')::boolean, allow_friend_requests
    ),
    show_study_status = coalesce(
      (p_settings->>'showStudyStatus')::boolean, show_study_status
    ),
    show_activity_feed = coalesce(
      (p_settings->>'showActivityFeed')::boolean, show_activity_feed
    ),
    updated_at = now()
  where id = auth.uid();

  return public.get_my_profile();
end;
$$;

-- ============================================================================
-- 6. Cross-user read RPCs (column allowlist; no email leak)
-- ============================================================================

-- Minimal display info for a user id (used by buddy/friend name resolution).
create or replace function public.resolve_user_display(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'userId', p.id,
    'username', p.username,
    'publicUid', p.public_uid,
    'displayName', coalesce(p.display_name, p.name, 'Student'),
    'avatarId', up.avatar_id,
    'frameId', up.frame_id,
    'level', coalesce(x.level, 1),
    'prestige', coalesce(x.prestige, 0)
  )
  from public.profiles p
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id
  where p.id = p_user_id;
$$;

-- Full public profile card. Resolves by id, username, or public_uid.
-- Enforces visibility: 'private' hides everything but identity;
-- 'friends' requires an accepted friendship (table created in a later
-- migration; this function tolerates its absence).
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
  v_friends_table_exists boolean;
  v_card jsonb;
  v_stats jsonb;
  v_relationship text := 'none';
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

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'friends'
  ) into v_friends_table_exists;

  if v_friends_table_exists and v_self is not null then
    execute
      'select exists(select 1 from public.friends f where '
      || 'f.user_a = $1 and f.user_b = $2)'
    into v_is_friend
    using least(v_self, v_id), greatest(v_self, v_id);
  end if;

  if v_self = v_id then
    v_relationship := 'self';
  elsif v_is_friend then
    v_relationship := 'friend';
  end if;

  -- Identity (always visible).
  select jsonb_build_object(
    'userId', p.id,
    'username', p.username,
    'publicUid', p.public_uid,
    'displayName', coalesce(p.display_name, p.name, 'Student'),
    'memberSince', p.created_at,
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

  -- Detailed stats only when allowed.
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

  v_card := v_card || jsonb_build_object('relationship', v_relationship);
  return v_card;
end;
$$;

-- User search by username, public_uid, or display name (prefix + trigram).
-- Excludes self, private profiles, and (when present) blocked users.
create or replace function public.search_users(p_query text, p_limit integer default 20)
returns table (
  user_id uuid,
  username citext,
  public_uid text,
  display_name text,
  avatar_id text,
  frame_id text,
  level integer
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
    coalesce(x.level, 1) as level
  from public.profiles p
  left join public.user_profiles up on up.user_id = p.id
  left join public.user_xp x on x.user_id = p.id, q
  where q.term <> ''
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and p.profile_visibility <> 'private'
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

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_profile(text, text) to authenticated;
grant execute on function public.update_privacy_settings(jsonb) to authenticated;
grant execute on function public.resolve_user_display(uuid) to authenticated;
grant execute on function public.get_public_profile(uuid, text, text) to authenticated;
grant execute on function public.search_users(text, integer) to authenticated;
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
-- StudyTime: Social system repair â€” relationships, study buddies, search, notifications.
-- Run order: after 20240601004000_scale.sql

drop function if exists public.search_users(text, integer);
drop function if exists public.remove_friend(uuid);
drop function if exists public.block_user(uuid);
drop function if exists public.cancel_friend_request(uuid);

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
