
CREATE TABLE public.video_hooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT,
  video_title TEXT,
  content_summary JSONB DEFAULT '{}'::jsonb,
  context_settings JSONB DEFAULT '{}'::jsonb,
  hooks JSONB DEFAULT '[]'::jsonb,
  selected_hook_index INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own hooks" ON public.video_hooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own hooks" ON public.video_hooks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own hooks" ON public.video_hooks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own hooks" ON public.video_hooks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_video_hooks_updated_at BEFORE UPDATE ON public.video_hooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
