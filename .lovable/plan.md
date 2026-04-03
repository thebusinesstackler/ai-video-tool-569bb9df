

## Video Repo Pro — 30-Second Multi-Clip Stitched Videos

### What We're Building
A clone of the Video Repo page called "Video Repo Pro" that generates full 30-second videos by splitting the script into segments, generating multiple Sora-2 clips (up to 20 seconds each), and stitching them together seamlessly — no cutoffs.

### How It Works
```text
Reference analysis → AI writes a 30s scene-by-scene script
→ Script split into 2 segments (~15-20s each)
→ Sora-2 generates each segment in parallel
→ Segments stitched via videoStitch pipeline
→ Single seamless 30s MP4 delivered
```

### File Changes

**1. `src/pages/VideoRepoPro.tsx`** (new — cloned from VideoRepo.tsx)
- Update page title/branding to "Video Repo Pro"
- Change the AI system prompt to generate a **structured multi-segment script** with explicit timing per segment (e.g., Segment 1: 0-15s, Segment 2: 15-30s)
- Output format: multiple `video-prompt-1`, `video-prompt-2` blocks instead of one
- After analysis, generate each segment as a separate Sora-2 call with `duration: 20` (max allowed)
- Run both generation jobs in parallel, poll both until complete
- Once all clips are ready, call `stitchVideosWithAudio` from `@/lib/videoStitch` to merge them into one seamless MP4
- Upload the final stitched blob to Supabase Storage and save it as the project result
- Show progress: "Generating segment 1/2...", "Stitching final video..."

**2. `src/App.tsx`**
- Import `VideoRepoPro` and add route `/video-repo-pro`

**3. `src/components/Navigation.tsx`**
- Add "Video Repo Pro" nav item under AI Tools group with a distinct icon (e.g., `Film` or `Sparkles`)

### Key Technical Details
- Sora-2 supports up to 20s per clip — two clips covers 30s+ comfortably
- The existing `stitchVideosWithAudio` handles cloud stitching (Creatomate) with canvas fallback
- The AI prompt instructs continuity between segments: Segment 2's opening matches Segment 1's ending for seamless transitions
- Uses the same `video_repo_projects` table for history — adds a `source: 'video-repo-pro'` tag to distinguish
- All existing features (URL import, product image, frame extraction, history) carry over from the clone

