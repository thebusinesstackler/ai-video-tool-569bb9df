

# Fix Reel Quality: Better AI Models, Camera-Facing Characters, and Aligned Audio

## Problems Identified

1. **Script generation uses `google/gemini-2.5-flash`** — a mid-tier model. The latest thinking/reasoning models (`google/gemini-2.5-pro` or `google/gemini-3.1-pro-preview`) produce significantly better creative writing.
2. **Image generation prompts bury "direct eye contact" among 15+ competing instructions** — the model deprioritizes it. Characters end up looking away or in profile shots.
3. **Visual descriptions are overly complex** — too many cinematography directives (lens mm, f-stop, color grade, atmosphere) dilute the core instruction: "person looking at camera, matching the narration topic."
4. **TTS voice mismatch** — the `generate-reel-video` function hardcodes `English_Trustworth_Man` regardless of the user's selected voice, so the voice doesn't match the character.

## Plan

### 1. Upgrade script generation model
- **File:** `supabase/functions/generate-reel-script/index.ts` (line 410)
- Change `model: 'google/gemini-2.5-flash'` to `model: 'google/gemini-2.5-pro'`
- This model has superior reasoning and creative writing, producing more engaging hooks and natural narration.

### 2. Upgrade image generation to pro model
- **File:** `supabase/functions/generate-reel-video/index.ts` (line 370)
- Change `model: 'google/gemini-3.1-flash-image-preview'` to `model: 'google/gemini-3-pro-image-preview'`
- Pro image model produces higher-fidelity, more realistic portraits with better instruction following.

### 3. Rewrite image prompts to prioritize eye contact and simplicity
- **File:** `supabase/functions/generate-reel-video/index.ts`, function `getTemplateImagePrompt`
- For lip-sync scenes: Make "LOOKING DIRECTLY AT CAMERA" the first and most prominent instruction. Reduce cinematography noise to 2-3 key directives instead of 10+.
- For non-lip-sync scenes: Same priority — character must face the camera and visually illustrate the narration topic.
- Remove redundant instructions about lens mm, f-stop numbers, and camera brand names that confuse the image model.

### 4. Pass the user's selected voice to TTS in video generation
- **File:** `supabase/functions/generate-reel-video/index.ts`, function `generateWaveSpeedTTS` (line 76)
- Currently hardcodes `voiceId = 'English_Trustworth_Man'`. Change to accept the `voice` parameter from the request body and use it.

### 5. Upgrade scene-image function model (used for preview images)
- **File:** `supabase/functions/generate-scene-image/index.ts` (line 204)
- Change `model: 'google/gemini-3.1-flash-image-preview'` to `model: 'google/gemini-3-pro-image-preview'`

## Files to modify
1. `supabase/functions/generate-reel-script/index.ts` — model upgrade
2. `supabase/functions/generate-reel-video/index.ts` — model upgrade, prompt rewrite, voice passthrough
3. `supabase/functions/generate-scene-image/index.ts` — model upgrade

All three edge functions will be redeployed.

