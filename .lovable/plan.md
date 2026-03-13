

## Plan: Fix Stitching, Add Progress Bar, and Clip Editing

### Problem Analysis
1. **Stitching fails**: FFmpeg.wasm times out after 180s loading from CDN. Browser-based stitching is unreliable. The manual stitch button doesn't fall back to server-side (Creatomate) — it only uses Creatomate when `useServerStitching` toggle is on.
2. **No progress bar on button**: The stitch button shows a spinner but no progress percentage or bar.
3. **No clip editing**: Individual clips can't be edited (change script, re-generate image/video, swap order) before stitching.

### Plan

#### 1. Fix stitching — default to server-side with browser fallback
- In the `stitchVideos` function, **reverse the priority**: try Creatomate (server) first by default, then fall back to browser FFmpeg only if server fails.
- Remove the `useServerStitching` toggle — always attempt server first.
- This avoids the FFmpeg.wasm CDN loading timeout that's currently blocking users.

#### 2. Add progress bar to the stitch button area
- When `isManualStitching` is true, render a `<Progress>` bar below the stitch button showing `progress` percentage and `progressStatus` text.
- The progress states already exist (`progress`, `progressStatus`) — just need to display them in the stitch button section (around line 4196).

#### 3. Add clip editing capabilities
- Add an "Edit" button overlay on each scene card in the gallery grid (around line 4136).
- Clicking edit opens a dialog/sheet for that scene where the user can:
  - **Edit the script text** for that scene
  - **Re-generate the image** (triggers `generate-scene-image` for that scene)
  - **Re-generate the video** (triggers `wavespeed-video` for that scene)
  - **Swap the image** from gallery
  - **Reorder scenes** via drag or up/down arrows
- Update `project.generatedScenes`, `project.videoClips`, and `project.voiceovers` arrays when edits are made.
- Reuse existing scene regeneration patterns from `ReelEditor` component.

### Files to modify
- `src/pages/Reels.tsx` — reverse stitch priority, add progress UI, add edit overlays and edit dialog
- `src/lib/videoStitch.ts` — no changes needed (kept as fallback)

