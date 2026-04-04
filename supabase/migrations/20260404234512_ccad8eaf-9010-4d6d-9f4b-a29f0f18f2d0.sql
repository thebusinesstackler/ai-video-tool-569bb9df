
CREATE TABLE public.video_clip_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_video_url TEXT NOT NULL,
  start_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  end_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT 'Untitled Clip',
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_clip_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clip templates"
ON public.video_clip_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clip templates"
ON public.video_clip_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clip templates"
ON public.video_clip_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clip templates"
ON public.video_clip_templates FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_video_clip_templates_updated_at
BEFORE UPDATE ON public.video_clip_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
