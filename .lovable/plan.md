

## Goal
Fix the Extract B-Roll Clips dialog so it (1) opens reliably on first click, (2) shows live extraction progress, (3) previews extracted clips before saving, and (4) clarifies the two extraction modes.

## Root cause of the "have to click back" bug
In `VideoRepo.tsx` / `VideoRepoPro.tsx`, the dialog `open` state likely lives inside the same row as the trigger, and the trigger button sits inside a parent that captures the first click (e.g. card opens an overlay first, then the dialog opens on the second click). I'll confirm by reading those files, but the fix is to stop event propagation on the Extract button and ensure the dialog state is hoisted so it opens immediately.

## New UX for the dialog

**Two clearly labeled modes (tabbed):**

```text
┌─ Extract B-Roll Clips ──────────────────────┐
│ [ Manual: Pick Moments ] [ Auto: Smart Pick ]│
├─────────────────────────────────────────────┤
│ Video preview + scrubber                    │
│                                             │
│ Manual tab:                                 │
│   "Scrub to a moment, click + Add Clip.     │
│    Each clip = 3 seconds around that point."│
│   [+ Add Clip at 0:12]                      │
│                                             │
│ Auto tab:                                   │
│   "We'll grab 6 evenly spaced 3s clips      │
│    across the whole video."                 │
│   [⚡ Auto-extract 6 Clips]                 │
├─────────────────────────────────────────────┤
│ Extracted (3)         [Save Selected to Lib]│
│ ┌──────┐ ┌──────┐ ┌──────┐                 │
│ │ ▶ 0:12│ │ ▶ 0:34│ │ ▶ 1:02│  ← previews  │
│ │  ☑   │ │  ☑   │ │  ☐   │  ← checkbox   │
│ └──────┘ └──────┘ └──────┘                 │
└─────────────────────────────────────────────┘
```

**Flow change:** extraction no longer auto-saves to the gallery. It builds an in-memory preview list. User ticks the ones they like, then clicks **Save Selected to Library** to insert them into `generated_images` as `broll-clip` rows.

**Live progress:** during Auto mode, show a progress bar + "Extracting clip 3 of 6…" using the `onProgress` callback already exposed by `extractBrollFrames`.

## Implementation

1. **`FrameExtractorDialog.tsx`** — major refactor:
   - Add `Tabs` (Manual / Auto) with one-line plain-English explanations under each.
   - Replace immediate-save logic with a local `pendingClips` state holding `{ id, startT, endT, label, selected }`.
   - Manual mode: "+ Add Clip at playhead" appends to pendingClips (no DB write).
   - Auto mode: runs extraction loop with progress UI; populates pendingClips.
   - Each preview card renders a `<video src={url#t=start,end} muted loop>` thumbnail with hover-play, a checkbox, and a remove (×) button.
   - Footer button "Save N Selected to Library" → calls insert logic (extracted from current `extractBrollFrames` into a new `saveBrollClips(pending)` helper) and toasts success.

2. **`extractBrollFrames.ts`** — split into two functions:
   - `planBrollClips(opts)` → returns `{ startT, endT, duration, sourceUrl }[]` (no DB writes), supports `times` or auto-spacing.
   - `saveBrollClips(userId, projectId, clips)` → inserts the user-selected subset into Supabase. Keeps existing JSON metadata format so Chatcut Source Clips panel keeps working.

3. **`VideoRepo.tsx` / `VideoRepoPro.tsx`** — fix the "click twice" bug:
   - Add `onClick={(e) => { e.stopPropagation(); setExtractorOpen(true); }}` to the Extract button.
   - Verify the button isn't inside a clickable card wrapper; if it is, wrap the button in a `<div onClick={e => e.stopPropagation()}>`.

## Files touched
- `src/components/FrameExtractorDialog.tsx` (rewrite)
- `src/lib/extractBrollFrames.ts` (split into plan + save)
- `src/pages/VideoRepo.tsx` (stop click propagation)
- `src/pages/VideoRepoPro.tsx` (stop click propagation)

## Out of scope
- No changes to Chatcut Source Clips panel — saved clips keep the same DB shape so they continue to appear and play there.
- No changes to caption system.

