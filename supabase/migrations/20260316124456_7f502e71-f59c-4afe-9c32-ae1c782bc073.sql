CREATE POLICY "Users can update own saved voices"
  ON public.saved_voices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);