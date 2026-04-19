---
name: Chatcut Platform Aspect System
description: targetPlatform is the single source of truth for aspect ratio in Chatcut AI — drives reelPreview, B-roll generation, and animated graphic aspect
type: feature
---

`targetPlatform` (tiktok | reels | shorts | youtube | youtube-landscape) is the single source of truth for aspect ratio across Chatcut AI. Switching the platform dropdown:

1. Auto-toggles `reelPreview` (true for everything except `youtube-landscape`).
2. Forwards `aspectRatio: '9:16' | '16:9'` to:
   - `generate-animated-graphic` (VEO 3.1)
   - `generate-scene-image` (B-roll stills)
   - `wavespeed-video` (Wan 2.5 i2v B-roll) — `aspect_ratio` now passed natively, no longer relies only on prompt prefix.
3. Existing B-roll is NOT auto-regenerated (cost protection). Instead a "Regen B-roll" toolbar button + toast lets the user opt in.

**Hero motion-graphic auto-promotion:** any `add_motion_graphic` with `intent` of `hook | stat | cta | proof` is auto-promoted to `add_animated_graphic` (VEO 3.1) at execution time. DOM cards remain for stacked side notes / lower thirds / educational lists.

**CTA lockup:** redesigned with solid black backing card, thick brand-colour border + glow, white wrapping headline (no clipping), brand-colour URL chip, and a dim full-frame backdrop when `fullCoverage` or `placement === 'center_takeover'`.
