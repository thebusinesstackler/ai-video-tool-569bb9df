

## Fix Video URL Import — Replace Shutdown Cobalt API

### The Problem
The Cobalt v7 API (`api.cobalt.tools/api/json`) was permanently shut down in November 2024. That's why YouTube Shorts imports are failing. You do **not** need to add a Cobalt API key — the old public endpoint simply no longer exists.

### The Fix
Replace the Cobalt v7 call with the **new Cobalt v10+ API format** pointed at a public instance, plus add a fallback using a **RapidAPI YouTube downloader** for reliability.

### Approach Options

Since Cobalt's public API is gone, there are two paths:

1. **Use a public Cobalt v10 instance** — Free but potentially unreliable (public instances may block YouTube). The new API format uses `POST /` with updated field names (`videoQuality` instead of `vQuality`, `downloadMode` instead of separate flags).

2. **Use a paid video download API via RapidAPI** — Reliable, supports YouTube/TikTok/Instagram, but requires adding an API key (~$10/month for moderate use).

**Recommended: Option 2** — A RapidAPI-based downloader is more reliable for production use. We'd add one secret (`RAPIDAPI_KEY`) and update the edge function.

### File Changes

**`supabase/functions/download-video-url/index.ts`**
- Remove the dead Cobalt v7 API call
- Add a primary download method using a RapidAPI video downloader (e.g., `ytdl-core` or `social-media-video-downloader`)
- Keep the same auth, validation, storage upload, and response format
- Add better error messages indicating which platforms are supported

### What You'd Need
- A RapidAPI key (free tier available, paid for higher volume)
- I'll walk you through getting one before implementing

### Alternative: No API Key Needed
If you'd prefer not to add an API key, I can instead:
- Try multiple known public Cobalt v10 instances with automatic fallback
- This is free but may be less reliable for YouTube specifically (TikTok/Instagram tend to work better on public instances)

