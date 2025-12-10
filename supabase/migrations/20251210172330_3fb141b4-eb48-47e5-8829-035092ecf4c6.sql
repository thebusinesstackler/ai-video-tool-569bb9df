-- Add consent_audio_url column for Google Cloud voice cloning consent recording
ALTER TABLE public.ai_twins 
ADD COLUMN IF NOT EXISTS consent_audio_url TEXT;