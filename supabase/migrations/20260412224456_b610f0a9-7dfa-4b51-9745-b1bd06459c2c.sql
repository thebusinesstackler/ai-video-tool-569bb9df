
CREATE TABLE public.vizard_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  status TEXT NOT NULL DEFAULT 'uploading',
  source_video_url TEXT,
  transcript JSONB,
  clips JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vizard_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vizard projects"
  ON public.vizard_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vizard projects"
  ON public.vizard_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vizard projects"
  ON public.vizard_projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vizard projects"
  ON public.vizard_projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_vizard_projects_updated_at
  BEFORE UPDATE ON public.vizard_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
