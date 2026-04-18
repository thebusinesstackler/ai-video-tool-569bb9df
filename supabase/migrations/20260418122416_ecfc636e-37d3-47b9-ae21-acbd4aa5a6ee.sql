
CREATE TABLE public.music_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  mood TEXT,
  prompt TEXT,
  audio_url TEXT NOT NULL,
  duration INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.music_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own music"
  ON public.music_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own music"
  ON public.music_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music"
  ON public.music_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music"
  ON public.music_library FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_music_library_user ON public.music_library(user_id, created_at DESC);
