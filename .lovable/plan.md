

## Add Audio to Video Repo Pro

### Problem
Video Repo Pro generates two Sora-2 video segments and stitches them, but the final video has zero audio because:
1. Sora-2 clips may contain native audio, but `embeddedAudioIndices` is never passed to the stitcher — so all clips play muted
2. No voiceover/TTS is generated from the script

### Plan

**Step 1: Capture Sora-2 native audio (quick win)**
In `VideoRepoPro.tsx`, pass `embeddedAudioIndices: [0, 1]` to `stitchVideosWithAudio()` so the canvas stitcher plays both clips unmuted and captures their native audio track (ambient sounds, effects Sora-2 generates).

**Step 2: Add TTS voiceover generation**
After the AI generates the script analysis (which contains the full 30-second ad script), extract a clean narration script from the analysis text and generate voiceover audio using the existing `text-to-speech` edge function. Pass the resulting audio URL as `audioUrls` to the stitcher so there's a narration track layered over the video.

Changes:
- Have the AI output a dedicated `narration` block in its response (alongside the video prompts)
- After video segments are generated but before stitching, call the TTS edge function to produce a voiceover MP3
- Pass both `embeddedAudioIndices: [0, 1]` and `audioUrls: [voiceoverUrl]` to the stitcher

**Step 3: Optional background music**
Add an optional toggle in the UI for background music. The stitcher already supports `backgroundMusicUrl` and `backgroundMusicVolume` — just needs a UI control and a music URL source.

### Files Changed
- `src/pages/VideoRepoPro.tsx` — add narration extraction, TTS call, pass audio params to stitcher
- No edge function changes needed — existing `text-to-speech` function handles TTS

### Technical Detail
The `stitchVideosWithAudio` call on line 558 currently only passes `videoUrls` and `onProgress`. It will be updated to:
```typescript
const stitchedBlob = await stitchVideosWithAudio({
  videoUrls: blobUrls,
  embeddedAudioIndices: [0, 1],
  audioUrls: voiceoverUrl ? [voiceoverUrl] : [],
  onProgress: (pct) => setGenerationProgress(`Stitching... ${pct}%`),
});
```

