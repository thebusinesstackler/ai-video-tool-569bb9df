

## Plan: Sora 2 for Intros/Outros, Cut Scene Previews, Hook Style Integration, and TTS Voice Preview

### What's Changing

**1. Route Intro/Outro video generation to Sora 2** (`generate-reel-video/index.ts`)
- Currently intros and outros use Kling 3.0 Pro (`kwaivgi/kling-v3.0-pro/image-to-video`)
- Change both to use WaveSpeed's Sora 2 endpoint: `https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video`
- Sora 2 supports 4s, 8s, or 12s durations with synchronized audio and cinematic quality
- Add `'sora-2'` to the model type union in `wavespeed-video/index.ts`

**2. Add Sora 2 model routing in `wavespeed-video/index.ts`**
- Add a new branch for `model === 'sora-2'` that routes to `https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video`
- Accept image + prompt + duration parameters

**3. Make cut scenes auto-generate and display in Step 2** (`Reels.tsx`)
- After script generation in beginner mode, if `enableCutScenes` is true (or auto-enabled), show cut scene entries in the Step 2 script review with `🎞️ Cut` badges
- The `generate-reel-script` edge function already supports `enableCutScenes` — verify it generates `isCutScene` flagged scenes and they display correctly
- Add a toggle for cut scenes in Step 1 (beginner mode) so users can enable it before script generation

**4. Hook style options in beginner Step 1** (`Reels.tsx`)
- The hook style selector already exists in Step 1 (line 2817-2833) with 7 options — verify these values are passed through to the edge function correctly
- The edge function already has 12 hook categories defined — ensure the UI values map to the backend categories (e.g., `bold-claim` → `bold_claim`)
- Fix any mismatches between UI values (hyphenated) and backend values (underscored)

**5. Add TTS voice preview below the script in Step 2** (`Reels.tsx`)
- Add a "Preview Voice" button in Step 2 after the script review section
- Uses the existing `previewVoice` function which calls the `text-to-speech` edge function via WaveSpeed MiniMax
- Show the currently selected voice badge and a play/stop button
- Users can hear the voice before proceeding to character/video generation

### Files Modified
- `supabase/functions/generate-reel-video/index.ts` — route intro/outro scenes to Sora 2 API
- `supabase/functions/wavespeed-video/index.ts` — add `sora-2` model support
- `src/pages/Reels.tsx` — add cut scenes toggle + voice preview to beginner Steps 1-2, fix hook style value mapping

