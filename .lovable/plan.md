
The user wants to add a YouTube Short directly into Video Repo. Looking at existing infrastructure:
- `src/lib/socialVideoDownload.ts` already handles YouTube URLs via `download-video-url` edge function with client-side fallback
- `src/pages/VideoRepo.tsx` already has an "Import" tab and the dual composer (Ad/Motion)
- YouTube Searcher exists at `/youtube-search` for browsing

The simplest, highest-value addition: a "Paste YouTube URL" input in the Video Repo Import tab (and/or composer) that uses `downloadSocialVideoToStorage` to fetch the Short, then routes it into the existing reference-analysis / remix flow.

# Add YouTube Short URL Import to Video Repo

## What You'll Get
A new **"Paste URL"** option in Video Repo's Import tab where you can drop any YouTube Shorts link (or TikTok/Reels). The system downloads the video to your storage and runs it through the same reference-analysis pipeline as drag-and-drop uploads — extracting frames, generating a viral-style prompt, and letting you regenerate it as your own ad.

## How It Works
1. **New URL input row** at the top of the Import tab: text field + "Import" button
2. On submit, calls existing `downloadSocialVideoToStorage(url)` from `src/lib/socialVideoDownload.ts` — this already handles YouTube Shorts with server + client-side fallback
3. Once downloaded, the resulting video URL is fed into the same `analyzeReferenceVideo` flow used by the drag-and-drop importer (frame extraction → Gemini multimodal analysis → editable prompt)
4. Loading state + clear error messaging if YouTube blocks the download (suggests manual download + drag-drop as fallback)

## Files Modified
- **`src/pages/VideoRepo.tsx`** — add `youtubeUrl` state, an input + button in the Import tab, and an `importFromUrl()` handler that calls `downloadSocialVideoToStorage` then reuses the existing reference-video analysis pipeline

## No Backend Changes Needed
The `download-video-url` edge function already supports YouTube Shorts URLs (the same one we fixed earlier with the Cobalt + client-fallback strategy).
