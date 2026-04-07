
CREATE TABLE public.animated_statics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_image_url TEXT,
  analysis JSONB DEFAULT '{}'::jsonb,
  prompt TEXT,
  animation_url TEXT,
  music_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.animated_statics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own animated statics"
  ON public.animated_statics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own animated statics"
  ON public.animated_statics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own animated statics"
  ON public.animated_statics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own animated statics"
  ON public.animated_statics FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_animated_statics_updated_at
  BEFORE UPDATE ON public.animated_statics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
