---
name: chatcut-phase4-variants-platforms
description: Phase 4 — A/B variant generator (hooks/CTAs/positions) + per-platform UI safe zones (TikTok/Reels/Shorts/YouTube)
type: feature
---
# Chatcut AI Phase 4 — A/B Variants + Platform Safe Zones

## Per-platform safe zones
- `PLATFORM_SAFE_ZONES` const in `src/pages/ChatcutAI.tsx` defines rectangles (x/y/w/h in %) for `tiktok` (username + right-rail + bottom-nav + top-search), `reels` (username + caption + right-rail + top-bar), `shorts` (username + caption + right-rail + subscribe + progress), `youtube` (player chrome + end-screen zone), `youtube-landscape`.
- `getActiveSafeZones()` merges platform zones + caption strip (when enabled) + assumed face zone.
- Marco reads them in `context.safeZones[]` and `context.targetPlatform`.
- Toggleable visual overlay renders dashed red rectangles on the preview (button next to reel-preview button + native `<select>` for platform).

## A/B variant system
- `OverlayVariantSet` interface: `{ id, kind, label?, items[], activeIndex }`. `kind` ∈ `hook | cta | overlay_position | overlay_text`.
- `items[]` are full overlay snapshots; only `items[activeIndex].overlay` is rendered on the canvas.
- Variants persist in `chatcut_drafts.timeline_state.variantSets`.

### Marco actions (Directives #14-15)
- `set_platform` — `{platform}` (auto-toggles reelPreview on/off)
- `toggle_safe_zones` — `{show?}`
- `add_ab_variant` — `{kind, label?, baseOverlay? | overlayId?, variants:[{label, text?, position?, scale?, style?, treatment?, start?, duration?}]}` (3 by default, max 5)
- `set_active_variant` — `{variantSetId, index}`
- `remove_variant_set` — `{variantSetId}`

## Files touched
- `src/pages/ChatcutAI.tsx` — types (`TargetPlatform`, `OverlayVariantSet`), state, `PLATFORM_SAFE_ZONES`, `getActiveSafeZones`, executor cases, draft persist, visual safe-zone overlay, platform `<select>` + Square toggle button
- `supabase/functions/chatcut-director/index.ts` — Directives #14 (platform safe zones) + #15 (A/B variants)
