-- Add indexes on user_id columns to speed up RLS policy filtering
CREATE INDEX IF NOT EXISTS idx_ai_twins_user_id ON public.ai_twins(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_twins_created_at ON public.ai_twins(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_created_at ON public.characters(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reels_user_id ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movie_projects_user_id ON public.movie_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_movie_projects_updated_at ON public.movie_projects(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_visual_presets_user_id ON public.visual_presets(user_id);