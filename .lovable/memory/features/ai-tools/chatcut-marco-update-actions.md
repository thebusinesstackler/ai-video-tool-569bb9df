---
name: chatcut-marco-update-actions
description: Marco's full update actions, motion-vs-overlay track separation, intent-based default placement, container-query sizing, and frame-safety clamping
type: feature
---
Marco (Chatcut director) repositions any timeline item in-place via `update_overlay`, `update_motion_graphic`, and `update_broll` — no remove+re-add for moves.

## Container-query sizing system (frame-safety)
The video preview wrapper in `src/pages/ChatcutAI.tsx` sets `containerType: 'inline-size'`. Every motion-graphic treatment in `src/components/chatcut/SmartOverlay.tsx` sizes against this container via `cqw` units instead of `vw`, so big text NEVER overflows the 9:16 / 16:9 preview regardless of viewport size.

Treatment sizing (per SmartOverlay):
- `masked_typography`: `clamp(48px, 14cqw, 180px)`, opacity 0.6, max-width 90%, word-break keep-all
- `kinetic_headline`: `clamp(20px, 5.5cqw, 56px)`, max-width 90%
- `stat_card` big number: `clamp(32px, 6cqw, 78px)`, card max-width `min(420px, 86%)`
- `bullet_stack` items: `clamp(14px, 2.4cqw, 22px)`, container max-width `min(720px, 90%)`
- `cta_lockup`: `clamp(20px, 3.2cqw, 34px)`, max-width `min(420px, 86%)`

## Treatment-aware wrapper width + position clamping (ChatcutAI.tsx)
For every overlay rendered with a `treatment`, the per-overlay wrapper picks a smart width AND clamps the user/Marco-set `position` so the card stays inside the frame:

| treatment | wrapperWidth | half-width % (clamp) |
|---|---|---|
| masked_typography / kinetic_headline | min(88%, 680px) | 44 |
| stat_card / lower_third_pro / floating_note | min(36%, 280px) | 18 |
| side_notes / bullet_stack | min(40%, 320px) | 20 |
| cta_lockup | min(70%, 420px) | 35 |
| quote_pop | min(60%, 480px) | 30 |

`clampedX = max(halfW + 4, min(96 - halfW, pos.x))` and `clampedY = max(8, min(92, pos.y))`. Stack-stagger offset is added on top.

## Motion vs Overlay track separation
The timeline shows three independent tracks classified by `classifyOverlay()`:
- **Motion** (purple): items with a `treatment` OR `type === 'motion_graphic' | 'animated_text'` OR `renderMode === 'video'`. `add_motion_graphic` outputs ALWAYS land here.
- **Image** (blue): static PNG/JPG.
- **Overlay** (pink): plain DOM text cards.

## Intent-based default placement
When Marco doesn't pass explicit `position`, the executor derives it: explicit `act.position` → `placement` mapped → `intent` mapped → generic type defaults.

## Update actions
**`update_overlay` / `update_motion_graphic`** params: `start`, `duration`, `position {x,y}`, `placement`, `scale`, `treatment`, `text`, `subtext`, `items`, `hidden`. Position wins over placement.

**`update_broll`** params: `start`, `duration`, `audioEnabled`, `name`.

## Director directives (chatcut-director system prompt)
1. Brand color/font auto-applied.
2. Never inside safe zones.
3. Hook fix priority when `hookStrength < 7`.
4. CTA suggestion when `ctaPresent === false` and `progressPct > 60`.
5. Cut density matches platform.
6. **MOTION GRAPHIC PLACEMENT PLAYBOOK** — top/left/right/center per intent.
7. Audit + redistribute on user complaints.
8. Prefer `update_*` over `remove_*`+`add_*`.
9. **FRAME-SAFETY RULES**: `masked_typography` only for words ≤ 6 chars; every `add_motion_graphic` MUST include `placement`; max 1 motion graphic in `center_takeover`/`behind_subject` at any moment.
10. On complaints "outside the frame" / "text overflows" / "design is bad" → audit + REPOSITION + REWRITE (shorten copy).

## Files
- `src/pages/ChatcutAI.tsx` — `containerType: 'inline-size'` on video wrapper, treatment-aware wrapper width, position clamping
- `src/components/chatcut/SmartOverlay.tsx` — cqw units, max-widths, word-break on every treatment
- `supabase/functions/chatcut-director/index.ts` — frame-safety rules section
