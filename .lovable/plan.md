

## Problem
The `generate-music` edge function calls the ElevenLabs API directly using `ELEVENLABS_API_KEY` (which isn't configured). WaveSpeed provides an `elevenlabs/music` proxy endpoint that works with the already-configured `WAVESPEED_API_KEY`, using the same async task/poll pattern as other WaveSpeed calls.

## Plan

### 1. Rewrite `generate-music` edge function to use WaveSpeed
**File: `supabase/functions/generate-music/index.ts`**

- Replace the direct ElevenLabs API call with WaveSpeed's `elevenlabs/music` endpoint:
  - Submit: `POST https://api.wavespeed.ai/api/v3/elevenlabs/music` with `{ prompt, music_length_ms, force_instrumental: true, output_format: "mp3_standard" }`
  - Poll: `GET https://api.wavespeed.ai/api/v3/predictions/{taskId}/result` (same pattern used in voiceover and video functions)
- Use `WAVESPEED_API_KEY` (already configured) instead of `ELEVENLABS_API_KEY`
- Convert `duration` (seconds) to `music_length_ms` (milliseconds)
- Extract audio URL from `data.outputs[0]` on completion
- Keep the existing storage upload logic and response format

### 2. Update client-side error handling
**File: `src/pages/Reels.tsx`** (lines 1674-1681)

- Remove the `needsKey` / "ElevenLabs API key" error check since we no longer need a separate key

### 3. Redeploy edge function

### Result
Background music generation uses the same WaveSpeed API key as all other features — no additional API key needed.

