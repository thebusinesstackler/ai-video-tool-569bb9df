

## Plan: Fix AI Spokesperson Video Quality — Proper Lip-Sync, Duration Control, and Multi-Scene B-Roll

### Root Causes

1. **Wrong model routing**: `infinitetalk` now maps to Sora-2 image-to-video (no audio input). The generated TTS audio is uploaded but never sent to the video model. Result: silent or static video with no lip-sync.
2. **Duration mismatch**: User selects 15s/30s/45s/60s but Sora-2 only accepts 4/8/12/16/20s. No feedback about this.
3. **No B-roll rendering**: The AI script generates 3-5 scenes (speaking + broll + transition), but `generateVideo()` only renders a single video from scene 1 and ignores the rest.

---

### Changes

#### 1. Fix lip-sync by using real InfiniteTalk HD for speaking scenes
**File:** `src/pages/AISpokesperson.tsx`

- Change `generateVideo()` to use model `'infinitetalk-hd'` instead of `'infinitetalk'` for the main speaking video. This routes to the actual WaveSpeed InfiniteTalk endpoint that accepts both `image` and `audio` inputs for real lip-sync.
- Ensure the `audioUrl` is always passed (it's already uploaded to storage).

#### 2. Implement multi-scene rendering with B-roll
**File:** `src/pages/AISpokesperson.tsx`

- When the script has `scenes`, render each scene separately:
  - **Speaking scenes** → `infinitetalk-hd` (image + audio segment)
  - **B-roll scenes** → `sora-2` or `kling-v3.0-pro` (image only, cinematic prompt, no audio needed)
  - **Transition scenes** → short `sora-2` clips
- After all scenes complete, stitch them together using the existing `creatomate-stitch` or `canvasStitch` fallback.
- Show per-scene progress in the UI.

#### 3. Fix duration control
**File:** `src/pages/AISpokesperson.tsx`

- The total duration is controlled by the script's scene breakdown (sum of scene durations), not by the video model's duration parameter.
- For InfiniteTalk HD: duration is determined by the audio length (natural).
- For Sora-2 B-roll: snap to nearest allowed duration (4/8s for short B-roll clips).
- Show the user the estimated vs actual duration before generation.

#### 4. Split narration audio per scene
**File:** `src/pages/AISpokesperson.tsx`

- Generate TTS for each speaking scene's `narrationSegment` separately (not the full narration as one block). This gives precise audio for each lip-sync segment.
- Non-speaking scenes get no audio (or ambient SFX if available).

---

### Technical Flow

```text
User clicks "Generate Video"
  │
  ├─ For each scene in generatedScript.scenes:
  │    ├─ Speaking → TTS(narrationSegment) → upload audio → infinitetalk-hd(image, audio)
  │    ├─ B-roll  → sora-2(image, cinematic prompt, 4-8s)
  │    └─ Transition → sora-2(image, movement prompt, 4s)
  │
  ├─ Poll all tasks until complete
  │
  ├─ Stitch scene videos in order (creatomate-stitch or canvas fallback)
  │
  └─ Optional: Wan 2.7 post-production enhancement on final video
```

### Files to Modify
1. **`src/pages/AISpokesperson.tsx`** — Rewrite `generateVideo()` to handle multi-scene rendering with correct model routing

### What This Fixes
- **Audio/lip-sync**: Real InfiniteTalk HD generates actual mouth movements synced to speech
- **B-roll**: Cinematic cutaway scenes render between speaking segments
- **Duration**: Total video length matches the script's scene breakdown naturally
- **Static video**: Sora-2 was generating a still image animation with no audio — replaced with proper lip-sync model

