
CREATE TABLE public.video_repo_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT,
  reference_video_url TEXT,
  product_image_url TEXT,
  analysis_text TEXT,
  generated_video_url TEXT,
  video_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'analyzing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_repo_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video repo projects"
  ON public.video_repo_projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video repo projects"
  ON public.video_repo_projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video repo projects"
  ON public.video_repo_projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video repo projects"
  ON public.video_repo_projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_video_repo_projects_updated_at
  BEFORE UPDATE ON public.video_repo_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
