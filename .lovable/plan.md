

# Fix: Blurry Vizard Clip Playback

## Problem
The Vizard clips are HD from source, but the frontend renders them in a 2-column grid (`md:grid-cols-2`) which squeezes each video to ~450px wide. Combined with no `preload` attribute, the browser may show a low-quality initial frame or scale the video poorly.

## Changes

**File: `src/pages/Vizard.tsx`**

1. **Switch to single-column layout** for clip cards so each video gets the full container width, displaying at higher resolution
2. **Add `preload="metadata"`** to the `<video>` element so the browser loads a sharp initial frame
3. **Remove `maxHeight: '500px'`** constraint that forces downscaling — let the video render at native aspect ratio within the container width
4. **Add click-to-expand**: wrap each video card so clicking opens the `VideoPlayer` dialog at full size for detailed viewing

These are CSS/layout-only changes — no API or backend modifications needed since the source clips are already high quality.

