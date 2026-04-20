ALTER TABLE public.video_repo_projects ADD COLUMN IF NOT EXISTS tagged_product TEXT;
CREATE INDEX IF NOT EXISTS idx_video_repo_projects_tagged_product ON public.video_repo_projects(tagged_product);