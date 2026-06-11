-- Activity evidence records, schedule fields, expanded consent, event log RPC.

ALTER TABLE public.focus_hub_memberships
  ADD COLUMN IF NOT EXISTS screen_capture_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.focus_hub_activities
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.focus_hub_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_activity
  ON public.study_sessions (activity_id) WHERE activity_id IS NOT NULL;

-- ── Paired evidence records (webcam + screen) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_evidence_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  room_id              UUID NOT NULL REFERENCES public.focus_hub_rooms(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id          UUID REFERENCES public.focus_hub_activities(id) ON DELETE SET NULL,
  event_index          INTEGER NOT NULL,
  event_type           TEXT NOT NULL,
  event_description    TEXT,
  duration_ms          INTEGER,
  occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_t_ms         INTEGER NOT NULL DEFAULT 0,
  webcam_storage_path  TEXT,
  screen_storage_path  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, event_index)
);

CREATE INDEX IF NOT EXISTS idx_session_evidence_room_user
  ON public.session_evidence_records (room_id, user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_evidence_session
  ON public.session_evidence_records (session_id, event_index);

ALTER TABLE public.session_evidence_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_evidence_insert_own
  ON public.session_evidence_records FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.focus_hub_memberships m
      WHERE m.room_id = session_evidence_records.room_id
        AND m.user_id = auth.uid()
        AND m.monitoring_consent_at IS NOT NULL
    )
  );

CREATE POLICY session_evidence_select_host
  ON public.session_evidence_records FOR SELECT
  TO authenticated
  USING (public.is_focus_hub_host(room_id));

-- ── Consent RPC (webcam + screen + version) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_room_monitoring_consent(
  p_room_id UUID,
  p_screen_consent BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_focus_hub_member(p_room_id) THEN
    RAISE EXCEPTION 'Not a member of this room';
  END IF;

  UPDATE public.focus_hub_memberships
  SET
    monitoring_consent_at = COALESCE(monitoring_consent_at, now()),
    screen_capture_consent_at = CASE
      WHEN p_screen_consent THEN COALESCE(screen_capture_consent_at, now())
      ELSE screen_capture_consent_at
    END,
    consent_version = 1
  WHERE room_id = p_room_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.has_room_monitoring_consent(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent TIMESTAMPTZ;
  v_screen TIMESTAMPTZ;
  v_role TEXT;
BEGIN
  SELECT monitoring_consent_at, screen_capture_consent_at, role
  INTO v_consent, v_screen, v_role
  FROM public.focus_hub_memberships
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_role = 'host' THEN RETURN true; END IF;
  RETURN v_consent IS NOT NULL AND v_screen IS NOT NULL;
END;
$$;

-- ── Host event log (numbered, chronological) ────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_room_activity_event_log(
  p_room_id    UUID,
  p_user_id    UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  session_id            UUID,
  user_id               UUID,
  user_name             TEXT,
  event_index           INTEGER,
  event_type            TEXT,
  event_description     TEXT,
  duration_ms           INTEGER,
  occurred_at           TIMESTAMPTZ,
  session_t_ms          INTEGER,
  webcam_storage_path   TEXT,
  screen_storage_path   TEXT
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
    e.id,
    e.session_id,
    e.user_id,
    COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(p.display_name), ''), 'Student') AS user_name,
    e.event_index,
    e.event_type,
    e.event_description,
    e.duration_ms,
    e.occurred_at,
    e.session_t_ms,
    e.webcam_storage_path,
    e.screen_storage_path
  FROM public.session_evidence_records e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.room_id = p_room_id
    AND e.user_id = p_user_id
    AND (p_session_id IS NULL OR e.session_id = p_session_id)
  ORDER BY e.occurred_at ASC, e.event_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_activity_event_log(UUID, UUID, UUID) TO authenticated;

-- Update member sessions RPC to include activity_id
DROP FUNCTION IF EXISTS public.get_library_room_member_sessions(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_library_room_member_sessions(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  session_id         UUID,
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  average_focus      INTEGER,
  focus_ms           INTEGER,
  distraction_events INTEGER,
  phone_events       BIGINT,
  drift_events       BIGINT,
  off_screen_events  BIGINT,
  activity_id        UUID
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
     WHERE ev->>'type' = 'off_screen') AS off_screen_events,
    ss.activity_id
  FROM public.study_sessions ss
  WHERE ss.room_id = p_room_id AND ss.user_id = p_user_id
  ORDER BY ss.ended_at DESC;
END;
$$;
