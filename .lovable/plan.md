

## Video Repo History & Gallery Integration

### What We're Building

A persistent history system for Video Repo that saves every session (prompt, reference video, product image, AI analysis, and generated video) to the database. Users can browse past projects with side-by-side comparison of reference vs. generated video. Generated videos also appear in the Gallery under a "Video Repo" filter tab.

### Database Changes

**New table: `video_repo_projects`**
- `id`, `user_id`, `prompt`, `reference_video_url`, `product_image_url`, `analysis_text`, `generated_video_url`, `video_prompt`, `status` (analyzing/generating/completed/failed), `created_at`, `updated_at`
- RLS: authenticated users CRUD their own rows

### File Changes

**1. `src/pages/VideoRepo.tsx`**
- Upload reference video and product image to Supabase Storage (`reels` bucket) before analysis, so we have persistent URLs (not blob/data URIs)
- Insert a `video_repo_projects` row when the user hits Send, update it as the pipeline progresses (analysis text, generated video URL, status)
- Add a "History" tab/panel below the composer showing saved projects as cards
- Each history card shows: prompt snippet, reference video thumbnail, generated video thumbnail, date, status badge
- Clicking a card opens a side-by-side view: reference video (left) vs generated video (right) with the prompt and analysis below
- Also save the generated video to `generated_images` table with `source: 'video-repo'` for Gallery integration

**2. `src/pages/Gallery.tsx`**
- Add a third tab: "Video Repo" that filters `generated_images` where `source = 'video-repo'`
- Display video entries with playable thumbnails in the same grid layout

### Technical Details

- Reference videos uploaded to `reels/{user_id}/video-repo/{uuid}.mp4`
- Product images uploaded to `reels/{user_id}/video-repo/{uuid}.jpg`
- History cards use the stored URLs so they persist across sessions
- Side-by-side layout uses a responsive 2-column grid (`grid-cols-1 md:grid-cols-2`)
- Status badge on each card: `analyzing` (yellow), `generating` (blue), `completed` (green), `failed` (red)

