---
name: chatcut-phase2-collisions-transitions
description: Phase 2 — motion-zone collision detection (auto-snap on add + Marco audit) and scene transitions (fade/dip/zoom/speed_ramp/whip)
type: feature
---
# Chatcut AI Phase 2 — Collisions + Transitions

## Motion-zone collision detection (`src/pages/ChatcutAI.tsx`)
The canvas is bucketed into 9 named zones — `top-left`, `top-center`, `top-right`, `mid-left`, `center`, `mid-right`, `bottom-left`, `bottom-center`, `bottom-right` — via `zoneOfPosition({x,y})` (35/65 thresholds on each axis).

**Detection:** `motionZoneCollisions` memo flags any pair of motion overlays that share a zone AND a time window > 0.05s. Non-fullCoverage + non-hidden only.

**Auto-snap on add:** when Marco emits `add_motion_graphic`, `findFreeMotionZone(desiredZone, start, end)` walks a per-zone fallback chain (e.g. `top-center → top-right → top-left → mid-right → mid-left`) and returns the first unoccupied zone for that window. If snap fires, a toast tells the user "Moved X from top-center → top-right so it doesn't stack."

**Marco payload (`context.motionZoneCollisions`):**
- `ids[]` — every overlay id involved in a collision
- `pairs[]` — `{a, b, zone, overlapStart, overlapEnd}` so Marco can act per-conflict
- `zoneByMotionId{}` — current zone for every motion overlay

Directive #9 in `chatcut-director` system prompt forces Marco to emit `update_motion_graphic` on the WEAKER side of each pair to relocate it.

## Scene transitions
New `Transition` interface + `transitions` state (persisted in `chatcut_drafts.timeline_state.transitions`).

**Kinds:** `fade` (quick black flash 0.3-0.5s), `dip_to_black` (longer hold 0.8-1.2s for ACT breaks), `zoom` (punch on stat/hero), `speed_ramp` (rate 0.4-0.6 = slow-mo, 1.5-2 = sprint), `whip` (lateral motion blur).

**Render:** `activeVisualTransition` memo picks the transition covering `currentTime`. A z-[35] absolute layer over the preview wrapper applies the right CSS effect (opacity dip / blur+translate / inset shadow + scale punch). Pointer-events stay off so overlays remain interactive. `speed_ramp` uses a separate `useEffect` that writes `videoRef.current.playbackRate`.

**Executor cases:** `add_transition`, `update_transition`, `remove_transition` (all clamp duration to 0.15-3s).

**Timeline UI:** new amber "Transitions" row above the Motion track; each transition is a clickable amber chip with × on hover.

**Marco actions (Directive #10):**
```actions
[{"action":"add_transition","kind":"fade","at":6.2,"duration":0.4,"label":"hook→problem"}]
[{"action":"add_transition","kind":"speed_ramp","at":18,"duration":1.5,"rate":0.5,"label":"slow-mo CTA"}]
```

## Files
- `src/pages/ChatcutAI.tsx` — `Transition` interface, state, `zoneOfPosition`/`motionZoneCollisions`/`findFreeMotionZone`/`zoneToPosition`, executor cases, payload sections, preview render layer, timeline marker row
- `supabase/functions/chatcut-director/index.ts` — Directives #9 (zone collisions) and #10 (transitions)
