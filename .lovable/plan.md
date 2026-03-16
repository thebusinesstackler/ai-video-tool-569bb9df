

## Plan: Switch Reels to InfiniteTalk for Lip-Sync Scenes (up to 10 min)

### Problem
The Reels page defaults to `wan-2.1-i2v-480p` which produces ~4-second clips with no lip sync. The `infinitetalk-fast` model already exists in the `wavespeed-video` edge function and supports audio-driven lip sync for up to 10 minutes, but the `generate-reel-video` edge function doesn't use it.

### Changes

**1. `supabase/functions/generate-reel-video/index.ts` — Add InfiniteTalk as primary lip-sync path**
- Add a new branch for `isNarratorScene && enableLipSync && videoModel === 'infinitetalk'` (or make it the default lip-sync model)
- When lip sync is enabled with a portrait image + pre-generated voiceover audio URL:
  - Call `wavespeed-ai/infinitetalk-fast` with `{ image: portraitImage, audio: audioUrl, prompt: narrationContext }`
  - Mark `sceneHasEmbeddedAudio = true` (infinitetalk embeds audio in the video)
  - No duration cap — the video length matches the audio length naturally
- Move this branch ABOVE the wan-2.1 and kling branches so it takes priority when lip sync is on

**2. `src/pages/Reels.tsx` — Change defaults and model options**
- Change default `videoModel` from `'wan-2.1-i2v-480p'` to `'infinitetalk'`
- Add `'infinitetalk'` to the videoModel type union
- When `enableLipSync` is true, auto-select `infinitetalk` as the model
- Update the model selector UI to show InfiniteTalk as the recommended option for lip-sync with a label like "InfiniteTalk (Lip Sync, up to 10min)"
- Keep wan-2.1 and kling as non-lip-sync options for B-roll/visual-only scenes

**3. `supabase/functions/generate-reel-video/index.ts` — Ensure voiceover audio is passed correctly**
- The edge function already receives `voiceovers` array with `audioUrl` per scene
- For infinitetalk scenes, pass the scene's voiceover `audioUrl` directly to the API (it needs an HTTP URL, not base64)
- If `audioUrl` is base64, upload to storage first (existing pattern in the codebase)

**4. Duration handling fix**
- Remove the `clipDuration = Math.max(3, Math.min(10, ...))` cap for infinitetalk scenes — the model auto-matches audio length
- For other models (kling, wan), keep existing duration capping

### Files to modify
- `supabase/functions/generate-reel-video/index.ts` — Add infinitetalk routing, remove duration cap for it
- `src/pages/Reels.tsx` — Update default model, type union, and auto-select logic

