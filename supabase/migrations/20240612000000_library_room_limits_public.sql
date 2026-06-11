-- Library room participant cap (2–60) + public room discovery/join.

-- Clamp any existing rows before adding the constraint.
UPDATE public.focus_hub_rooms
SET participant_limit = LEAST(60, GREATEST(2, participant_limit))
WHERE participant_limit < 2 OR participant_limit > 60;

ALTER TABLE public.focus_hub_rooms
  DROP CONSTRAINT IF EXISTS focus_hub_rooms_participant_limit_check;

ALTER TABLE public.focus_hub_rooms
  ADD CONSTRAINT focus_hub_rooms_participant_limit_check
  CHECK (participant_limit >= 2 AND participant_limit <= 60);

-- Create room: clamp participant limit server-side.
CREATE OR REPLACE FUNCTION public.create_focus_hub_room(
  p_name              TEXT,
  p_description       TEXT DEFAULT NULL,
  p_category          TEXT DEFAULT NULL,
  p_participant_limit INTEGER DEFAULT 50,
  p_is_private        BOOLEAN DEFAULT false
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
BEGIN
  v_limit := LEAST(60, GREATEST(2, COALESCE(p_participant_limit, 50)));

  LOOP
    v_code := generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.focus_hub_rooms WHERE join_code = v_code);
  END LOOP;

  INSERT INTO public.focus_hub_rooms (
    created_by, name, description, category, join_code, participant_limit, is_private
  )
  VALUES (
    auth.uid(), p_name, p_description, p_category, v_code, v_limit, COALESCE(p_is_private, false)
  )
  RETURNING * INTO v_room;

  INSERT INTO public.focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'host');

  RETURN v_room;
END;
$$;

-- Public rooms are browsable by any signed-in user (listing only; join_code not required in lobby).
CREATE POLICY "rooms_select_public"
  ON public.focus_hub_rooms FOR SELECT
  TO authenticated
  USING (
    is_private = false
    AND archived_at IS NULL
  );

-- List public rooms the user is not already a member of.
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
  WHERE r.is_private = false
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

-- Join a public room by id (no code required).
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
    AND is_private = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public room not found.';
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

GRANT EXECUTE ON FUNCTION public.list_public_library_rooms() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_public_library_room(UUID) TO authenticated;
