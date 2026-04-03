

## Add TikTok/YouTube URL Import to Video Repo

### What We're Building

A URL input option alongside the existing file upload button so users can paste a TikTok or YouTube link as their reference video. A new edge function will download the video server-side and store it in Supabase Storage, then the existing frame extraction and analysis pipeline proceeds as normal.

### How It Works

```text
User pastes URL → Edge function downloads video → Stored in Supabase Storage
→ Browser fetches stored video → Extracts frames locally → Normal analysis pipeline
```

### File Changes

**1. New Edge Function: `supabase/functions/download-video-url/index.ts`**
- Accepts `{ url: string }` in the request body
- Validates the URL is from TikTok or YouTube (or allows any video URL)
- Uses a lightweight approach: fetches the page via [cobalt.tools API](https://cobalt.tools) (free, no API key needed) to extract the direct video download link from TikTok/YouTube
- Downloads the video binary, uploads it to `reels/{user_id}/video-repo/imports/{uuid}.mp4`
- Returns `{ videoUrl: string }` — the public Supabase Storage URL
- Includes CORS headers, input validation, and auth check

**2. `src/pages/VideoRepo.tsx`**
- Add a new state: `urlInput` string, `isDownloadingUrl` boolean
- Add a URL input field next to the "Reference Video" button with a `Link` icon and placeholder "Paste TikTok or YouTube URL"
- When user pastes a URL and clicks "Import" (or presses Enter):
  - Call the `download-video-url` edge function
  - On success, set `referenceVideoUrl` to the returned storage URL, set `referenceVideoName` to the original URL domain
  - Fetch the video as a blob to run the existing `extractVideoFrames` logic for frame capture
  - Show a loading spinner on the URL input while downloading
- The rest of the pipeline (analysis, generation, history) works unchanged since it already handles storage URLs

### Technical Details

- Cobalt API is free and open-source — supports TikTok, YouTube, Instagram, Twitter, and more with no API key
- The edge function downloads the video to memory and streams it to Supabase Storage
- Video size capped at 100MB to prevent abuse
- URL validation ensures only http/https protocols
- The downloaded video gets the same persistent storage path as manually uploaded videos, so history works seamlessly

