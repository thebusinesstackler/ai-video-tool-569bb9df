
## What's broken (from screenshots + code review)

**Screenshot 1 — "ON SWITCH" giant text bleeds outside frame**
- That's `masked_typography` treatment (line 209 in SmartOverlay.tsx): `fontSize: clamp(80px, 22vw, 320px)`.
- The 22vw is computed against the **viewport** width, not the preview wrapper. On a 1214px viewport that's ~267px text that easily exceeds the preview's narrow 9:16 frame.
- Wrapper at line 3707 caps width at `min(86vw, 520px)` — but the inner massive text overflows it horizontally because letters are absolutely sized.

**Screenshot 2 — three motion graphics stacked + giant headline cut off**
- "fdcusy" / "focus" headline overlaid on top of two SideNotes cards — Marco placed multiple motions in roughly the same zone.
- Zone collision detection exists but only triggers on ADD, not on Marco's AUDIT pass — and only for items with explicit positions.
- SideNotes default to `right_panel` but here both "Zero jitters" and "No crash" sit center — placement engine being bypassed because outer wrapper pins them to (pos.x, pos.y).
- The kinetic headline's words (`6vw` font) wrap and clip because parent wrapper is too narrow.

## Root causes (3)

1. **Viewport-relative sizing (`vw`/`vh`) inside a contained preview frame.** Every treatment uses `clamp(X, Yvw, Z)` which sizes against window width, not the preview element. This is the #1 cause of "outside the frame."

2. **Wrapper width cap is too generous AND inner text isn't constrained.** `min(86vw, 520px)` allows 86% of viewport on small previews; large headlines and stat numbers overflow because they have no `max-width` themselves.

3. **No safe-zone clamping on user-positioned graphics.** When Marco sets `position: {x: 78, y: 32}` and the card is wide, half of it goes off-screen because we don't clamp position against the rendered card width.

## Plan

### A. Switch sizing from viewport units to container queries
- Wrap the preview in a CSS container (`container-type: inline-size`).
- Replace every `Xvw` in SmartOverlay treatments with `Xcqw` (container-query-width):
  - `MaskedTypography`: `22vw` → `14cqw` (max 180px), opacity 0.6
  - `KineticHeadline`: `6vw` → `5.5cqw` (max 56px)
  - `StatCard` big number: `7vw` → `6cqw`
  - `BulletStack` items: `2vw` / `3.2vw` → `2.4cqw` / `3.6cqw`
  - `CtaLockup`: `3.4vw` → `3.2cqw`

### B. Add hard max-width to every treatment
- KineticHeadline: `maxWidth: '90%'` on the words container
- MaskedTypography: `maxWidth: '90%'`, `wordBreak: 'keep-all'`, `overflow: 'hidden'`
- BulletStack: already has `maxWidth: 720` — add `width: '100%'` and tighten to 90%
- All cards: `maxWidth: 'min(420px, 86%)'`

### C. Smart wrapper sizing per treatment
In `ChatcutAI.tsx` (line 3704-3711), make the wrapper width treatment-aware:
- `masked_typography` / `kinetic_headline` → `width: 'min(88%, 680px)'` (hero text needs room)
- `stat_card` / `lower_third_pro` / `floating_note` → `width: 'min(36%, 280px)'` (compact)
- `side_notes` / `bullet_stack` → `width: 'min(40%, 320px)'`
- `cta_lockup` → `width: 'auto'`, `maxWidth: '70%'`
- `quote_pop` → `width: 'min(60%, 480px)'`

### D. Position clamping (keep graphics in frame)
After computing `pos.x, pos.y` for the outer wrapper, clamp so the graphic respects safe zones:
- Estimate half-width as a % of preview based on treatment (e.g. `stat_card` ≈ 18%, `kinetic_headline` ≈ 44%)
- Clamp `pos.x` to `[halfW + 4, 96 - halfW]`, `pos.y` to `[8, 92]`
- Same for platform-specific safe zones already defined.

### E. Fix stacking — auto-stagger motion graphics independently of overlays
The current `staggeredOverlays` pre-compute groups all overlays together. Split it so motion graphics get their own collision pass per-zone, and re-snap any motion graphic whose collision is detected at *render time* (not just add time). When two motions overlap in the same time window AND their boxes intersect by >30%, push the lower-priority one (later `start`, lower intent priority) to its zone's fallback.

### F. Tighten Marco's prompt
In `chatcut-director/index.ts`:
- Ban using `masked_typography` for words longer than 6 chars (overflows even with cqw).
- Force max 1 motion graphic in `center` zone at any moment.
- When emitting `add_motion_graphic`, REQUIRE `placement` field — never let it default.

## Files to edit
1. `src/components/chatcut/SmartOverlay.tsx` — `cqw` units, max-widths, tighter clamps on every treatment
2. `src/pages/ChatcutAI.tsx` — container-type on preview, treatment-aware wrapper width, position clamping, render-time motion collision re-snap
3. `supabase/functions/chatcut-director/index.ts` — prompt rules for masked_typography length + required placement
4. `.lovable/memory/features/ai-tools/chatcut-marco-update-actions.md` — document container-query sizing system

## Out of scope
- Real-time text measurement (using estimated half-widths is good enough)
- Re-rendering on preview resize beyond what container queries already give for free
- Per-platform font scaling (cqw handles it)
