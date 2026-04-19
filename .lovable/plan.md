
## Plan — 6 upgrades to Chatcut AI

### 1. Hold-to-delete on the timeline (safer destructive actions)
- New `HoldToDelete` button component: standard trash icon, but requires a 700ms press-and-hold to fire. Visual progress ring fills around the icon during hold; releasing early cancels.
- Replace every timeline delete button (clip, scene, overlay, motion graphic, B-roll, transition, punch-in, audio track) with this component in `ChatcutAI.tsx` and the chip strips.
- Tooltip: "Hold to delete".
- Files: `src/components/ui/hold-to-delete.tsx` (new), `src/pages/ChatcutAI.tsx` (replace inline trash buttons).

### 2. Smart aspect system — true reframing, not blind crop
- Extend the existing `targetPlatform` ↔ `aspectRatio` ↔ `reelPreview` link:
  - Add `square` (1:1) to the platform list with safe zones.
  - When the source video aspect doesn't match the platform aspect, Marco automatically suggests one of three reframe modes per scene: **A) PiP actor on bottom + visual on top**, **B) blurred letterbox**, **C) auto-pan tracking the speaker's detected face center**.
- Files: `src/pages/ChatcutAI.tsx` (extend `PLATFORM_SAFE_ZONES`, add `square` to dropdown), `supabase/functions/chatcut-director/index.ts` (Marco directive: when source aspect ≠ target, choose reframe mode per scene).

### 3. TikTok-native PiP layout — Marco picks per scene
- New action `set_scene_layout`: `{ start, duration, layout: 'pip_actor_bottom_circle' | 'pip_actor_bottom_strip' | 'pip_actor_floating_card' | 'fullscreen_actor' | 'fullscreen_broll', actorScale?, actorPosition? }`.
- Renderer: a new layer in `ChatcutAI.tsx` reads the active layout for the current timestamp and applies CSS transforms to the main `<video>` (scale + translate to bottom band) while a B-roll/visual layer fills the top region.
- Marco prompt update: he chooses layout per beat (reaction → bottom circle, demo → bottom strip, screenshot moment → floating card, hook → fullscreen actor).
- Files: `src/pages/ChatcutAI.tsx` (state `sceneLayouts`, derived `activeSceneLayout` via useMemo, render layer over video), `supabase/functions/chatcut-director/index.ts` (new action + directive).

### 4. Graphic fallbacks — clarity over forced motion design
- In `ChatcutAI.tsx`: when an animated graphic generation FAILS (timeout, empty url, error), automatically downgrade to a clean DOM `cta_lockup` or `full_card` treatment instead of leaving the timeline with a broken visual.
- Marco directive: if you considered a motion graphic but the line lacks emphasis-worthy phrasing, default to `treatment: 'full_card' | 'clean_caption' | 'screenshot_callout'` instead.
- Files: `supabase/functions/chatcut-director/index.ts`, `src/pages/ChatcutAI.tsx` (animated-graphic failure handler).

### 5. Brand-from-URL analyzer (in Settings, runs once)
- New edge function `analyze-brand-website` powered by Firecrawl `scrape` with `formats: ['markdown', 'branding', { type: 'json', prompt: 'Extract: tone, voice, audience, offer, recurring phrases, premium/playful/clinical/direct-response feel, key benefits, CTA style, trust signals' }]`.
- Stores result on existing `profiles.brand_description` + new `profiles.brand_url` and `profiles.brand_analysis` (jsonb) — needs migration.
- UI: in `src/pages/Settings.tsx`, an "Analyze my website" input + button. On success → toast + show extracted summary chips (tone, audience, palette, fonts).
- Already auto-injected into Chatcut via the existing brand-context pipeline — no Chatcut-side wiring needed.
- Requires Firecrawl connector to be enabled.
- Files: `supabase/functions/analyze-brand-website/index.ts` (new), migration to add `brand_url` + `brand_analysis` columns, `src/pages/Settings.tsx` (UI).

### 6. Marco vision — keyframes + on-edit (Medium tier)
- On video load: extract 6 keyframes (already done by `extractKeyframesFromElement`), send to a new edge function `analyze-frame-vision` (Gemini 2.5 Flash multimodal) → returns per-frame: subject position (left/center/right), face bbox %, dominant negative-space side, busy/calm rating, dominant colors. Cache in `chatcut_drafts.timeline_state.visionAnalysis`.
- Per Marco edit: extract 1 frame at the current playhead, send to the same function, append result to Marco's context as `currentFrameVision`.
- Marco prompt update: NEW pre-flight rule — "before placing any graphic, READ `context.currentFrameVision` (subject position, negative space side, busy/calm) and choose `placement` accordingly. If subject is left → text right. If frame is busy → use `full_card` instead of overlay."
- Files: `supabase/functions/analyze-frame-vision/index.ts` (new), `src/pages/ChatcutAI.tsx` (auto-analyze on load + per-edit; pass into director payload), `supabase/functions/chatcut-director/index.ts` (consume vision).

### Files I'll create
- `src/components/ui/hold-to-delete.tsx`
- `supabase/functions/analyze-brand-website/index.ts`
- `supabase/functions/analyze-frame-vision/index.ts`
- migration: `profiles.brand_url text`, `profiles.brand_analysis jsonb`
- `.lovable/memory/features/ai-tools/chatcut-vision-pip-and-safety.md`

### Files I'll edit
- `src/pages/ChatcutAI.tsx` — replace deletes, add `square`, add `sceneLayouts` + renderer, vision wiring, animated-graphic failure fallback.
- `supabase/functions/chatcut-director/index.ts` — `set_scene_layout` action + directive, vision-aware pre-flight, motion-graphic fallback rule, square platform.
- `src/pages/Settings.tsx` — brand URL analyzer UI.

### Out of scope
- True person-segmentation matting for PiP (we use a soft circular CSS mask + drop-shadow).
- Auto-cropping the actor pixel-by-pixel (CSS transform repositions the whole frame).
- Live AI face-tracking during playback (vision runs at edit time, not every frame).
