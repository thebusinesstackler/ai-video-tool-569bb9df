

## Plan: Enhance Content Calendar PDF + History Actions + Timeline Editor

Three feature areas to implement:

---

### 1. Content Calendar PDF — Add Script & Hook

**File:** `src/components/ContentCalendarTab.tsx`

The PDF already shows the hook and script (lines 248-250), but they can be truncated or missing. Updates:
- Make the hook more prominent with larger font and a "HOOK:" label
- Show the full script text (not truncated) with a clear "SCRIPT:" section header
- Ensure both are always visible even when no thumbnail exists

---

### 2. History Cards — "Generate Another Version" Button

**File:** `src/pages/VideoRepoPro.tsx`

Add a new action button to the history card hover actions (around line 1383-1411):
- Add a **"Generate New Version"** button (RefreshCw icon) that loads the project's reference assets and prompt back into the Create tab (similar to `remakeWithEdits` but auto-triggers analysis)
- Add an **"Extend Video"** button (visible only for completed projects) that analyzes whether the hook is fully captured in the video and triggers a video extension if needed — this will call the existing `wan-2.5/video-extend` pipeline

Also add these buttons to the **selected project detail view** (around line 1017).

---

### 3. Timeline Editor on Edit Click

**File:** `src/pages/VideoRepoPro.tsx`

When clicking a completed project in history, the detail view currently shows a simple side-by-side of reference vs generated video. Enhance it:
- Add an **"Edit on Timeline"** button in the detail view
- When clicked, show a timeline editor component that displays the video segments on a scrubable timeline with:
  - Visual waveform/segment representation
  - Play/pause transport controls
  - Segment markers showing the two stitched clips
  - Ability to trim start/end of each segment
- Reuse patterns from the existing `TimelineEditor` component (`src/components/TimelineEditor.tsx`) adapted for the Video Repo Pro two-segment structure

---

### Files to modify
1. **`src/components/ContentCalendarTab.tsx`** — Enhance `downloadPDF` function to show hook and script more prominently
2. **`src/pages/VideoRepoPro.tsx`** — Add "Generate New Version" and "Extend Video" buttons to history cards + detail view; add timeline editor mode to the detail view

### New file
3. **`src/components/VideoRepoTimeline.tsx`** — Timeline editor component for Video Repo Pro projects, showing segment markers, transport controls, and trim handles

