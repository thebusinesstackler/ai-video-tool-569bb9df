ALTER TABLE public.vizard_projects 
  ADD COLUMN IF NOT EXISTS vizard_api_project_id bigint,
  ADD COLUMN IF NOT EXISTS vizard_share_link text,
  ADD COLUMN IF NOT EXISTS vizard_videos jsonb DEFAULT '[]'::jsonb;