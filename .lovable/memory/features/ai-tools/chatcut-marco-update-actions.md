---
name: chatcut-marco-update-actions
description: Marco's full update actions, motion-vs-overlay track separation, intent-based default placement, and enriched director payload
type: feature
---
Marco (Chatcut director) repositions any timeline item in-place via `update_overlay`, `update_motion_graphic`, and `update_broll` — no remove+re-add for moves.

## Motion vs Overlay track separation
The timeline shows three independent tracks classified by `classifyOverlay()` in `src/pages/ChatcutAI.tsx`:
- **Motion** (purple): items with a `treatment` (Commercial Director graphics) OR `type === 'motion_graphic' | 'animated_text'` OR `renderMode === 'video'`. Marco's `add_motion_graphic` outputs ALWAYS land here regardless of underlying `type`.
- **Image** (blue): static PNG/JPG (`renderMode === 'image'` or has `imageUrl` w/o dom).
- **Overlay** (pink): plain DOM text cards (lower_third, stat_callout, cta_button, quote_pop, etc.).

The classifier prioritizes `treatment` before `type` so commercial director graphics always read as Motion even when their fallback type is `lower_third`.

## Intent-based default placement (fixes "all stuck at bottom")
When `add_motion_graphic` runs and Marco doesn't pass an explicit `position`, the executor in `ChatcutAI.tsx` derives the position in this priority order:
1. explicit `act.position` → wins
2. `placement` mapped via `placementToPos` (top_banner=14%, lower_third=82%, left_panel x22, right_panel x78, etc.)
3. `intent` mapped via `intentToPos` (hook→top, stat→right, benefit→left, cta→bottom-center, proof→center, emotional→floating, educational/multi_point→side panels)
4. generic type defaults

This guarantees motion graphics spread across the canvas instead of stacking at y=85.

## Update actions
**`update_overlay` / `update_motion_graphic`** params: `start`, `duration`, `position {x,y}` (0–100%), `placement` (top_banner|lower_third|left_panel|right_panel|center_takeover|behind_subject|floating_note), `scale` (0.5–5), `treatment` (kinetic_headline|masked_typography|stat_card|side_notes|bullet_stack|quote_pop|cta_lockup|lower_third_pro|floating_note), `text`, `subtext`, `items`, `hidden`. Position wins over placement.

**`update_broll`** params: `start`, `duration`, `audioEnabled`, `name`.

## Enriched director payload (sendMessage in ChatcutAI.tsx → chatcut-director)
Marco receives full directorial intel under `context`:
- **`playback`**: `durationSec`, `playheadSec`, `progressPct`, `aspectRatio`, `acceptedCuts[]`, `skippedSec`
- **`audio`**: `hasNarration`, `wordCount`, `avgWPM`, `fillerCount`, `musicTracks[]`, `trackMutedA1`
- **`brand`**: `vocabulary[]`, `colors {primary,text}`, `font`, `hasLogo`, `websiteUrl`, `vertical`
- **`captions`**: `enabled`, `style`, `fontFamily`, `fontSize`, `fontColor`, `background`
- **`safeZones[]`**: `caption_strip` + `face_assumed`
- **`kpis`**: `hookStrength`, `hookOverlayCount`, `hookHasThumbnail`, `ctaPresent`, `ctaWindowStartSec`, `editsPer10s`
- **`recentAction`**, **`creatorMode`**, **`targetPlatform`**

## Director directives (chatcut-director system prompt)
1. Every new overlay uses `brand.colors.primary` + `brand.font`.
2. Never place an overlay inside a `safeZone`.
3. If `kpis.hookStrength < 7`, prioritize hook fix.
4. If `kpis.ctaPresent === false` and `progressPct > 60`, suggest CTA.
5. Match cut density to `targetPlatform`.
6. **MOTION GRAPHIC PLACEMENT PLAYBOOK**: never default everything to lower_third — use top_banner / left_panel / right_panel / center per intent. Tight copy: hook 4-7 words, stat = number+label, benefit 3-5 words/item.
7. If user complains "all stuck at bottom" or "design is bad" — audit currentMotionGraphics and emit `update_motion_graphic` to redistribute across the canvas.
8. Prefer `update_*` over `remove_*`+`add_*` for moves.

## Files
- `src/pages/ChatcutAI.tsx` — `classifyOverlay` (treatment→motion), executor with intent/placement→position derivation
- `src/components/chatcut/SmartOverlay.tsx` — upgraded StatCard/SideNotes/CtaLockup with gradient backgrounds, larger typography, deeper shadows
- `supabase/functions/chatcut-director/index.ts` — Motion Graphic Placement Playbook section
