

## Vizard — Long Video to Short Clips Page

### What it does
A new `/vizard` page where users upload a long-form video, the system transcribes it, uses AI to find the best viral-worthy moments, generates short clips with timestamps, and lets users preview, edit titles/descriptions, and export clips.

### Database

**New table: `vizard_projects`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `title` (text, default 'Untitled')
- `status` (text, default 'uploading') — uploading | transcribing | finding_clips | ready | failed
- `source_video_url` (text)
- `transcript` (jsonb) — full timestamped transcript from transcribe-video
- `clips` (jsonb, default '[]') — array of `{id, title, description, start, end, score, tags, exported}`
- `error` (text)
- `created_at`, `updated_at` (timestamptz)

RLS: standard user_id-based CRUD for authenticated users.

### New Edge Function: `vizard-find-clips`
- Receives `projectId` + transcript + video duration
- Uses Gemini via Lovable AI Gateway to analyze the transcript and identify the top 5-10 best moments (viral hooks, emotional peaks, key insights)
- Returns clips array with start/end timestamps, suggested titles, descriptions, and virality scores
- Updates the `vizard_projects` row with clips and sets status to `ready`

### Frontend: `src/pages/Vizard.tsx`

**Layout**: Uses existing `<Layout>` wrapper. Three views:

1. **Project List** — cards showing past projects with status badges, click to open
2. **Upload View** — drag-and-drop or file picker for video upload (to `raw-footage` bucket), starts processing pipeline
3. **Project Detail** — shows:
   - Progress stepper (uploading → transcribing → finding clips → ready)
   - Full transcript with timestamps (scrollable)
   - Clips grid: each clip card shows title, time range, score badge, preview button, edit button, export/download button
   - Clip preview: plays source video from start to end timestamp using `<video>` element with `currentTime`
   - Inline editing of clip title/description
   - Export: downloads the clip time range (client-side trim via canvas or link to full video with timestamps)

### Processing Pipeline (client-driven polling)
1. Upload video to `raw-footage` bucket → save URL to `vizard_projects` → status: `uploading` → `transcribing`
2. Call `transcribe-video` edge function → save transcript → status: `finding_clips`
3. Call `vizard-find-clips` edge function → save clips → status: `ready`
4. UI polls project status and updates progress stepper in real-time

### Routing
- Add `/vizard` route to `App.tsx` (protected)
- Add nav item to `Navigation.tsx` under the Tools/Create group

### Technical Details
- Video upload reuses existing `raw-footage` storage bucket (public)
- Transcription reuses existing `transcribe-video` edge function (Whisper + Gemini fallback)
- Clip preview uses HTML5 `<video>` with `currentTime` + `timeupdate` event to constrain playback to clip boundaries
- Export uses canvas-based trim (`canvasStitch.ts` pattern) or provides a "copy timestamp" fallback
- All AI calls go through Lovable AI Gateway using `LOVABLE_API_KEY`

### Files to create/modify
- **Create**: `src/pages/Vizard.tsx` — main page
- **Create**: `supabase/functions/vizard-find-clips/index.ts` — AI clip finder
- **Modify**: `src/App.tsx` — add route
- **Modify**: `src/components/Navigation.tsx` — add nav link
- **Migration**: create `vizard_projects` table with RLS

