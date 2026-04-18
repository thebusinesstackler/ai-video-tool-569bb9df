
The user is asking whether Marco (the Chatcut AI director) can reposition and recreate items on the timeline. Marco himself said he can't update an overlay's position via `update_overlay` — only remove + re-add. The user wants this gap closed.

## What's missing
Looking at the codebase memory and recent edits to `src/pages/ChatcutAI.tsx`:
- Overlays already have a `position` field ({x%, y%}) and a `scale` field — drag-on-video saves to it.
- Marco's tool surface (`chatcut-director` edge fn + action handler in `ChatcutAI.tsx`) has `add_overlay`, `add_motion_graphic`, `update_overlay`, `remove_overlay`, `add_premium_broll_auto`, etc.
- But `update_overlay` evidently doesn't accept `position`, `scale`, `placement`, `treatment`, or timing fields like `start`/`duration` — so Marco resorts to remove+re-add and admits "we don't have position controls exposed."

## Plan — give Marco full timeline control

### 1. Extend `update_overlay` action schema (client + edge fn)
In `supabase/functions/chatcut-director/index.ts` and `ChatcutAI.tsx` action executor, accept these optional fields on `update_overlay`:
- `start`, `duration` — reposition on timeline
- `position: {x, y}` (0–100%) — reposition on video preview
- `scale` (0.5–5)
- `placement` — semantic anchor (lower_third, right_panel, etc.)
- `treatment` — change treatment without recreating
- `text`, `subtext`, `items` — already supported, keep
- `hidden` — toggle preview visibility

### 2. Add matching `update_broll` and `update_motion_graphic` actions
B-roll clips and motion graphics need the same treatment so Marco can untangle overlapping b-roll without delete+regenerate.

### 3. Update Marco's system prompt (chatcut-director)
- Document the new capabilities so Marco stops saying "I can't reposition."
- Add a rule: when fixing overlap, **prefer `update_*` over `remove_*` + `add_*`** to preserve generated assets.
- Teach the placement→position mapping (e.g., `lower_third` ≈ y:80, `right_panel` ≈ x:75).

### 4. Auto-supply Marco with current state
When the user asks Marco to fix the timeline, include in the context payload:
- All overlays/b-roll/motion graphics with `id`, `start`, `duration`, `position`, `placement`, `text`
- The pre-computed overlap sets (`overlapIdsByTrack`) so Marco knows exactly which IDs collide

### 5. Toast feedback
Show a toast when Marco calls `update_overlay` ("Marco moved 'Why raw mushrooms…' to lower-third") so the user sees what changed.

## Files to edit
- `src/pages/ChatcutAI.tsx` — extend action executor, pass overlap state to director payload, add toasts
- `supabase/functions/chatcut-director/index.ts` — extend tool schema for `update_overlay` / add `update_broll` / `update_motion_graphic`, update system prompt with new capabilities + overlap-fix priority

## Out of scope
- Visual diff preview before applying Marco's changes (could be a follow-up)
- Undo stack for Marco's actions (already partially handled by existing history)

## Answer to user's question
**Currently: No** — Marco can recreate but not reposition. After this plan: **Yes** — Marco will be able to update timing, on-screen position, scale, placement, and treatment of any existing overlay/b-roll/motion graphic without deleting it.
