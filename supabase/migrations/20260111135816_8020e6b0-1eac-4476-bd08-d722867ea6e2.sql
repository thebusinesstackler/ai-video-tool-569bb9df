-- Add draft support columns to reels table
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS draft_state JSONB DEFAULT NULL;

-- Add index for quick draft lookups
CREATE INDEX IF NOT EXISTS idx_reels_is_draft ON public.reels(user_id, is_draft) WHERE is_draft = true;

-- Comment explaining the draft_state structure
COMMENT ON COLUMN public.reels.draft_state IS 'Stores full editor state: topic, sceneCount, sceneDuration, voice, videoSize, transitionStyle, hookStyle, characterDescription, preSelectedReference, selectedTwinId, intro/outro settings, featureToggles, strategistState, previewScenes, scenes, voiceovers';