---
name: Reels — never use Kling, prefer InfiniteTalk for long-form voice
description: Reels pipeline must avoid kling-v3.0-pro and route narrator scenes (esp. ≥2min) through wavespeed-ai/infinitetalk with TTS audio so the video always has voice
type: constraint
---

In `supabase/functions/generate-reel-video/index.ts` (and any Reels flow):

- **Never** use `kwaivgi/kling-v3.0-pro` (or any Kling endpoint). Too expensive, no embedded audio, and the user has rejected it.
- Narrator scenes — including long-form 2–3 minute videos — must route to `wavespeed-ai/infinitetalk` (image + TTS audio) so the result always has voice. InfiniteTalk auto-matches audio length, so no clip-duration cap.
- B-roll / silent fallbacks: use `alibaba/wan-2.5/image-to-video` (or `alibaba/wan-2.5/text-to-video` when no image).
- The fallback path when the primary model fails must first try to (re)generate TTS for narrator scenes and route to InfiniteTalk before falling back to silent Wan.

**Why:** User explicitly reported a 2-minute Reels render came back silent because the fallback used Kling without audio. InfiniteTalk handles long-form lip-sync with voice natively.
