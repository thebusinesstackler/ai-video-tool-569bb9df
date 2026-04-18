CREATE TABLE public.podcast_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  hook TEXT,
  narration TEXT NOT NULL,
  visual_description TEXT,
  style_label TEXT,
  setting_label TEXT,
  audience TEXT,
  featured_product TEXT,
  twin_id UUID,
  twin_name TEXT,
  duration INTEGER DEFAULT 60,
  audio_url TEXT,
  video_url TEXT,
  scene_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own podcast projects"
  ON public.podcast_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own podcast projects"
  ON public.podcast_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own podcast projects"
  ON public.podcast_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own podcast projects"
  ON public.podcast_projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_podcast_projects_updated_at
  BEFORE UPDATE ON public.podcast_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_podcast_projects_user ON public.podcast_projects(user_id, created_at DESC);