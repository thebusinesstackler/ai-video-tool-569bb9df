

## Plan: Auto-Show Final Commercial with Captions

### Problem
1. After generating a commercial, you have to manually click "Final Cut" tab — it should automatically scroll/show the finished video inline
2. There's no caption/subtitle support on the Testimonial Commercial page (Reels has `KaraokeCaption` + `CaptionStyleSelector` but commercials don't use them)

### Changes

**1. `src/pages/TestimonialCommercial.tsx` — Auto-show finished video inline with captions**

- Add a caption settings state using the existing `CaptionSettings` type and `CaptionStyleSelector` component
- After generation completes (`handleGenerate`), instead of just switching to "Final Cut" tab, render the finished video **inline below the segments** with a prominent "Your Commercial is Ready" card — visible without tab switching
- Replace the plain `<video>` tag in the Final Cut section with `VideoPlayerWithOverlay` (already supports karaoke captions) — pass the segments' scripts as scene text for caption rendering
- Add `CaptionStyleSelector` toggle in the generation bar area so users can enable/configure captions before generating
- Build the scenes array for `VideoPlayerWithOverlay` from segments (script text + duration + any images)

**2. Inline result card below timeline**

- When `finalVideoUrl` exists, render a prominent card below the active tab content showing:
  - The video player with caption overlay
  - Download / Copy Link / Regenerate actions
  - Individual segment clips grid
- This makes the result visible immediately without requiring a tab switch

### Files to modify
- `src/pages/TestimonialCommercial.tsx` — Add caption state, CaptionStyleSelector in generation bar, replace Final Cut video with VideoPlayerWithOverlay, add inline result card

### Components reused (no new files needed)
- `src/components/KaraokeCaption.tsx`
- `src/components/CaptionStyleSelector.tsx` 
- `src/components/VideoPlayerWithOverlay.tsx`

