-- Hook folders for organizing by brand/product
CREATE TABLE public.hook_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hook_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hook folders" ON public.hook_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own hook folders" ON public.hook_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own hook folders" ON public.hook_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own hook folders" ON public.hook_folders FOR DELETE USING (auth.uid() = user_id);

-- Saved hooks inside folders
CREATE TABLE public.saved_hooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID NOT NULL REFERENCES public.hook_folders(id) ON DELETE CASCADE,
  hook_text TEXT NOT NULL,
  hook_type TEXT,
  on_screen_text TEXT,
  voiceover_version TEXT,
  visual_direction TEXT,
  scores JSONB,
  best_for TEXT[],
  best_platform TEXT,
  why_chosen TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved hooks" ON public.saved_hooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own saved hooks" ON public.saved_hooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saved hooks" ON public.saved_hooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved hooks" ON public.saved_hooks FOR DELETE USING (auth.uid() = user_id);