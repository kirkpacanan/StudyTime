-- Activity rooms: invite/code-only, separate from browsable public study rooms.

ALTER TABLE public.focus_hub_rooms
  ADD COLUMN IF NOT EXISTS room_type TEXT NOT NULL DEFAULT 'activity';

ALTER TABLE public.focus_hub_rooms
  DROP CONSTRAINT IF EXISTS focus_hub_rooms_room_type_check;

ALTER TABLE public.focus_hub_rooms
  ADD CONSTRAINT focus_hub_rooms_room_type_check
  CHECK (room_type IN ('public_study', 'activity'));

-- Activity rooms are never listed in the public lobby.
UPDATE public.focus_hub_rooms
SET room_type = 'activity', is_private = true
WHERE room_type IS NULL OR room_type = 'activity';

-- ── Email invites (activity rooms only) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.room_email_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.focus_hub_rooms(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (room_id, email)
);

CREATE INDEX IF NOT EXISTS idx_room_email_invites_email
  ON public.room_email_invites (lower(email), status);

ALTER TABLE public.room_email_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_email_invites_select_host
  ON public.room_email_invites FOR SELECT
  TO authenticated
  USING (public.is_focus_hub_host(room_id));

CREATE POLICY room_email_invites_insert_host
  ON public.room_email_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_focus_hub_host(room_id)
    AND invited_by = auth.uid()
  );

CREATE POLICY room_email_invites_update_host
  ON public.room_email_invites FOR UPDATE
  TO authenticated
  USING (public.is_focus_hub_host(room_id));

-- ── Create room: activity by default (invite/code only) ───────────────────────

DROP FUNCTION IF EXISTS public.create_focus_hub_room(TEXT, TEXT, TEXT, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.create_focus_hub_room(
  p_name              TEXT,
  p_description       TEXT DEFAULT NULL,
  p_category          TEXT DEFAULT NULL,
  p_participant_limit INTEGER DEFAULT 50,
  p_room_type         TEXT DEFAULT 'activity'
)
RETURNS public.focus_hub_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_room public.focus_hub_rooms;
  v_limit INTEGER;
  v_type TEXT;
BEGIN
  v_limit := LEAST(60, GREATEST(2, COALESCE(p_participant_limit, 50)));
  v_type := COALESCE(NULLIF(trim(p_room_type), ''), 'activity');
  IF v_type NOT IN ('public_study', 'activity') THEN
    RAISE EXCEPTION 'Invalid room type';
  END IF;

  LOOP
    v_code := generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.focus_hub_rooms WHERE join_code = v_code);
  END LOOP;

  INSERT INTO public.focus_hub_rooms (
    created_by, name, description, category, join_code, participant_limit, is_private, room_type
  )
  VALUES (
    auth.uid(),
    p_name,
    p_description,
    p_category,
    v_code,
    v_limit,
    CASE WHEN v_type = 'activity' THEN true ELSE false END,
    v_type
  )
  RETURNING * INTO v_room;

  INSERT INTO public.focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'host');

  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_focus_hub_room(TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;

-- Public lobby: only public study rooms.
DROP POLICY IF EXISTS "rooms_select_public" ON public.focus_hub_rooms;

CREATE POLICY "rooms_select_public"
  ON public.focus_hub_rooms FOR SELECT
  TO authenticated
  USING (
    room_type = 'public_study'
    AND is_private = false
    AND archived_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.list_public_library_rooms()
RETURNS TABLE (
  id                 UUID,
  name               TEXT,
  description        TEXT,
  category           TEXT,
  participant_limit  INTEGER,
  member_count       BIGINT,
  created_at         TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.name,
    r.description,
    r.category,
    r.participant_limit,
    COUNT(m.user_id) AS member_count,
    r.created_at
  FROM public.focus_hub_rooms r
  LEFT JOIN public.focus_hub_memberships m ON m.room_id = r.id
  WHERE r.room_type = 'public_study'
    AND r.is_private = false
    AND r.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.focus_hub_memberships mine
      WHERE mine.room_id = r.id
        AND mine.user_id = auth.uid()
    )
  GROUP BY r.id
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.join_public_library_room(p_room_id UUID)
RETURNS public.focus_hub_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.focus_hub_rooms;
  v_count INT;
BEGIN
  SELECT * INTO v_room
  FROM public.focus_hub_rooms
  WHERE id = p_room_id
    AND archived_at IS NULL
    AND room_type = 'public_study'
    AND is_private = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public study room not found.';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.focus_hub_memberships
  WHERE room_id = v_room.id;

  IF v_count >= v_room.participant_limit THEN
    RAISE EXCEPTION 'Room is full.';
  END IF;

  INSERT INTO public.focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'participant')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room;
END;
$$;

-- Join activity room by code only.
CREATE OR REPLACE FUNCTION public.join_focus_hub_room(p_join_code TEXT)
RETURNS public.focus_hub_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.focus_hub_rooms;
  v_count INT;
BEGIN
  SELECT * INTO v_room FROM public.focus_hub_rooms
  WHERE join_code = upper(trim(p_join_code))
    AND archived_at IS NULL
    AND room_type = 'activity';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity room not found or has been archived.';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.focus_hub_memberships
  WHERE room_id = v_room.id;

  IF v_count >= v_room.participant_limit THEN
    RAISE EXCEPTION 'Room is full.';
  END IF;

  INSERT INTO public.focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'participant')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room;
