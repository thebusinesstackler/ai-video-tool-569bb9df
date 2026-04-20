---
name: Google Flow Mode (Veo 3 multi-shot)
description: Video Repo Pro multi-shot Veo 3 pipeline with shared character/setting Bible, parallel generation, and Creatomate auto-stitch
type: feature
---
Video Repo Pro (`src/pages/VideoRepoPro.tsx`) supports a Google Flow-style workflow built on Google Veo 3:

- **Engine picker** (`src/components/VideoRepoEngineSelector.tsx`): Sora-2 / Veo 3 / Wan 2.5 (Wan currently routes to Sora-2 as a placeholder).
- **Flow Mode** (Veo 3 only): 2-6 sequential 8-second shots auto-stitched into one continuous video. Hard-capped at 6 shots (48s).
- **Shared Bible**: `supabase/functions/generate-flow-bible` (Lovable AI Gateway, `google/gemini-3-flash-preview`, `response_format: json_object`) returns `{ bible: { character, wardrobe, setting, lighting, voiceTone, audioStyle }, shots: [{ shotNumber, prompt, dialogue }] }`. The Bible is restated inside every shot prompt to lock identity across clips.
- **Generation**: all shots dispatched in parallel via `wavespeed-video` (`model: 'veo3'`, 8s, native audio always on per user choice). Polling reuses the existing 5s interval / 150-attempt loop.
- **Stitch**: `creatomate-stitch` + `creatomate-status` polling (5-min cap). Falls back to the first clip if cloud stitching fails.
- **Persistence**: `video_repo_projects` gained `engine TEXT`, `flow_mode BOOLEAN DEFAULT false`, `flow_shot_count INTEGER`. `segment_urls` stores per-shot URLs so individual shots remain re-rollable.
- **UX**: Engine picker sits inside the composer toolbar above aspect-ratio/duration selects. After a successful Flow run, both `nextGenerationModel` and `flowMode` reset to defaults. The result message includes the stitched video + every individual shot for download.
