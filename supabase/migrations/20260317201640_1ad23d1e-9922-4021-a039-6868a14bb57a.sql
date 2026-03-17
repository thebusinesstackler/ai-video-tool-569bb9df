CREATE TABLE public.video_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'pending',
  video_url text,
  source text,
  source_id uuid,
  scene_number integer,
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON public.video_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.video_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.video_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.video_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_video_tasks_user_id ON public.video_tasks(user_id);
CREATE INDEX idx_video_tasks_task_id ON public.video_tasks(task_id);
CREATE INDEX idx_video_tasks_status ON public.video_tasks(status);