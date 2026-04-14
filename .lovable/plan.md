

# Add Start & End Frame UI to Motion Video Tab

## Problem
The Motion Video (Beta) tab on Video Repo shares the same generic composer as the Ad tab. It doesn't expose the start/end frame upload strategy that the backend already supports via three WaveSpeed models: **Kling 2.6 Pro** (`keyframe-interpolation`), **VIDU** (`vidu-start-end`), and **Seedance** (`seedance-i2v`).

## What You'll Get
When you click "Motion Video (Beta)", the composer area swaps to a dedicated UI with:
- **Two side-by-side image upload slots** — "Start Frame" and "End Frame" with thumbnail previews
- **Model picker** — dropdown to choose between Kling 2.6 Pro (best quality, 5 or 10s), VIDU 2.0 (requires both frames), or Seedance (end frame optional)
- **Prompt field** — describe the desired motion/transition
- **Generate button** — uploads both frames to `project-files` storage, then calls `createWaveSpeedVideo` with the correct `model`, `startFrameUrl`, and `endFrameUrl` params
- Result appears in the conversation area and is saved to history

## Technical Details

### File: `src/pages/VideoRepo.tsx`

1. **New state variables**:
   - `motionStartFrame` / `motionStartFramePreview` — File + preview URL for start frame
   - `motionEndFrame` / `motionEndFramePreview` — File + preview URL for end frame
   - `motionModel` — `'keyframe-interpolation' | 'vidu-start-end' | 'seedance-i2v'` (default: `keyframe-interpolation`)
   - `motionPrompt` — separate prompt for motion tab

2. **Conditional composer**: When `activeTab === 'motion'`, render the motion-specific UI instead of the shared ad composer. Two image drop zones side-by-side with an arrow between them, model selector dropdown, and prompt textarea.

3. **`generateMotionVideo()` handler**:
   - Upload both image files to `project-files` bucket
   - Get public URLs
   - Call `createWaveSpeedVideo({ model: motionModel, startFrameUrl, endFrameUrl, prompt: motionPrompt })`
   - Poll via `getWaveSpeedVideoJob` and display result in chat area
   - Validate: VIDU requires both frames; Kling/Seedance require at least start frame

4. **Model-specific constraints enforced in UI**:
   - Kling 2.6 Pro: duration locked to 5s or 10s (radio toggle)
   - VIDU: end frame upload marked as required
   - Seedance: end frame shown as optional

### File: `src/lib/wavespeed.ts`
- Add `'vidu-start-end' | 'seedance-i2v' | 'keyframe-interpolation'` to the model union type (some already present, ensure all three are listed)
- Ensure `startFrameUrl` and `endFrameUrl` are in the `WaveSpeedVideoParams` interface (already present)

### No backend changes needed
The `wavespeed-video` edge function already handles all three models with `startFrameUrl`, `endFrameUrl`, `tail_image`, and `last_image` mappings.

