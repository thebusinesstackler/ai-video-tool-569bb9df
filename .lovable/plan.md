
# Add "Recreate as Spokesperson" Button in Video Repo Pro

## What it does
When viewing a completed project in Video Repo Pro's detail view, a new button appears below the reference video that sends the analyzed script to the **AI Spokesperson** page. This lets users turn any reference video's script into a full-length talking-head video with their AI Twin — no duration limit.

## Changes

### 1. Add "Recreate as Spokesperson" button in VideoRepoPro detail view
- In the project detail panel (where Remake/New Version already live), add a new button: **"Recreate with AI Twin"**
- On click: store the script text, estimated duration, and title into `sessionStorage` under `video-repo-to-spokesperson`
- Navigate to `/ai-spokesperson`

### 2. Add sessionStorage pickup in AISpokesperson.tsx
- On mount, check for `video-repo-to-spokesperson` in sessionStorage
- If found, auto-populate:
  - The "message to deliver" textarea with the script
  - The duration (auto-calculated from word count)
- Clear sessionStorage after consuming

### 3. No duration cap enforcement
- The AI Spokesperson already supports variable durations — this just pre-fills the script so the user can pick their Twin and produce immediately
