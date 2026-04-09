

# Fix: Motion Graphics Overflowing Video Bounds

## Problem

The video wrapper has `overflow-visible` and the generated motion graphic images are full-frame poster images (not overlay-sized), causing them to spill outside the video area. The overlay containers also use absolute positioning with `left-0 right-0` which spans the full wrapper width regardless of the actual video dimensions.

## Changes

### 1. Constrain overlays to video bounds (`src/pages/ChatcutAI.tsx`)

- Change video wrapper from `overflow-visible` to `overflow-hidden` so nothing escapes the video area
- Reduce motion graphic image size from `max-w-[80%] max-h-[30%]` to `max-w-[50%] max-h-[25%]` so they look like overlays, not posters
- Reduce V2 overlay images from `max-w-[80%]` to `max-w-[50%] max-h-[15%]`
- Add `overflow-hidden` to overlay container divs as a safety net

### 2. Improve motion graphic prompt (`supabase/functions/generate-motion-graphic/index.ts`)

- Prepend sizing instructions to every prompt: "Create a small, compact overlay graphic suitable for placing on top of video. The graphic should be a contained element (like a badge, lower-third bar, or small title card), NOT a full-screen poster or background. Use transparent or minimal background."
- This ensures Gemini generates appropriately sized graphics rather than full-frame images

### 3. Make overlays draggable (`src/pages/ChatcutAI.tsx`)

- Add `position: { x: number, y: number }` to the `OverlayItem` type with defaults (centered for motion graphics, bottom for lower thirds)
- Remove `pointer-events-none` from overlay containers
- Add mouse drag handlers so users can click and drag overlays to reposition them on the video
- Store position in state so it persists

| File | Change |
|------|--------|
| `src/pages/ChatcutAI.tsx` | `overflow-hidden` on wrapper, smaller overlay sizes, draggable positioning |
| `supabase/functions/generate-motion-graphic/index.ts` | Prepend overlay-sizing instructions to prompt |

