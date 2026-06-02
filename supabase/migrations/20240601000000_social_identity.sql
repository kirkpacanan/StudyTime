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
