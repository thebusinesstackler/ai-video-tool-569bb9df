

## Add Aspect Ratio Picker to Podcast Talking-Head

Enable TikTok-style 9:16 portrait talking-head videos (plus 16:9 landscape and 1:1 square) on the Podcast page.

### What you'll get

A new **Aspect Ratio** section on `/podcast` when creating talking-head videos:

```
┌─ Aspect Ratio ──────────────────────┐
│  ◯ 9:16 Portrait  (TikTok/Reels)     │
│  ◉ 16:9 Landscape (YouTube)           │
│  ◯ 1:1 Square     (Instagram)        │
└───────────────────────────────────────┘
```

- **9:16 Portrait**: Full-screen vertical video for TikTok, Instagram Reels, YouTube Shorts
- **16:9 Landscape**: Traditional widescreen (current default)
- **1:1 Square**: Instagram feed posts

### How it flows through

1. **UI selector** — new radio group on Podcast page, defaulting to 9:16 (since you mentioned TikTok preference)
2. **Pipeline update** — `aspectRatio` parameter passed to the generation edge function (`infinitetalk-hd` or `avatar-omni-human-1.5` if used)
3. **Video framing** — the AI avatar will be properly framed for vertical/portrait output (head/shoulders centered, not cut off)
4. **History cards** — badge shows `9:16` or `16:9` so you can spot portrait vs landscape videos

### Files to change

- `src/pages/Podcast.tsx` — add `aspectRatio` state (9:16 | 16:9 | 1:1), new AspectRatioPicker component before the Generate button, pass ratio to generation calls
- `src/components/PodcastAspectRatioPicker.tsx` — new radio group with visual icons showing portrait vs landscape preview
- `supabase/functions/[talking-head-function]` — accept `aspectRatio` param and pass to video generation API (most support `aspect_ratio` or similar)
- `src/integrations/supabase/types.ts` — add `aspect_ratio` column to podcast generation tracking table

### Technical notes

- `infinitetalk-hd` (WaveSpeed) supports `aspect_ratio: "9:16"` natively for portrait talking-head
- Preview thumbnail on history cards will render correctly with CSS `aspect-ratio` property
- Bulk generation mode will respect the selected ratio for all queued items

