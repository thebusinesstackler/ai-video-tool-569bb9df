---
name: chatcut-marco-update-actions
description: Marco's full update_overlay/update_motion_graphic/update_broll capabilities — reposition, retime, restyle without remove+re-add
type: feature
---
Marco (Chatcut director) can now reposition any timeline item in-place via `update_overlay`, `update_motion_graphic`, and `update_broll` — no more remove+re-add for moves.

**`update_overlay` / `update_motion_graphic` (same handler, both names accepted)** params:
- `start`, `duration` — timeline reposition
- `position: {x, y}` (0–100%) — exact on-video preview position
- `placement` (top_banner | lower_third | left_panel | right_panel | center_takeover | behind_subject | floating_note) — semantic anchor; auto-maps to position unless `position` also passed (position wins)
- `scale` (0.5–5)
- `treatment` (kinetic_headline | masked_typography | stat_card | side_notes | bullet_stack | quote_pop | cta_lockup | lower_third_pro | floating_note)
- `text`, `subtext`, `items`, `hidden`

**`update_broll`** params: `start`, `duration`, `audioEnabled`, `name`.

**Director payload enrichments (sendMessage in ChatcutAI.tsx):**
- Each `currentOverlays[]` now includes `position`, `scale`, `placement`, `treatment`, `overlaps:boolean`
- Each `currentBRoll[]` includes `overlaps:boolean`
- New top-level `context.overlapping = { broll, motion, image, overlay }` — pre-computed id arrays from `overlapIdsByTrack` so Marco can act on collisions in one pass.

**Prompt rule (chatcut-director STEP 4):** PREFER `update_*` OVER `remove_*` + `add_*`. Two overlapping overlays → reposition one to a different `placement` instead of deleting. Only remove on true duplicates.

**Toast feedback:** `update_overlay` shows "Marco moved 'Why raw mushrooms…' → lower third · 38.4s · 5.2s" so the user sees what changed.

Files: `src/pages/ChatcutAI.tsx` (executor + payload), `supabase/functions/chatcut-director/index.ts` (schema + prompt).
