

# Fix: Video Repurposer YouTube Import — Use VideoRepoPro's Robust Download Pipeline

## Problem
The Video Repurposer's `downloadVideoFromUrl` has a weak client-side fallback that just does a plain `fetch()` on the download URL, which fails due to CORS. The Video Repo Pro page has a much more robust fallback using `MediaRecorder` + `captureStream()` that actually works for YouTube Shorts. The Repurposer needs the same approach.

## What changes

### 1. Port VideoRepoPro's client-download fallback into VideoRepurposer
In `src/pages/VideoRepurposer.tsx`, replace the simple `fetch()` client-side fallback in `downloadVideoFromUrl` with the multi-layered strategy from VideoRepoPro:
- First try direct `fetch()` of the download URL
- If that fails (CORS), fall back to loading a hidden `<video>` element and capturing via `MediaRecorder` + `captureStream()`
- Upload the resulting blob (video/webm or video/mp4) to storage via the signed URL
- Return the public URL

### 2. Fix frame extraction to work with stored URLs
The current `extractVideoFrames` fetches the URL and creates a blob — but if the stored video is cross-origin, this fetch can also fail. Add `crossOrigin = 'anonymous'` to the video element since the Supabase storage bucket is public and serves CORS headers.

### 3. Ensure transcription uses the stored URL
After download, both frame extraction and transcription should use the Supabase storage URL (which is reliably accessible), not the original social media URL.

## Technical details
- The key difference is VideoRepoPro uses `captureStream()` + `MediaRecorder` as a CORS bypass — it plays the video through a `<video>` element (which doesn't require CORS) and records the output stream
- This captures both audio and video tracks, so the resulting blob will have audio for transcription
- The `transcribe-video` edge function receives a proper Supabase storage URL that it can fetch server-side without CORS issues