END;
$$;

-- ── Email invite RPCs ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_to_activity_room(
  p_room_id UUID,
  p_email   TEXT
)
RETURNS public.room_email_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.focus_hub_rooms;
  v_invite public.room_email_invites;
  v_email TEXT;
BEGIN
  IF NOT public.is_focus_hub_host(p_room_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_room FROM public.focus_hub_rooms WHERE id = p_room_id;
  IF NOT FOUND OR v_room.room_type <> 'activity' THEN
    RAISE EXCEPTION 'Not an activity room';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  INSERT INTO public.room_email_invites (room_id, email, invited_by, status)
  VALUES (p_room_id, v_email, auth.uid(), 'pending')
  ON CONFLICT (room_id, email) DO UPDATE
    SET status = 'pending',
        invited_by = auth.uid(),
        created_at = now(),
        accepted_at = NULL
  RETURNING * INTO v_invite;

  RETURN v_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_to_activity_room(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_room_email_invites(p_room_id UUID)
RETURNS TABLE (
  id          UUID,
  email       TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_focus_hub_host(p_room_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT i.id, i.email, i.status, i.created_at, i.accepted_at
  FROM public.room_email_invites i
  WHERE i.room_id = p_room_id
  ORDER BY i.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_email_invites(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_activity_room_invites()
RETURNS TABLE (
  room_id      UUID,
  room_name    TEXT,
  invite_id    UUID,
  invited_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT lower(trim(email)) INTO v_email
  FROM auth.users WHERE id = auth.uid();

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id AS room_id,
    r.name AS room_name,
    i.id AS invite_id,
    i.created_at AS invited_at
  FROM public.room_email_invites i
  JOIN public.focus_hub_rooms r ON r.id = i.room_id
  WHERE lower(i.email) = v_email
    AND i.status = 'pending'
    AND r.archived_at IS NULL
    AND r.room_type = 'activity'
    AND NOT EXISTS (
      SELECT 1 FROM public.focus_hub_memberships m
      WHERE m.room_id = r.id AND m.user_id = auth.uid()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_activity_room_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_pending_activity_room_invite(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT lower(trim(email)) INTO v_email
  FROM auth.users WHERE id = auth.uid();

  RETURN EXISTS (
    SELECT 1 FROM public.room_email_invites i
    WHERE i.room_id = p_room_id
      AND lower(i.email) = v_email
      AND i.status = 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_pending_activity_room_invite(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_activity_room_invite(p_room_id UUID)
RETURNS public.focus_hub_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.focus_hub_rooms;
  v_email TEXT;
  v_count INT;
BEGIN
  SELECT lower(trim(email)) INTO v_email
  FROM auth.users WHERE id = auth.uid();

  IF NOT public.has_pending_activity_room_invite(p_room_id) THEN
    RAISE EXCEPTION 'No pending invite for this room';
  END IF;

  SELECT * INTO v_room FROM public.focus_hub_rooms
  WHERE id = p_room_id AND room_type = 'activity' AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity room not found';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.focus_hub_memberships
  WHERE room_id = v_room.id;

  IF v_count >= v_room.participant_limit THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  UPDATE public.room_email_invites
  SET status = 'accepted', accepted_at = now()
  WHERE room_id = p_room_id AND lower(email) = v_email;

  INSERT INTO public.focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'participant')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_activity_room_invite(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_room_email_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id UUID;
BEGIN
  SELECT room_id INTO v_room_id FROM public.room_email_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT public.is_focus_hub_host(v_room_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.room_email_invites
  SET status = 'revoked'
  WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_room_email_invite(UUID) TO authenticated;
