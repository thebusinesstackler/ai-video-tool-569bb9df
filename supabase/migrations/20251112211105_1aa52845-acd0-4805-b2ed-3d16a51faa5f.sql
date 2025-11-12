-- Add stitched_video_url column to movie_projects table
ALTER TABLE public.movie_projects 
ADD COLUMN IF NOT EXISTS stitched_video_url TEXT;