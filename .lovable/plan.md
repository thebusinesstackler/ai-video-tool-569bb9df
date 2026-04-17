

## Goal

Make B-Roll extraction discoverable everywhere in Video Repo + Video Repo Pro, paginate History to 9 per page, allow loading any history video into Chatcut (which will auto-extract & save B-roll if missing), and add a "Extract B-Roll" button next to "Sync from database".

## Changes

### 1. `src/pages/VideoRepoPro.tsx`
- **Project Details header**: Add an `Extract B-Roll Frames` button (Scissors icon) next to `Timeline`, opening `FrameExtractorDialog` with the generated video.
- **Generated Video card**: Add the same button under the video preview (so it's visible inside details, matching the screenshot expectation).
- **History tab toolbar**: Beside `Sync from database`, add `Extract B-Roll (latest)` → opens picker on the most recent generated video, plus a small helper that lets users batch-extract from the currently shown page.
- **Pagination**: Add `historyPage` state, `PAGE_SIZE = 9`, slice `historyProjects`, and render `Prev / Page X of Y / Next` controls below the grid. Reset to page 1 on Sync.

### 2. `src/pages/VideoRepo.tsx`
- **Project Details**: Surface the existing `Extract B-Roll Frames` button up in the action row alongside `Remix` / `Send to Chatcut`.
- **History tab**: Add the same `Sync from database` + `Extract B-Roll (latest)` toolbar (currently missing here) and 9-per-page pagination.

### 3. `src/pages/ChatcutAI.tsx` — auto B-roll on load
- After a video loads (from upload, draft, or `vizard-to-chatcut` payload that now includes `projectId`), check if any `bRollClips`/saved frames exist for that source.
- If none and the payload carries a `videoUrl` + `projectId`/`sourceLabel`, **auto-trigger frame extraction** (call the same logic `FrameExtractorDialog` uses — auto-extract 6 evenly-spaced frames, save to `generated_images` with `source: 'broll-frame'`), then refresh `savedBrollFrames` and notify Marco via a system message: *"I extracted 6 B-roll frames from your source — drop any onto the timeline."*
- Add an **"Extract B-Roll from source"** button in the Chatcut media panel header so the user can trigger it manually anytime.

### 4. `handleSendToChatcut` (both VideoRepo files)
- Extend the `vizard-to-chatcut` sessionStorage payload with `projectId` and `autoExtractBroll: true` so Chatcut knows to run the auto-extract on load.

### 5. Reusable extraction helper
- Pull the auto-extract-6 logic out of `FrameExtractorDialog` into `src/lib/extractBrollFrames.ts` (canvas seek → blob → upload to storage → insert into `generated_images`) so Chatcut and the history toolbar can call it without mounting the dialog.

## UX Notes
- "Extract B-Roll" button uses the existing `Scissors` (or `Sparkles`) icon and a tooltip: *"Save still frames to your B-Roll Library for use in Chatcut AI."*
- Pagination is hidden when there's only one page.
- Loader/toast feedback during auto-extract so it doesn't feel silent.

## Files touched
- `src/pages/VideoRepoPro.tsx`
- `src/pages/VideoRepo.tsx`
- `src/pages/ChatcutAI.tsx`
- `src/lib/extractBrollFrames.ts` (new)
- `src/components/FrameExtractorDialog.tsx` (refactor to use the new helper)

<lov-actions>
<lov-suggestion message="Looks good — implement the plan.">Approve & implement</lov-suggestion>
<lov-suggestion message="Implement the plan, but make pagination 12 per page instead of 9 and add a search box at the top of History to filter by name.">Approve with 12/page + search</lov-suggestion>
<lov-suggestion message="Implement the plan, and also have Marco proactively message me in Chatcut listing the auto-extracted B-roll frames as clickable chips I can one-tap onto the timeline.">Approve + Marco B-roll chips</lov-suggestion>
</lov-actions>

