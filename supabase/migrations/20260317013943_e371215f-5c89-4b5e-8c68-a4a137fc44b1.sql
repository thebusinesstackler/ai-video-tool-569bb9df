
ALTER TABLE public.ai_twins 
  ADD COLUMN IF NOT EXISTS voice_engine text NOT NULL DEFAULT 'speechify',
  ADD COLUMN IF NOT EXISTS google_voice_id text NULL;
