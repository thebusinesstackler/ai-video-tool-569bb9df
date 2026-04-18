---
name: chatcut-marco-update-actions
description: Marco's full update actions + enriched director payload (playback/audio/brand/captions/safeZones/kpis/intent)
type: feature
---
Marco (Chatcut director) can reposition any timeline item in-place via `update_overlay`, `update_motion_graphic`, and `update_broll` — no remove+re-add for moves.

## Update actions
**`update_overlay` / `update_motion_graphic`** params: `start`, `duration`, `position {x,y}` (0–100%), `placement` (top_banner|lower_third|left_panel|right_panel|center_takeover|behind_subject|floating_note), `scale` (0.5–5), `treatment` (kinetic_headline|masked_typography|stat_card|side_notes|bullet_stack|quote_pop|cta_lockup|lower_third_pro|floating_note), `text`, `subtext`, `items`, `hidden`. Placement auto-maps to position unless `position` also passed (position wins).

**`update_broll`** params: `start`, `duration`, `audioEnabled`, `name`.

## Enriched director payload (sendMessage in ChatcutAI.tsx → chatcut-director)
Marco now receives full directorial intel under `context`:
- **`playback`**: `durationSec`, `playheadSec`, `progressPct`, `aspectRatio` (9:16/16:9/1:1), `acceptedCuts[]`, `skippedSec`
- **`audio`**: `hasNarration`, `wordCount`, `avgWPM` (target 120–180), `fillerCount` (um/uh/like/basically/actually), `musicTracks[]`, `trackMutedA1`
- **`brand`**: `vocabulary[]`, `colors {primary,text}`, `font`, `hasLogo`, `websiteUrl`, `vertical` (wellness=Lifecykel | healthcare=TheraNovex | general)
- **`captions`**: `enabled`, `style`, `fontFamily`, `fontSize`, `fontColor`, `background`
- **`safeZones[]`**: x/y/width/height (% of preview) — `caption_strip` (only when captions on) + `face_assumed`
- **`kpis`**: `hookStrength` (0–10, target ≥7), `hookOverlayCount`, `hookHasThumbnail`, `ctaPresent`, `ctaWindowStartSec` (last 15%), `editsPer10s` (target 2–5)
- **`recentAction`**: `{label}` of last undoable Marco action
- **`creatorMode`**: 'quick'|'beginner'|'advanced'
- **`targetPlatform`**: 'reels-shorts-tiktok' (when reelPreview) or 'youtube-landscape'

Existing context fields kept: `currentBRoll`, `currentOverlays` (with position/scale/placement/treatment/overlaps), `overlapping {broll,motion,image,overlay}`, `currentThumbnail`.

## Director directives (chatcut-director system prompt)
1. Every new overlay uses `brand.colors.primary` accent + `brand.font`.
2. Never place an overlay inside a `safeZone` rectangle.
3. If `kpis.hookStrength < 7`, prioritize hook fix before anything else.
4. If `kpis.ctaPresent === false` and `playback.progressPct > 60`, proactively suggest CTA lockup with `brand.websiteUrl`.
5. Flag pacing if `audio.avgWPM` outside 120–180.
6. Match cut density to `targetPlatform` (Reels=more punchy, YouTube=fewer/longer).
7. Skip the timeline-overlap audit for any pinned id (📎 line).
8. Prefer `update_*` over `remove_*`+`add_*` for moves.

## Files
- `src/pages/ChatcutAI.tsx` — payload builder (sendMessage), update_* executors, `useCreatorMode` import
- `supabase/functions/chatcut-director/index.ts` — destructures context.playback/audio/brand/captions/safeZones/kpis/recentAction/creatorMode/targetPlatform and emits a single "🎬 DIRECTOR INTEL" system message
