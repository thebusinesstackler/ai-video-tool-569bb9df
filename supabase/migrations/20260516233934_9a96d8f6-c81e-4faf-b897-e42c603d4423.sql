ALTER TABLE public.video_tasks 
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

CREATE INDEX IF NOT EXISTS idx_video_tasks_task_id ON public.video_tasks(task_id);