

## Plan: Full Video Viewing Experience for Completed Commercials

**Problem**: After generating a video, the only way to see it is a tiny 200px player squeezed at the bottom of the page. There's no dedicated viewing experience, no easy sharing, and the user can't tell what options are available post-generation.

### Changes

**1. Add a "Final Cut" tab** (`TestimonialCommercial.tsx`)
- Add a 4th tab called "Final Cut" (next to Scenes / B-Roll / Saved) that appears when `finalVideoUrl` exists.
- Auto-switch to this tab after generation completes.
- Contents: large video player, Download button, Share/Copy URL button, "Regenerate" button, and segment-by-segment clip review (individual `videoUrl`s from each segment if available).

**2. Upgrade the bottom bar post-generation** (`TestimonialCommercial.tsx`)
- When `finalVideoUrl` exists, replace the tiny inline player with a prominent "Watch Final Cut" button that switches to the Final Cut tab.
- Keep Download in the header as-is.

**3. Show per-segment video clips in segment cards** (`SegmentTimeline` / `SegmentCard`)
- If a segment has a `videoUrl`, show a small play button or thumbnail so users can review individual clips.

### Summary of what the user gets after generation:
- **Final Cut tab** — full-size video player with download + copy link
- **Per-segment clips** — review individual generated clips
- **Clear next actions** — regenerate, save, download, share

