CREATE TABLE public.saved_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id text NOT NULL,
  voice_label text NOT NULL,
  voice_description text,
  gender text DEFAULT 'unknown',
  sample_audio_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, voice_id)
);

ALTER TABLE public.saved_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved voices"
  ON public.saved_voices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved voices"
  ON public.saved_voices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved voices"
  ON public.saved_voices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);