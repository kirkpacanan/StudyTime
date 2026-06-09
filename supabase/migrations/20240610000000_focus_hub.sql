-- ============================================================
-- Focus Hub: rooms, memberships, activities, sessions
-- ============================================================

-- ── Rooms ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS focus_hub_rooms (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  category         TEXT,
  image_url        TEXT,
  join_code        TEXT        NOT NULL UNIQUE,
  participant_limit INTEGER     NOT NULL DEFAULT 50,
  is_private       BOOLEAN     NOT NULL DEFAULT false,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Memberships ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS focus_hub_memberships (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID        NOT NULL REFERENCES focus_hub_rooms(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT        NOT NULL CHECK (role IN ('host', 'participant')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

-- ── Activities ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS focus_hub_activities (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID        NOT NULL REFERENCES focus_hub_rooms(id) ON DELETE CASCADE,
  created_by       UUID        NOT NULL REFERENCES profiles(id),
  title            TEXT        NOT NULL,
  description      TEXT,
  instructions     TEXT,
  activity_type    TEXT        NOT NULL CHECK (activity_type IN (
                     'study_session', 'assignment', 'quiz', 'training', 'meeting'
                   )),
  due_at           TIMESTAMPTZ,
  duration_minutes INTEGER,
  focus_required   BOOLEAN     NOT NULL DEFAULT true,
  status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'active', 'completed')),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Per-participant focus sessions ───────────────────────────

CREATE TABLE IF NOT EXISTS focus_hub_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   UUID        NOT NULL REFERENCES focus_hub_activities(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  average_focus INTEGER,
  samples       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  flagged       BOOLEAN     NOT NULL DEFAULT false,
  submitted     BOOLEAN     NOT NULL DEFAULT false,
  UNIQUE (activity_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fhr_created_by    ON focus_hub_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_fhm_room_user     ON focus_hub_memberships(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_fhm_user_id       ON focus_hub_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_fha_room_id       ON focus_hub_activities(room_id);
CREATE INDEX IF NOT EXISTS idx_fha_status        ON focus_hub_activities(status);
CREATE INDEX IF NOT EXISTS idx_fhs_activity_user ON focus_hub_sessions(activity_id, user_id);
CREATE INDEX IF NOT EXISTS idx_fhs_user_id       ON focus_hub_sessions(user_id);

-- ── RLS helpers (SECURITY DEFINER avoids cross-table policy recursion) ──

CREATE OR REPLACE FUNCTION public.is_focus_hub_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.focus_hub_memberships
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_focus_hub_host(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.focus_hub_rooms
    WHERE id = p_room_id
      AND created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_focus_hub_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_focus_hub_host(uuid) TO authenticated;

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE focus_hub_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_hub_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_hub_activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_hub_sessions     ENABLE ROW LEVEL SECURITY;

-- Rooms: visible to members; writable by hosts
CREATE POLICY "rooms_select_member"
  ON focus_hub_rooms FOR SELECT
  USING (created_by = auth.uid() OR public.is_focus_hub_member(id));

CREATE POLICY "rooms_insert_auth"
  ON focus_hub_rooms FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "rooms_update_host"
  ON focus_hub_rooms FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "rooms_delete_host"
  ON focus_hub_rooms FOR DELETE
  USING (created_by = auth.uid());

-- Memberships: users see their own + host sees room's
CREATE POLICY "memberships_select"
  ON focus_hub_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_focus_hub_host(room_id));

CREATE POLICY "memberships_insert_self"
  ON focus_hub_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "memberships_delete_host_or_self"
  ON focus_hub_memberships FOR DELETE
  USING (user_id = auth.uid() OR public.is_focus_hub_host(room_id));

-- Activities: visible to members; writable by host
CREATE POLICY "activities_select_member"
  ON focus_hub_activities FOR SELECT
  USING (public.is_focus_hub_member(room_id));

CREATE POLICY "activities_insert_host"
  ON focus_hub_activities FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_focus_hub_host(room_id)
  );

CREATE POLICY "activities_update_host"
  ON focus_hub_activities FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "activities_delete_host"
  ON focus_hub_activities FOR DELETE
  USING (created_by = auth.uid());

-- Sessions: own sessions + host can read room sessions
CREATE POLICY "sessions_select"
  ON focus_hub_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.focus_hub_activities a
      WHERE a.id = activity_id
        AND public.is_focus_hub_host(a.room_id)
    )
  );

CREATE POLICY "sessions_insert_self"
  ON focus_hub_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_update_self"
  ON focus_hub_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- ── RPCs ─────────────────────────────────────────────────────

-- Generate a 6-char alphanumeric join code
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Create a room and automatically add creator as host
CREATE OR REPLACE FUNCTION create_focus_hub_room(
  p_name             TEXT,
  p_description      TEXT DEFAULT NULL,
  p_category         TEXT DEFAULT NULL,
  p_participant_limit INTEGER DEFAULT 50,
  p_is_private       BOOLEAN DEFAULT false
)
RETURNS focus_hub_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_room focus_hub_rooms;
BEGIN
  -- Ensure unique join code
  LOOP
    v_code := generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM focus_hub_rooms WHERE join_code = v_code);
  END LOOP;

  INSERT INTO focus_hub_rooms (created_by, name, description, category,
                               join_code, participant_limit, is_private)
  VALUES (auth.uid(), p_name, p_description, p_category,
          v_code, p_participant_limit, p_is_private)
  RETURNING * INTO v_room;

  INSERT INTO focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'host');

  RETURN v_room;
END;
$$;

-- Join a room using the join code
CREATE OR REPLACE FUNCTION join_focus_hub_room(p_join_code TEXT)
RETURNS focus_hub_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room focus_hub_rooms;
  v_count INT;
BEGIN
  SELECT * INTO v_room FROM focus_hub_rooms
  WHERE join_code = upper(trim(p_join_code))
    AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or has been archived.';
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_count FROM focus_hub_memberships
  WHERE room_id = v_room.id;

  IF v_count >= v_room.participant_limit THEN
    RAISE EXCEPTION 'Room is full.';
  END IF;

  -- Idempotent upsert — ignore if already a member
  INSERT INTO focus_hub_memberships (room_id, user_id, role)
  VALUES (v_room.id, auth.uid(), 'participant')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room;
END;
$$;

-- Start an activity (host only)
CREATE OR REPLACE FUNCTION start_focus_hub_activity(p_activity_id UUID)
RETURNS focus_hub_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity focus_hub_activities;
BEGIN
  -- Verify caller is host
  SELECT a.* INTO v_activity
    FROM focus_hub_activities a
    JOIN focus_hub_memberships m ON m.room_id = a.room_id
   WHERE a.id = p_activity_id
     AND m.user_id = auth.uid()
     AND m.role = 'host';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized or activity not found.';
  END IF;

  UPDATE focus_hub_activities
     SET status = 'active', started_at = now()
   WHERE id = p_activity_id
  RETURNING * INTO v_activity;

  -- Notify all room participants
  INSERT INTO notifications (user_id, type, payload)
  SELECT m.user_id,
         'focus_hub_activity_started',
         jsonb_build_object(
           'activity_id',    p_activity_id,
           'activity_title', v_activity.title,
           'room_id',        v_activity.room_id
         )
    FROM focus_hub_memberships m
   WHERE m.room_id = v_activity.room_id
     AND m.user_id != auth.uid();

  RETURN v_activity;
END;
$$;

-- End an activity and aggregate analytics (host only)
CREATE OR REPLACE FUNCTION end_focus_hub_activity(p_activity_id UUID)
RETURNS focus_hub_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity focus_hub_activities;
BEGIN
  SELECT a.* INTO v_activity
    FROM focus_hub_activities a
    JOIN focus_hub_memberships m ON m.room_id = a.room_id
   WHERE a.id = p_activity_id
     AND m.user_id = auth.uid()
     AND m.role = 'host';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized or activity not found.';
  END IF;

  -- Close any open participant sessions
  UPDATE focus_hub_sessions
     SET ended_at = now()
   WHERE activity_id = p_activity_id AND ended_at IS NULL;

  UPDATE focus_hub_activities
     SET status = 'completed', ended_at = now()
   WHERE id = p_activity_id
  RETURNING * INTO v_activity;

  -- Notify participants activity is complete
  INSERT INTO notifications (user_id, type, payload)
  SELECT m.user_id,
         'focus_hub_activity_completed',
         jsonb_build_object(
           'activity_id',    p_activity_id,
           'activity_title', v_activity.title,
           'room_id',        v_activity.room_id
         )
    FROM focus_hub_memberships m
   WHERE m.room_id = v_activity.room_id
     AND m.user_id != auth.uid();

  RETURN v_activity;
END;
$$;

-- Analytics: per-session stats aggregated per activity for a room
CREATE OR REPLACE FUNCTION get_focus_hub_room_analytics(p_room_id UUID)
RETURNS TABLE (
  activity_id       UUID,
  activity_title    TEXT,
  activity_type     TEXT,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  participant_count BIGINT,
  avg_focus         NUMERIC,
  max_focus         INTEGER,
  min_focus         INTEGER,
  flagged_count     BIGINT,
  submitted_count   BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.title,
    a.activity_type,
    a.started_at,
    a.ended_at,
    COUNT(s.id),
    ROUND(AVG(s.average_focus), 1),
    MAX(s.average_focus),
    MIN(s.average_focus),
    COUNT(s.id) FILTER (WHERE s.flagged),
    COUNT(s.id) FILTER (WHERE s.submitted)
  FROM focus_hub_activities a
  LEFT JOIN focus_hub_sessions s ON s.activity_id = a.id
  WHERE a.room_id = p_room_id
    AND EXISTS (
      SELECT 1 FROM focus_hub_memberships m
      WHERE m.room_id = p_room_id AND m.user_id = auth.uid()
    )
  GROUP BY a.id, a.title, a.activity_type, a.started_at, a.ended_at
  ORDER BY a.created_at DESC;
$$;

-- Grant RPC access to authenticated users
GRANT EXECUTE ON FUNCTION public.create_focus_hub_room(TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_focus_hub_room(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_focus_hub_activity(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_focus_hub_activity(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_focus_hub_room_analytics(UUID) TO authenticated;

-- Enable Realtime for live focus monitor
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_hub_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
