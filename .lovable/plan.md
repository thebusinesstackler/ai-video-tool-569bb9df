

The user wants to extract frames from their existing Video Repo videos (Lifecykel) and save them as reusable b-roll clips/images that can be selected within Chatcut AI's library picker.

Looking at the codebase:
- `video_repo_projects` table has `generated_video_url` and `segment_urls[]`
- `video_clip_templates` table already exists for storing clip references (start_time/end_time/source_video_url) — perfect fit
- Chatcut AI b-roll library picker is being built (per prior approved plan) to pull from gallery + video repo
- `FrameCapture.tsx` already exists for frame extraction
- `generated_images` already supports saving images with `source` field

## Plan

### 1. Frame Extractor on Video Repo Pro
Add a "Extract Frames" button on each Video Repo Pro project card (and the detail view). Opens a dialog that:
- Plays the project's `generated_video_url`
- Lets user scrub and capture still frames (uses existing FrameCapture pattern — canvas grab from video element)
- Lets user mark in/out points to save short clip ranges (stored in `video_clip_templates` with `category: 'broll'`)
- Captured frames saved to `generated_images` with `source: 'broll-frame'` and `project_id` linking back to the video repo project

### 2. New "B-Roll Library" Sidebar Entry
Add a dedicated page `/broll-library` that shows all extracted frames + clips grouped by source video. User can:
- Browse/preview/delete
- Tag with labels (Lion's Mane, Cordyceps, etc. — Lifecykel-specific)
- Bulk-extract: "Auto-extract 6 frames" button per video that grabs evenly-spaced stills

### 3. Chatcut AI Integration
The b-roll library picker (from prior approved plan) gets a new tab "My B-Roll" that queries:
- `generated_images` where `source='broll-frame'`
- `video_clip_templates` where `category='broll'`
Selecting one inserts it as full-frame replacement during the active scene (per prior approved overlay decision).

### Files to Create/Modify
- NEW `src/pages/BRollLibrary.tsx` — gallery of saved frames/clips, grouped by source video, with labels
- NEW `src/components/FrameExtractorDialog.tsx` — scrubber + capture + auto-extract UI
- MODIFY `src/pages/VideoRepoPro.tsx` — add "Extract Frames" button per project
- MODIFY `src/components/Navigation.tsx` — add B-Roll Library link under Manage
- MODIFY `src/App.tsx` — register `/broll-library` route
- MODIFY `src/components/BRollLibraryPicker.tsx` (from prior plan) — add "My B-Roll" tab
- DB: no schema changes needed — reuse `generated_images.source='broll-frame'` and `video_clip_templates.category='broll'`

### Technical Notes
- Frame capture: canvas.drawImage from `<video>` element → blob → upload to `reels` bucket → save `generated_images` row
- Auto-extract: seek to `duration * (i/N)` for N=6 frames, capture each
- Cross-origin: video URLs from Supabase storage are same-origin-friendly; for external URLs use `crossOrigin="anonymous"` with fallback

