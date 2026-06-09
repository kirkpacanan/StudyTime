-- Fix infinite recursion between focus_hub_rooms and focus_hub_memberships RLS policies.
-- Use SECURITY DEFINER helpers so policy checks bypass RLS on the other table.

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

-- Rooms
DROP POLICY IF EXISTS "rooms_select_member" ON public.focus_hub_rooms;
CREATE POLICY "rooms_select_member"
  ON public.focus_hub_rooms FOR SELECT
  USING (created_by = auth.uid() OR public.is_focus_hub_member(id));

-- Memberships
DROP POLICY IF EXISTS "memberships_select" ON public.focus_hub_memberships;
CREATE POLICY "memberships_select"
  ON public.focus_hub_memberships FOR SELECT
  USING (user_id = auth.uid() OR public.is_focus_hub_host(room_id));

DROP POLICY IF EXISTS "memberships_delete_host_or_self" ON public.focus_hub_memberships;
CREATE POLICY "memberships_delete_host_or_self"
  ON public.focus_hub_memberships FOR DELETE
  USING (user_id = auth.uid() OR public.is_focus_hub_host(room_id));

-- Activities
DROP POLICY IF EXISTS "activities_select_member" ON public.focus_hub_activities;
CREATE POLICY "activities_select_member"
  ON public.focus_hub_activities FOR SELECT
  USING (public.is_focus_hub_member(room_id));

DROP POLICY IF EXISTS "activities_insert_host" ON public.focus_hub_activities;
CREATE POLICY "activities_insert_host"
  ON public.focus_hub_activities FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_focus_hub_host(room_id)
  );

-- Sessions
DROP POLICY IF EXISTS "sessions_select" ON public.focus_hub_sessions;
CREATE POLICY "sessions_select"
  ON public.focus_hub_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.focus_hub_activities a
      WHERE a.id = activity_id
        AND public.is_focus_hub_host(a.room_id)
    )
  );
