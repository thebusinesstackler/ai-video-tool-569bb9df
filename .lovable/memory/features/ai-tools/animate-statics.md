---
name: Animate Statics
description: Image-to-video tool with bulk mode, retry-on-credit-failure, music library reuse, and history
type: feature
---

'Animate Statics' (src/pages/AnimateStatics.tsx) transforms static images into video creatives:
- **Pipeline**: Gemini 2.5 Pro analysis → wan-2.5-i2v with `[PRESERVE EXACTLY]` + `[TEXT FREEZE]` anchors → optional music
- **Bulk mode**: Multi-select gallery images, sequentially analyze + animate + score music. Supports retry per job and "Retry All Failed" after credit top-ups. Credit errors auto-detected via regex on error message and shown with 💳 hint.
- **Music Library** (`music_library` table): Personal reusable track collection. "Generate 10 Tracks" button creates a curated pack (Cinematic Uplift, Upbeat Pop, Lo-fi Chill, Corporate Clean, Ambient Dream, Dramatic Tension, Hype Trap, Acoustic Warm, Tech House, Epic Trailer). Bulk runs and single projects can attach saved tracks instead of generating fresh ones, saving WaveSpeed credits. Bulk-generated music is auto-saved to library for reuse.
- **History**: All projects persist in `animated_statics` table with status, source image, animation_url, music_url.
