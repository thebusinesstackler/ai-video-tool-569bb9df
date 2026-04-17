---
name: chatcut-ai-smart-graphics
description: Brand-aware DOM SmartOverlay + Nano Banana 2 image fallback + VEO 3.1 animated hero graphics for Chatcut AI
type: feature
---
Chatcut AI's motion graphic system has THREE render modes:
1. **DOM (default)** — `<SmartOverlay>` (src/components/chatcut/SmartOverlay.tsx) renders crisp brand-coloured cards instantly: stat_callout, benefit_chip, benefit_list, numbered_list, feature_grid, comparison, quote_pop, lower_third, cta_button, title_card. Used by `add_text_card` / `add_full_coverage`.
2. **Image** — Nano Banana 2 (`google/gemini-3.1-flash-image-preview`) static PNG via `generate-motion-graphic` edge function. Reserved for genuine illustrations (icons, product chips). Triggered by `add_overlay` with `renderMode:"image"`.
3. **Video (premium)** — Animated VEO 3.1 motion graphic via `generate-animated-graphic` edge function. Pipeline: Nano Banana 2 generates transparent start + end frames in parallel → VEO 3.1 image-to-video animates the reveal (~30-60s render). Triggered by `add_animated_graphic` action. Used for 1-2 hero moments per video (big stat drops, product reveals, full-coverage takeovers, outro logo stings). OverlayItem stores `videoUrl`, `videoStatus`, `startFrameUrl`, `endFrameUrl`, `animationPrompt`. Renderer plays the MP4 with autoplay+loop+muted.

Marco's prompt includes a DECISION TREE: routine text → DOM, illustrations → image, hero/cinematic → animated. Aspect ratio defaults to 9:16 when reelPreview is on, else 16:9. Brand colour/font is injected from Settings → applied to all three modes.
