

# Video Repo: Drag-and-Drop Upload with AI Analysis & Metadata

## What We're Building

A new "Import" tab/flow on the Video Repo page that lets users drag-and-drop an existing video, have AI analyze it (extracting frames + transcription), and then add metadata like the prompt used and the model that generated it. This creates a project entry in history that can be remixed later.

## Technical Plan

### 1. Add "Import Video" tab to Video Repo

Add a third tab alongside "Create" and "History" called "Import". This tab shows a large drag-and-drop zone (reusing the `ImageDropZone` pattern but for video files).

**File:** `src/pages/VideoRepo.tsx`
- Add `'import'` to the `mainTab` state type
- Add a new `TabsTrigger` with an Upload icon
- Create the `TabsContent` with a drag-and-drop upload area

### 2. Build the Import Flow UI

Once a video is dropped/selected:
1. **Upload** the video to Supabase storage (`reels` bucket)
2. **Extract 6 key frames** using the existing `extractVideoFrames` helper
3. **Call AI analysis** — send frames to the `analyze-repurpose-video` edge function (already exists) to reverse-engineer the video's content, hook, pacing, etc.
4. **Show editable metadata form:**
   - AI-generated analysis summary (read-only)
   - AI-suggested prompt (pre-filled, editable textarea)
   - Model selector dropdown (e.g., `openai/sora-2/image-to-video`, `wan-2.5-i2v`, `veo3`, etc.)
   - Task/Job ID field (optional text input)
   - Custom name field
5. **Save button** → inserts into `video_repo_projects` with status `completed`, the uploaded video as `generated_video_url`, and the prompt/analysis stored

### 3. Database: Add `model` column to `video_repo_projects`

**Migration:** Add a nullable `model` text column and an optional `external_task_id` text column to store the generation model and external job ID.

```sql
ALTER TABLE public.video_repo_projects
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS external_task_id text;
```

### 4. Remix Integration

When viewing an imported project in the History detail view, a "Remix" button will pre-populate the Create tab with the stored prompt and reference video, letting the user iterate on the script via the existing AI analysis flow.

### Files Modified
- `src/pages/VideoRepo.tsx` — new Import tab, drag-and-drop upload, AI analysis call, metadata form, remix button on detail view
- **Migration** — add `model` and `external_task_id` columns to `video_repo_projects`

