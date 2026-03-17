

## Problems Identified

### 1. Completed WaveSpeed videos not appearing on platform
The status handler in `wavespeed-video/index.ts` (line 652) only extracts the video URL from `taskData.outputs[0]`. Different WaveSpeed models (especially Sora-2) may return the URL in alternative fields like `taskData.output`, `taskData.output.video`, `taskData.result`, or `taskData.video_url`. When the field doesn't match, status returns `completed` with `videoUrl: undefined`, so the client sees "completed" but has no URL -- the video is silently lost.

### 2. Last scene audio muted
The canvas stitcher mutes all video elements (`video.muted = true`, line 22 of `canvasStitch.ts`). Audio only comes from explicit `audioUrls` or extracted embedded audio. If the last scene is a Sora-2 intro/outro (which has `hasEmbeddedAudio: false`) but the TTS voiceover generation skipped it (e.g. it was marked as intro/outro without narration, or the audio generation failed silently), the last scene plays with no audio.

Additionally, `embeddedAudioIndices` only adds video URLs to the audio extraction list for lip-sync models -- Sora-2 scenes that contain audio natively won't have their audio extracted.

---

## Plan

### Fix 1: Robust video URL extraction in `wavespeed-video/index.ts`
In the status handler (around line 652), add fallback checks for alternative WaveSpeed response fields:

```typescript
const videoUrl = (taskData.outputs && taskData.outputs.length > 0) 
  ? taskData.outputs[0] 
  : taskData.output?.video 
    || taskData.output 
    || taskData.result 
    || taskData.video_url 
    || taskData.url 
    || undefined;
```

Also add detailed logging of the full `taskData` keys when `status === 'completed'` but no `videoUrl` is found, so future mismatches are immediately diagnosable.

### Fix 2: Fix last scene audio in `canvasStitch.ts`
The audio concatenation approach assumes all overlay audios map 1:1 to non-embedded scenes, but if audio counts don't match video counts, the last scene(s) get silence. Add logging to trace the mismatch, and in `src/pages/Reels.tsx` ensure every non-embedded scene has a corresponding audio entry (even if empty/silent) so the timing stays aligned.

### Fix 3: Ensure Sora-2 outro/intro scenes get TTS audio
In `src/pages/Reels.tsx` (around line 2207), the post-poll audio generation skips scenes based on `perSceneEmbeddedAudio`. Sora-2 scenes are correctly marked `hasEmbeddedAudio: false`, but the filter at line 2217 also skips `isSilentCTA` scenes and scenes without `narration`. For outro scenes that DO have narration, verify they're included. Add explicit logging for which scenes get audio and which are skipped.

### Files to edit
- `supabase/functions/wavespeed-video/index.ts` -- robust video URL extraction
- `src/pages/Reels.tsx` -- ensure audio coverage for all non-embedded scenes
- `src/lib/canvasStitch.ts` -- add diagnostic logging for audio/video count alignment

