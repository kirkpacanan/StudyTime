-- Allow users to finalize pre-created study_sessions rows (activity room evidence flow).

CREATE POLICY "study_sessions_update_own"
  ON public.study_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
