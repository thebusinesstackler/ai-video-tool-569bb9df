-- Add caption_settings column to reels table
ALTER TABLE reels 
ADD COLUMN IF NOT EXISTS caption_settings jsonb DEFAULT '{"enabled": true, "style": "karaoke", "background": "glass", "position": "bottom"}'::jsonb;