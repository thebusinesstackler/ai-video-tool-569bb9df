

## Smart Audio Trim — Per-Clip Analysis

### Problem (Updated)
Both Sora-2 clips can have abrupt mid-word audio cutoffs — not just the final one. If we only trim the end of the stitched video, a cutoff at the end of clip 1 would appear as a jarring audio glitch in the middle of the final video.

### Solution
Analyze and trim **each clip individually** before stitching, rather than trimming the stitched result.

```text
Sora-2 Clip 1 → Analyze audio → Trim to clean ending ─┐
                                                        ├─ Stitch → Final video
Sora-2 Clip 2 → Analyze audio → Trim to clean ending ─┘
```

### Steps

**Step 1: Create `analyze-audio-trim` edge function**
- Accepts a video URL (one clip at a time)
- Downloads the video, sends to Gemini 2.5 Flash with the prompt: *"Find the timestamp of the last naturally completed sentence. If speech is cut off mid-word, return the timestamp right after the last complete sentence."*
- Returns `{ trimTimestamp: number, reason: string }` as structured JSON
- Uses `LOVABLE_API_KEY` via Lovable AI gateway (no new API key needed)

**Step 2: Add `trimVideoToTimestamp()` utility**
- New function in `src/lib/canvasStitch.ts`
- Takes a video Blob and a timestamp, re-encodes from 0 to that timestamp using Canvas + MediaRecorder
- Reuses the existing silent-oscillator pattern for a valid audio track

**Step 3: Integrate per-clip trimming into VideoRepoPro pipeline**
- After downloading each Sora-2 segment as a blob (line ~579), call the edge function for each clip
- If the returned trim timestamp is earlier than the clip's full duration, trim that clip's blob before adding it to the stitch array
- Then stitch the two clean clips as usual
- Progress updates: "Analyzing clip 1 audio..." → "Trimming clip 1..." → repeat for clip 2 → "Stitching..."

### Files Changed
- `supabase/functions/analyze-audio-trim/index.ts` — new edge function
- `src/lib/canvasStitch.ts` — add `trimVideoToTimestamp()` export
- `src/pages/VideoRepoPro.tsx` — add per-clip analyze+trim step before stitching

### Notes
- Each Sora-2 clip is ~10-20s, well within Gemini's input limits
- Both clips are processed independently so they could be analyzed in parallel
- If neither clip has a cutoff, the pipeline proceeds unchanged (no unnecessary re-encoding)

