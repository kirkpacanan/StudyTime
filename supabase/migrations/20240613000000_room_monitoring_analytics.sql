-- Room monitoring consent, session snapshots, and enhanced host analytics.

ALTER TABLE focus_hub_memberships
  ADD COLUMN IF NOT EXISTS monitoring_consent_at TIMESTAMPTZ;

-- ── Session monitoring snapshots (host-visible evidence frames) ───────────────

CREATE TABLE IF NOT EXISTS session_monitoring_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  room_id       UUID NOT NULL REFERENCES focus_hub_rooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (
    event_type IN ('session_start', 'phone_detected', 'off_screen', 'drift')
  ),
  session_t_ms  INTEGER NOT NULL DEFAULT 0,
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_monitoring_room_user
  ON session_monitoring_snapshots (room_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_monitoring_session
  ON session_monitoring_snapshots (session_id);

ALTER TABLE session_monitoring_snapshots ENABLE ROW LEVEL SECURITY;

-- Members insert their own snapshots (after consent).
CREATE POLICY session_monitoring_insert_own
  ON session_monitoring_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM focus_hub_memberships m
      WHERE m.room_id = session_monitoring_snapshots.room_id
        AND m.user_id = auth.uid()
        AND m.monitoring_consent_at IS NOT NULL
    )
  );

-- Host reads all snapshots for their room.
CREATE POLICY session_monitoring_select_host
  ON session_monitoring_snapshots FOR SELECT
  TO authenticated
  USING (public.is_focus_hub_host(room_id));

-- ── Storage bucket (private) ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-monitoring',
  'session-monitoring',
  false,
  524288,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Path: {room_id}/{user_id}/{filename}
CREATE POLICY session_monitoring_storage_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'session-monitoring'
    AND (storage.foldername(name))[2]::uuid = auth.uid()
    AND EXISTS (
      SELECT 1 FROM focus_hub_memberships m
      WHERE m.room_id = (storage.foldername(name))[1]::uuid
        AND m.user_id = auth.uid()
        AND m.monitoring_consent_at IS NOT NULL
    )
  );

CREATE POLICY session_monitoring_storage_select_host
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-monitoring'
    AND public.is_focus_hub_host((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY session_monitoring_storage_select_own
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-monitoring'
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

-- ── Consent RPC ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_room_monitoring_consent(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_focus_hub_member(p_room_id) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  UPDATE focus_hub_memberships
  SET monitoring_consent_at = COALESCE(monitoring_consent_at, now())
  WHERE room_id = p_room_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION accept_room_monitoring_consent(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION has_room_monitoring_consent(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent TIMESTAMPTZ;
  v_role TEXT;
BEGIN
  SELECT monitoring_consent_at, role
  INTO v_consent, v_role
  FROM focus_hub_memberships
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role = 'host' THEN
    RETURN true;
  END IF;

  RETURN v_consent IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION has_room_monitoring_consent(UUID) TO authenticated;

-- ── Enhanced per-member analytics (host-only, alphabetical) ─────────────────

DROP FUNCTION IF EXISTS get_library_room_analytics(UUID);

CREATE OR REPLACE FUNCTION get_library_room_analytics(p_room_id UUID)
RETURNS TABLE (
  user_id           UUID,
  user_name         TEXT,
  session_count     BIGINT,
  avg_focus         INTEGER,
  total_focus_ms    BIGINT,
  low_focus_count   BIGINT,
  phone_events      BIGINT,
  drift_events      BIGINT,
  off_screen_events BIGINT,
  last_session_at   TIMESTAMPTZ
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
  SELECT
    m.user_id,
    COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(p.display_name), ''), 'Student') AS user_name,
    COUNT(ss.id)::BIGINT AS session_count,
    COALESCE(ROUND(AVG(ss.average_focus)), 0)::INTEGER AS avg_focus,
    COALESCE(SUM(ss.focus_ms), 0)::BIGINT AS total_focus_ms,
    COUNT(*) FILTER (WHERE ss.average_focus < 50)::BIGINT AS low_focus_count,
    COALESCE(SUM((
      SELECT COUNT(*)::BIGINT
      FROM jsonb_array_elements(COALESCE(ss.events, '[]'::jsonb)) ev
      WHERE ev->>'type' = 'phone_detected'
    )), 0)::BIGINT AS phone_events,
    COALESCE(SUM((
      SELECT COUNT(*)::BIGINT
      FROM jsonb_array_elements(COALESCE(ss.events, '[]'::jsonb)) ev
      WHERE ev->>'type' IN ('look_away_long', 'drift')
    )), 0)::BIGINT AS drift_events,
    COALESCE(SUM((
      SELECT COUNT(*)::BIGINT
      FROM jsonb_array_elements(COALESCE(ss.events, '[]'::jsonb)) ev
      WHERE ev->>'type' = 'off_screen'
    )), 0)::BIGINT AS off_screen_events,
    MAX(ss.ended_at) AS last_session_at
  FROM focus_hub_memberships m
  LEFT JOIN profiles p ON p.id = m.user_id
  LEFT JOIN study_sessions ss
    ON ss.user_id = m.user_id AND ss.room_id = p_room_id
  WHERE m.room_id = p_room_id
  GROUP BY m.user_id, p.name, p.display_name
  ORDER BY user_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_library_room_analytics(UUID) TO authenticated;

-- Per-session breakdown for a member (host-only).
CREATE OR REPLACE FUNCTION get_library_room_member_sessions(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  session_id        UUID,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  average_focus     INTEGER,
  focus_ms          INTEGER,
  distraction_events INTEGER,
  phone_events      BIGINT,
  drift_events      BIGINT,
  off_screen_events BIGINT
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
  SELECT
    ss.id AS session_id,
    ss.started_at,
    ss.ended_at,
    ss.average_focus,
    ss.focus_ms,
    ss.distraction_events,
    (SELECT COUNT(*)::BIGINT FROM jsonb_array_elements(COALESCE(ss.events, '[]'::jsonb)) ev
     WHERE ev->>'type' = 'phone_detected') AS phone_events,
    (SELECT COUNT(*)::BIGINT FROM jsonb_array_elements(COALESCE(ss.events, '[]'::jsonb)) ev
     WHERE ev->>'type' IN ('look_away_long', 'drift')) AS drift_events,
    (SELECT COUNT(*)::BIGINT FROM jsonb_array_elements(COALESCE(ss.events, '[]'::jsonb)) ev
     WHERE ev->>'type' = 'off_screen') AS off_screen_events
  FROM study_sessions ss
  WHERE ss.room_id = p_room_id AND ss.user_id = p_user_id
  ORDER BY ss.ended_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_library_room_member_sessions(UUID, UUID) TO authenticated;

-- Monitoring snapshots for host (optional user filter).
CREATE OR REPLACE FUNCTION get_library_room_snapshots(
  p_room_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  session_id    UUID,
  user_id       UUID,
  user_name     TEXT,
  event_type    TEXT,
  session_t_ms  INTEGER,
  storage_path  TEXT,
  created_at    TIMESTAMPTZ
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
  SELECT
    s.id,
    s.session_id,
    s.user_id,
    COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(p.display_name), ''), 'Student') AS user_name,
    s.event_type,
    s.session_t_ms,
    s.storage_path,
    s.created_at
  FROM session_monitoring_snapshots s
  LEFT JOIN profiles p ON p.id = s.user_id
  WHERE s.room_id = p_room_id
    AND (p_user_id IS NULL OR s.user_id = p_user_id)
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_library_room_snapshots(UUID, UUID) TO authenticated;
