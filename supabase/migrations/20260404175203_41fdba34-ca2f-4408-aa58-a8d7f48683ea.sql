ALTER TABLE public.video_repo_projects 
ADD COLUMN is_favorite boolean NOT NULL DEFAULT false,
ADD COLUMN custom_name text;

CREATE INDEX idx_video_repo_projects_favorite ON public.video_repo_projects (user_id, is_favorite DESC, created_at DESC);