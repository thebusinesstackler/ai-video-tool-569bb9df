

# Browser-Based Video Stitching (No Creatomate)

## Current State
You already have browser-based stitching via FFmpeg.wasm in `src/lib/videoStitch.ts`, and the Reels page has a `useServerStitching` toggle. The infrastructure exists but:
1. The toggle defaults to `true` (Creatomate), so browser stitching is never used unless manually switched
2. There's no UI toggle exposed to the user to switch methods
3. When Creatomate fails, it shows an error instead of automatically falling back to browser stitching
4. The Testimonial Commercial flow (`useTestimonialCommercial.ts`) hardcodes Creatomate with no fallback

## Plan

### 1. Default to browser-based stitching
Change `useServerStitching` default from `true` to `false` in `src/pages/Reels.tsx`, making FFmpeg.wasm the primary method.

### 2. Add automatic fallback in all stitching paths
In **Reels.tsx** — when Creatomate fails (during generation or manual stitch), instead of showing "Stitching Unavailable" toast, automatically attempt browser-based `stitchVideosWithAudio()` before giving up.

In **useTestimonialCommercial.ts** — wrap Creatomate calls with try/catch and fall back to `stitchVideosWithAudio()`.

### 3. Add a stitching method toggle in the UI
Add a simple switch in the Reels feature sidebar or settings area: "Use cloud rendering" (on/off). This lets you opt into Creatomate when credits are available, but defaults to browser stitching.

### 4. Improve browser stitching progress feedback
Update progress status messages during browser-based stitching to be clearer: "Stitching in browser..." with percentage updates.

### Technical Notes
- FFmpeg.wasm runs entirely in the browser — no API credits needed
- It handles video concatenation, audio merging, and basic transitions (fade, dissolve, wipe)
- Limitation: slower than server-side for long videos, and requires downloading all clips to browser memory
- The existing `stitchVideosWithAudio` function already supports transitions and audio merging

