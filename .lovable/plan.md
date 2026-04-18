
The user has three distinct complaints about motion graphics in Chatcut AI:

1. **Placement is broken** — all motion graphics stuck at the bottom, not respecting Marco's intended placements (top_banner, left_panel, right_panel, center_takeover, behind_subject, floating_note).
2. **Design is bad** — needs better prompting and visual quality.
3. **Categorization is wrong** — motion graphics are being lumped in with overlays. They should be a SEPARATE timeline track called "Motion" so Marco can manage them independently.

Let me investigate the current state before planning.

## Investigation needed
- `src/pages/ChatcutAI.tsx` — how overlays vs motion graphics are stored/rendered/tracked
- `src/components/chatcut/SmartOverlay.tsx` — the placement engine and design treatments
- `supabase/functions/chatcut-director/index.ts` — Marco's prompt re: placement
- `src/components/chatcut/TimelineOverlayTrack.tsx` — timeline rendering

## Hypothesis
Looking at recent memory:
- `chatcut-marco-update-actions.md` says placement maps to position UNLESS position passed (position wins).
- `chatcut-ai-smart-graphics.md` says SmartOverlay has a placement engine mapping semantic positions to absolute CSS with 8% safe-zone padding.

Likely root causes:
1. Overlays and motion graphics share the same `overlays` array — there's no separate `motionGraphics` array on the timeline. Marco's `add_motion_graphic` action probably just pushes into `overlays` with a `kind: 'motion'` flag.
2. The placement engine in SmartOverlay may have a bug where unset placement defaults to `lower_third` (bottom).
3. When Marco emits motion graphics, he's defaulting `placement: lower_third` because the prompt encourages it.
4. The visual design quality needs tighter prompts AND better CSS treatments (padding, shadows, gradient backgrounds).

## Plan

### Part A — Separate Motion track from Overlay track
1. **Data model** (`src/pages/ChatcutAI.tsx`):
   - Already have `OverlayItem` with optional flags. Introduce a clear `kind: 'text' | 'motion'` discriminator (default existing items to `'text'`).
   - Keep one array `overlays` BUT split rendering & timeline display by kind. Alternative: introduce separate `motionGraphics` state. **Decision: split into two arrays** — `overlays` (text/captions) and `motionGraphics` (designed cards, kinetic, stat cards, CTAs). This is what the user is asking for.
   - Migrate executor: `add_overlay` → push to `overlays`. `add_motion_graphic` → push to `motionGraphics`. `update_overlay` / `update_motion_graphic` → target correct array. `remove_*` likewise.
   - Persist both arrays in `chatcut_drafts.timeline_state`.

2. **Timeline UI** (`src/components/chatcut/TimelineOverlayTrack.tsx` + parent):
   - Render TWO distinct tracks in the timeline: "Overlays" (T) row and "Motion" (M) row, each with their own color (overlays=blue, motion=purple).
   - Each track is independently draggable / resizable.

3. **Preview rendering**:
   - Render motion graphics ABOVE overlays in z-index so they read as hero graphics.
   - Both still go through SmartOverlay, but motion items get the Commercial Director treatment path always (force `treatment` if missing).

### Part B — Fix placement so Marco can place ANYWHERE
1. **SmartOverlay placement engine**:
   - Currently: placement string → fixed CSS coordinates. PROBLEM: when Marco passes `placement: lower_third` for everything, they all stack at bottom.
   - Fix: when `position` is explicitly set (x,y in 0-100%), USE IT and IGNORE placement preset. Currently this should work but verify.
   - Add a wider variety of preset placements: `top_left`, `top_right`, `top_center`, `middle_left`, `middle_right`, `center`, `bottom_left`, `bottom_right`, plus existing semantic ones.
   - Default placement for motion graphics: stop defaulting to `lower_third`. Use `top_banner` for hooks, `right_panel` for stats, `center` for CTAs based on `intent`.

2. **Marco's prompt** (`supabase/functions/chatcut-director/index.ts`):
   - Add explicit instruction: "You can place graphics ANYWHERE. Use the full canvas. Default placements by intent:
     - hook → top_banner
     - stat → right_panel or stat_card center
     - benefit → left_panel or right_panel rotation
     - proof/quote → center
     - cta → center_takeover or bottom_center
     - educational/multi_point → side panels
     - emotional → floating_note off-center"
   - Add: "Never stack 2+ motion graphics in the same placement zone unless they're sequential in time."
   - Add: "When user complains 'all at bottom', proactively reposition using update_motion_graphic with new `position` coords."
   - Add: "Use `position: {x, y}` (0-100%) for precise placement when needed — this overrides placement presets."

### Part C — Better visual design
1. **SmartOverlay treatments** (`src/components/chatcut/SmartOverlay.tsx`):
   - Tighten typography: bigger, bolder, better letter-spacing on KineticHeadline.
   - Add subtle gradient backgrounds (brand color → transparent) to StatCard, SideNotes, BulletStack so they feel premium not flat.
   - Add backdrop-blur to card backgrounds so they read over busy footage.
   - Add subtle entrance animation (slide+fade) so they feel motion-graphic-y.
   - Add brand-colored accent bars/underlines on CTA and StatCard.
   - Rounded corners more aggressive (rounded-2xl), drop shadows for depth.
   - Add max-width constraints per placement so text doesn't sprawl.

2. **Marco's prompt** for motion graphic content:
   - "Keep text TIGHT: hook = 4-7 words, stat = number + 2-3 word label, benefit = 3-5 words. NEVER paragraphs."
   - "subtext is optional and max 6 words."

### Part D — Memory update
Update `mem://features/ai-tools/chatcut-marco-update-actions.md` to document the split.

## Files to edit
1. `src/pages/ChatcutAI.tsx` — split state, executors, timeline rendering, persistence, payload to Marco
2. `src/components/chatcut/SmartOverlay.tsx` — placement engine + visual treatments
3. `src/components/chatcut/TimelineOverlayTrack.tsx` — separate Motion track
4. `supabase/functions/chatcut-director/index.ts` — placement directives + design directives
5. `.lovable/memory/features/ai-tools/chatcut-marco-update-actions.md` — document split

## Out of scope
- Drag-and-drop reordering between Overlay and Motion tracks (user can delete + re-add)
- Animated entrance/exit timing controls per item
- Custom user-uploaded graphic templates

## Risk
- Existing drafts have everything in `overlays`. On load, auto-migrate items with `treatment` set → move to `motionGraphics` array. Items without treatment stay in overlays. This is a one-time migration on draft load.
