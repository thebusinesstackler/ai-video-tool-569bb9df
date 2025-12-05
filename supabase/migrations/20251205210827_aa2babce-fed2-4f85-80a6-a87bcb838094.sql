-- Add audio_url column to store the merged voiceover audio
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS audio_url text;

-- Add comment for clarity
COMMENT ON COLUMN public.reels.audio_url IS 'URL to the merged voiceover audio file';