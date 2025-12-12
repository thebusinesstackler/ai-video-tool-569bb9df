-- Add story_bible column to movie_projects table
ALTER TABLE public.movie_projects ADD COLUMN IF NOT EXISTS story_bible jsonb DEFAULT '{}'::jsonb;