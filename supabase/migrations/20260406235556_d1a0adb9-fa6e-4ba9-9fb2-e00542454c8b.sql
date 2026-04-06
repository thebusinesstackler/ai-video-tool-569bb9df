
CREATE TABLE public.lifestyle_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_url TEXT,
  brand_analysis JSONB DEFAULT '{}'::jsonb,
  concepts JSONB DEFAULT '[]'::jsonb,
  selected_concept_index INTEGER,
  duration INTEGER DEFAULT 30,
  scenes JSONB DEFAULT '[]'::jsonb,
  voiceover_url TEXT,
  music_url TEXT,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lifestyle_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lifestyle stories"
  ON public.lifestyle_stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lifestyle stories"
  ON public.lifestyle_stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lifestyle stories"
  ON public.lifestyle_stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lifestyle stories"
  ON public.lifestyle_stories FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_lifestyle_stories_updated_at
  BEFORE UPDATE ON public.lifestyle_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
