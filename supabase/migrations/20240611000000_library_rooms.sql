-- Tag study sessions with a private library room and add host analytics RPC.

ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES focus_hub_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_room_ended
  ON study_sessions (room_id, ended_at DESC)
  WHERE room_id IS NOT NULL;

-- Per-member study stats for a library room (host-only).
CREATE OR REPLACE FUNCTION get_library_room_analytics(p_room_id UUID)
RETURNS TABLE (
  user_id          UUID,
  user_name        TEXT,
  session_count    BIGINT,
  avg_focus        INTEGER,
  total_focus_ms   BIGINT,
  low_focus_count  BIGINT
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
    ss.user_id,
    COALESCE(p.name, 'Student') AS user_name,
    COUNT(*)::BIGINT AS session_count,
    ROUND(AVG(ss.average_focus))::INTEGER AS avg_focus,
    COALESCE(SUM(ss.focus_ms), 0)::BIGINT AS total_focus_ms,
    COUNT(*) FILTER (WHERE ss.average_focus < 50)::BIGINT AS low_focus_count
  FROM study_sessions ss
  JOIN focus_hub_memberships m
    ON m.user_id = ss.user_id AND m.room_id = p_room_id
  LEFT JOIN profiles p ON p.id = ss.user_id
  WHERE ss.room_id = p_room_id
  GROUP BY ss.user_id, p.name
  ORDER BY session_count DESC, avg_focus DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_library_room_analytics(UUID) TO authenticated;

-- Room members currently seated in the library (for monitor sidebar).
CREATE OR REPLACE FUNCTION get_library_room_members_studying(p_room_id UUID)
RETURNS TABLE (
  user_id      UUID,
  user_name    TEXT,
  avatar_url   TEXT,
  seat_id      TEXT,
  status       TEXT,
  focus_phase  TEXT,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_focus_hub_member(p_room_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    up.user_id,
    COALESCE(p.name, 'Student') AS user_name,
    up.avatar_url,
    up.seat_id,
    up.status,
    up.focus_phase,
    up.last_seen_at
  FROM user_presence up
  LEFT JOIN profiles p ON p.id = up.user_id
  WHERE
    up.room_id = p_room_id::TEXT
    AND up.status != 'offline'
    AND up.last_seen_at > NOW() - INTERVAL '90 seconds'
  ORDER BY up.last_seen_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_library_room_members_studying(UUID) TO authenticated;
