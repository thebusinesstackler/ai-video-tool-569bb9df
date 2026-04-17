---
name: chatcut-ai-smart-graphics
description: Commercial Director motion graphics for Chatcut AI — GPT-5.2 director brain + GPT-5-mini support brain + layered SmartOverlay treatments
type: feature
---
Chatcut AI's motion graphic system is now a Commercial-Director pipeline:

**Model routing (chatcut-director edge fn):**
- DIRECTOR_MODEL = `openai/gpt-5.2` with `reasoning.effort = "medium"` (or `"high"` when mode includes "direct/commercial/polish/full-pass"). Vision via image_url parts (6-8 keyframes from extractKeyframesFromElement). Swap to `gpt-5.4` in one constant when published.
- SUPPORT_MODEL = `openai/gpt-5-mini` lives in sibling `chatcut-support` edge fn. Tasks: `rewrite_overlay_text`, `suggest_hooks`, `clean_captions`, `generate_metadata`. Tool-calling for structured output, non-streaming.

**New action `add_motion_graphic`** carries director intent: `intent` (hook/stat/benefit/proof/cta/educational/emotional/multi_point) · `treatment` (kinetic_headline/masked_typography/stat_card/side_notes/bullet_stack/quote_pop/cta_lockup/lower_third_pro/floating_note) · `placement` (behind_subject/left_panel/right_panel/lower_third/center_takeover/top_banner/floating_note) · `subjectAction` (none/push_in/shift_left/shift_right/shrink_for_text/cutout_mask) · text/items/subtext/start/duration/style. Always renders DOM via SmartOverlay (no PNG artifacts). Legacy `add_text_card`/`add_full_coverage`/`add_overlay`/`add_animated_graphic` still supported.

**SmartOverlay (src/components/chatcut/SmartOverlay.tsx)** has two paths:
1. Commercial Director (when `treatment` set) — KineticHeadline, MaskedTypography (mix-blend-mode + radial vignette = faked depth, true matting deferred), StatCard, SideNotes, BulletStack, QuotePop, CtaLockup, LowerThirdPro, FloatingNote. `placement` engine maps semantic positions to absolute CSS with 8% safe-zone padding.
2. Legacy compact + full-coverage cards — unchanged for back-compat.

**Decision engine in Marco's prompt:** hook→kinetic_headline+push_in · stat→stat_card+shift_left · educational→side_notes/bullet_stack+shift_left · emotional→floating_note+none · proof→quote_pop · negative space→masked_typography+cutout_mask · CTA→cta_lockup+shrink_for_text · stale >3s→add motion. Five-layer thinking: Footage → Subject Treatment → Information → Atmosphere → CTA.

**UI (ChatcutAI.tsx):** Quick-action chips above chat input — 🎬 Direct this scene · ✨ Punch up hook · 🧹 Clean captions · ⭐ Premium B-roll. OverlayItem extended with intent/treatment/placement/subjectAction. SmartOverlay receives treatment+placement props.

Out of scope (deferred): true person-segmentation matting, raw-audio input to director, paired video-transform tweens for subjectAction.
