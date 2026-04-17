CREATE TABLE public.voiceover_studio_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Voiceover',
  original_audio_url TEXT,
  transcript TEXT,
  edited_script TEXT,
  voice_source JSONB DEFAULT '{}'::jsonb,
  new_voiceover_url TEXT,
  source_video_url TEXT,
  final_video_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voiceover_studio_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voiceover studio projects"
  ON public.voiceover_studio_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voiceover studio projects"
  ON public.voiceover_studio_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voiceover studio projects"
  ON public.voiceover_studio_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voiceover studio projects"
  ON public.voiceover_studio_projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_voiceover_studio_projects_updated_at
  BEFORE UPDATE ON public.voiceover_studio_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_voiceover_studio_projects_user_id ON public.voiceover_studio_projects(user_id, created_at DESC);