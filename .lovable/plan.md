

## Harden Canvas Stitching as Primary Method

### Problem
When Creatomate credits run out (402), the fallback canvas stitcher produces a 0-byte blob. Even though VideoRepoPro already converts segments to local `blob:` URLs (fixing CORS), the `stitchVideosWithAudio` function in `videoStitch.ts` still tries Creatomate first — which fails on `blob:` URLs (not public) — then falls through to canvas. The canvas stitcher itself has reliability issues: the `recorder.stop()` fires too quickly (200ms timeout), and there's no guarantee frames were actually captured.

### Plan

**1. Skip Creatomate for blob URLs in `videoStitch.ts`**
- The current code already checks `allPublic` but `blob:` URLs pass that check since they start with `blob:http`. Add explicit `blob:` detection so it goes straight to canvas stitching — no wasted time on a doomed cloud call.

**2. Harden `canvasStitch.ts` — fix the empty blob issue**
Several reliability fixes:
- **Wait for `canplaythrough`** instead of `onloadeddata` — ensures enough data is buffered for smooth playback
- **Draw an initial black frame** before starting the recorder so the first frame isn't empty
- **Replace `setTimeout(200)` for `recorder.stop()`** with a proper flush: draw one final frame, use `recorder.requestData()`, then stop after a short delay to ensure the last chunk is captured
- **Add a silent audio oscillator** connected to `mixDest` so the MediaRecorder always has an active audio track (some browsers produce 0-byte output when audio track has no data)
- **Guard against 0-duration videos** — if `video.duration` is NaN or 0, default to 5s with a manual timeout

**3. Improve error message in VideoRepoPro**
- When stitching fails, show a more actionable error and offer to download the individual segments separately as a fallback.

### Files Changed
- `src/lib/canvasStitch.ts` — reliability hardening
- `src/lib/videoStitch.ts` — skip cloud for blob URLs
- `src/pages/VideoRepoPro.tsx` — better error handling + individual segment download fallback

