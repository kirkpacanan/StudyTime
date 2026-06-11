-- Allow any room host to update activities (schedule edits while active).

DROP POLICY IF EXISTS "activities_update_host" ON public.focus_hub_activities;
CREATE POLICY "activities_update_host"
  ON public.focus_hub_activities FOR UPDATE
  TO authenticated
  USING (public.is_focus_hub_host(room_id))
  WITH CHECK (public.is_focus_hub_host(room_id));

DROP POLICY IF EXISTS "activities_delete_host" ON public.focus_hub_activities;
CREATE POLICY "activities_delete_host"
  ON public.focus_hub_activities FOR DELETE
  TO authenticated
  USING (public.is_focus_hub_host(room_id));
