
## What I found in your code

**1. Why your video isn't TikTok-sized (the screenshot shows letterboxing on a 9:16 frame):**
- The "TikTok" dropdown (`targetPlatform`) only controls **safe-zone overlays** (where to avoid placing text). It does NOT switch the preview to 9:16 — that's a **separate** "Smartphone / reel preview" toggle (`reelPreview`). Right now they're decoupled, so picking TikTok doesn't actually rebuild the canvas as 9:16.
- B-roll / motion graphics use whatever `aspectRatio` was active when generated. The Wan 2.5 B-roll path (in `chatcut-director` action `add_premium_broll_auto`) does NOT pass an `aspectRatio` to wavespeed at all — it relies on the prompt prefix. If you uploaded a 16:9 source and switched to TikTok later, no clip is regenerated; the existing clips stay landscape and get letterboxed.
- The animated graphics path (`generate-animated-graphic`) reads `reelPreview ? '9:16' : '16:9'` instead of `targetPlatform`, so toggling TikTok doesn't change the aspect ratio sent to VEO.

**2. Why motion graphics look "like crap":**
- `add_motion_graphic` is FORCED to render mode `dom` (line 1836: `finalRenderMode = isMotionGraphic ? 'dom' : renderMode`). That means EVERY motion graphic Marco emits is just a CSS DOM card — no actual motion model is being used. The fancy `generate-animated-graphic` (Nano Banana 2 + VEO 3.1) is only called for `add_animated_graphic`, which Marco's prompt tells him to use "1–2 per video max". So in practice, you're getting plain text cards everywhere.
- The CTA card at the end (`cta_lockup`) is a plain DOM pill with `whiteSpace: nowrap`. Combined with brand color = light/desaturated and `mix-blend / opacity` on neighboring treatments, it ends up unreadable on bright video backgrounds.

**3. Models in use right now:**
- Static motion graphics (PNG): `google/gemini-3.1-flash-image-preview` (Nano Banana 2)
- Animated motion graphics: VEO 3.1 image-to-video via WaveSpeed
- B-roll: `alibaba/wan-2.5/image-to-video` (Wan 2.5 i2v) at 720p, 3s
- The actual on-screen "Focus, Energy" text in your screenshot is a Wan 2.5 generated clip with text baked into the image — not a motion graphic.

## The plan — 4 fixes

### A. Make the platform dropdown ACTUALLY drive aspect ratio (not just safe zones)
- Wire `targetPlatform` to:
  1. Auto-set `reelPreview = true` for tiktok/reels/shorts/youtube; `false` for youtube-landscape.
  2. Pass `aspectRatio: targetPlatform === 'youtube-landscape' ? '16:9' : '9:16'` everywhere we currently use `reelPreview ? ...`.
- New "Auto-fit" behavior (per your choice): existing B-roll / graphics are NOT regenerated — instead we letterbox them cleanly inside the new frame using `object-contain` with a blurred backdrop (already done for B-roll preview; extend to motion graphic videos that have hard-coded `objectFit: 'cover'` at line 4202).
- Toast a warning so you can decide to regenerate manually: *"Your B-roll was generated for landscape — switching to TikTok will letterbox it. Want to regenerate?"*

### B. Make Marco use REAL animated motion graphics by default (your choice: "Always animated")
- In `chatcut-director/index.ts`: rewrite directives so Marco emits `add_animated_graphic` (VEO 3.1) for ALL hero beats — hooks, stats, CTA, take-overs — instead of `add_motion_graphic`. Reserve `add_motion_graphic` only for low-priority stacked side cards.
- Bump the per-video budget from "1–2 max" → "5–8 hero animations per 30s reel".
- In `ChatcutAI.tsx`: when `add_motion_graphic` is emitted with `intent: hook | stat | cta | proof`, auto-promote it to `add_animated_graphic` so older sessions also benefit.

### C. Redesign the end-frame CTA so it's readable
- Rebuild `CtaLockup` in `SmartOverlay.tsx`:
  - Solid black (rgba 0,0,0,0.78) backing card with brand-color thick border + glow.
  - Headline white, font-weight 900, larger fluid type, `whiteSpace: normal` so it wraps if long.
  - URL chip below in solid brand color.
  - Add a soft full-frame dim layer (rgba 0,0,0,0.35) BEHIND the CTA only when it's at the end-frame (`fullCoverage` or `intent: cta`) so the video underneath doesn't compete.
- Force `treatment: 'cta_lockup'` to render at scale ≥ 2.4 and apply the dim backdrop automatically.

### D. Give B-roll a true 9:16 aspect_ratio at generation time
- In `wavespeed-video` calls inside `chatcut-director` for `add_broll` / `add_premium_broll_auto`: pass `aspect_ratio` derived from `targetPlatform` (`'9:16'` for tiktok/reels/shorts/youtube, `'16:9'` for youtube-landscape) so the model renders the correct frame natively instead of relying on prompt prefix.
- Add a "Regenerate B-roll for current platform" quick-action button (also wired to a Marco action `regenerate_broll_for_platform`) that loops through existing clips and re-fires Wan 2.5 with the right aspect.

## Files I'll edit
1. `src/pages/ChatcutAI.tsx` — link `targetPlatform` ↔ `reelPreview` + aspect ratio everywhere; auto-promote hero graphics to animated; fit-not-crop video graphic rendering; add regenerate-for-platform button.
2. `src/components/chatcut/SmartOverlay.tsx` — redesigned `CtaLockup` (solid card, wrapping text, dim backdrop when fullCoverage).
3. `supabase/functions/chatcut-director/index.ts` — push Marco toward `add_animated_graphic` for hero beats; require `aspect_ratio` from `targetPlatform` on every B-roll prompt; add regenerate action.
4. `supabase/functions/wavespeed-video/index.ts` — accept and forward `aspectRatio` for Wan 2.5 B-roll generations.
5. `.lovable/memory/features/ai-tools/chatcut-platform-aspect-system.md` — new memory documenting the targetPlatform→aspect→reelPreview link.

## Out of scope
- Server-side automatic re-rendering of every existing B-roll on platform switch (that would hit your wavespeed bill hard — the Regenerate button keeps it user-controlled).
- Rebuilding the entire SmartOverlay treatment library — only `cta_lockup` gets the major overhaul; others already render cleanly.
