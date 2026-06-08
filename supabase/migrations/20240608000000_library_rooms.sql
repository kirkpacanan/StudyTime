-- Extend user_presence with library-specific columns for the 3D virtual library.
-- These columns allow seat occupancy, avatar URL, and room tracking.

ALTER TABLE user_presence
  ADD COLUMN IF NOT EXISTS seat_id TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS room_id TEXT DEFAULT 'main';

-- Index for efficient seat-occupancy queries within a room.
CREATE INDEX IF NOT EXISTS idx_user_presence_room_seat
  ON user_presence (room_id, seat_id)
  WHERE seat_id IS NOT NULL;

-- Update the heartbeat_presence RPC to accept the new library fields.
CREATE OR REPLACE FUNCTION heartbeat_presence(
  p_status TEXT,
  p_session_id TEXT DEFAULT NULL,
  p_focus_phase TEXT DEFAULT NULL,
  p_seat_id TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_room_id TEXT DEFAULT 'main'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, session_id, focus_phase, seat_id, avatar_url, room_id, last_seen_at)
  VALUES (
    auth.uid(),
    p_status,
    p_session_id,
    p_focus_phase,
    p_seat_id,
    p_avatar_url,
    COALESCE(p_room_id, 'main'),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status       = EXCLUDED.status,
    session_id   = EXCLUDED.session_id,
    focus_phase  = EXCLUDED.focus_phase,
    seat_id      = COALESCE(EXCLUDED.seat_id, user_presence.seat_id),
    avatar_url   = COALESCE(EXCLUDED.avatar_url, user_presence.avatar_url),
    room_id      = COALESCE(EXCLUDED.room_id, user_presence.room_id),
    last_seen_at = NOW();
END;
$$;

-- RPC to get current seat occupancy for a given room.
CREATE OR REPLACE FUNCTION get_room_presence(p_room_id TEXT DEFAULT 'main')
RETURNS TABLE (
  user_id     UUID,
  seat_id     TEXT,
  avatar_url  TEXT,
  status      TEXT,
  focus_phase TEXT,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.user_id,
    up.seat_id,
    up.avatar_url,
    up.status,
    up.focus_phase,
    up.last_seen_at
  FROM user_presence up
  WHERE
    up.room_id = p_room_id
    AND up.status != 'offline'
    AND up.last_seen_at > NOW() - INTERVAL '90 seconds'
    AND up.seat_id IS NOT NULL;
END;
$$;

-- Store avatar_url on profiles table for persistence across sessions.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
