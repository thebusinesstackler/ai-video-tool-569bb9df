

## Fix Video Upscaler — Use WaveSpeed Ultimate Video Upscaler

### Problem
The current `upscale-video` edge function is a **stub** — it calls Claude to *describe* what upscaling would do, then returns the original video URL unchanged. No actual upscaling happens.

### Solution
Rewrite the edge function to use the **WaveSpeed Ultimate Video Upscaler API**, which supports 720p, 1080p, 2K, and 4K output. The `WAVESPEED_API_KEY` is already configured.

### Changes

**1. Rewrite `supabase/functions/upscale-video/index.ts`**
- **Submit**: POST to `https://api.wavespeed.ai/api/v3/wavespeed-ai/ultimate-video-upscaler` with `{ video: videoUrl, target_resolution: "4k" | "2k" | "1080p" }`
- **Poll**: GET `https://api.wavespeed.ai/api/v3/predictions/{taskId}/result` until status is `completed` or `failed`
- Map the UI modes: `2x` → `1080p`, `4x` → `4k`, `enhance` → `2k`
- Return the upscaled video URL from `data.outputs[0]`
- Status polling returns real progress from WaveSpeed

**2. Update `src/components/VideoUpscaler.tsx`**
- Update the upscale options to show actual target resolutions (1080p, 2K, 4K) instead of abstract "2x/4x" labels
- Keep the existing polling logic — it already handles `taskId` + status checks correctly

### Technical Details
- WaveSpeed API: submit task → get `data.id` → poll `predictions/{id}/result` → `data.outputs[0]` is the result URL
- Max 10 min video per job
- Pricing: $0.10–$0.40 per 5 seconds depending on resolution

