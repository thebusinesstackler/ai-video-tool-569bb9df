

# Redirect "Send to Reels Editor" → Video Repo Pro

## Problem
The "Send to Reels Editor" button in Video Repurposer sends data to the Reels page, which doesn't work well for this use case. It should instead send the reference video and repurposed script to Video Repo Pro, which has the full video generation pipeline.

## What changes

### 1. Update `handleSendToReels` in `VideoRepurposer.tsx`
- Rename to `handleSendToVideoRepo`
- Store the reference video URL (the downloaded/uploaded video) and the repurposed script text into `sessionStorage` under a key like `repurpose-to-video-repo`
- Navigate to `/video-repo-pro` instead of `/reels`
- Update button label to "Create Video" or "Send to Video Studio"

### 2. Add sessionStorage pickup in `VideoRepoPro.tsx`
- On mount, check for `repurpose-to-video-repo` in sessionStorage
- If found, populate:
  - `referenceVideoUrl` with the stored video URL
  - `prompt` with the repurposed script text (formatted as a video creation prompt)
  - Trigger frame extraction from the reference video
  - Set `pendingAutoAnalysis = true` to auto-start the AI Script Director
- Clear the sessionStorage key after consuming it

### 3. Update button UI in `VideoRepurposer.tsx`
- Change icon from `Play` to `Video` (or similar)
- Change label from "Send to Reels Editor" to "Create Video"

## Technical details
- SessionStorage payload: `{ videoUrl: string, script: string, title: string }`
- Video Repo Pro already has `pendingAutoAnalysis` + `pendingAutoPromptRef` pattern for auto-triggering analysis — we reuse that exact flow
- The reference video URL comes from the repurposer's `uploadedVideoUrl` (for uploads) or the stored URL after download

