ALTER TABLE public.video_repo_projects
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS external_task_id text;