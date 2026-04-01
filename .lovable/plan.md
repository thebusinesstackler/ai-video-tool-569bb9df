

# Fix: Blank Videos After Adding B-Roll

## Problem

Two issues combine to produce blank videos:

1. **Creatomate cloud stitching fails** with a 402 "Insufficient credits" error
2. **Canvas fallback produces a 0-byte video** because cross-origin CDN videos (from WaveSpeed/cloudfront) taint the canvas, making `captureStream()` and `MediaRecorder` output empty data

The canvas approach fundamentally cannot work with cross-origin video URLs from CDNs due to browser security restrictions (CORS tainting). Even with `crossOrigin = 'anonymous'`, the CDN must send proper CORS headers for `captureStream()` to capture frames, and the current CDN does not reliably do so.

## Solution

Since Creatomate credits are exhausted, we need a **direct download fallback** instead of trying to re-encode via canvas. The fix:

### 1. Skip canvas stitching for cross-origin videos — offer individual downloads instead
**File: `src/pages/Reels.tsx`** (in `restitchWithAppendedClips`)

When cloud stitch fails and all URLs are remote CDN links:
- Instead of attempting canvas stitch (which will always produce 0 bytes), detect the failure and offer the user a **direct URL to the first/primary clip** as the video, plus a message explaining that multi-clip stitching requires cloud rendering credits
- Alternatively, if there's only one original clip + one B-roll, just use the original clip URL as-is and save the B-roll separately

### 2. Add a Creatomate credit error detection
**File: `src/pages/Reels.tsx`**

Parse the Creatomate error response to detect the 402/insufficient credits case specifically. Show a clear toast: "Cloud rendering credits exhausted — please top up your Creatomate account to stitch multiple clips together."

### 3. Prevent 0-byte blob from being saved
**File: `src/pages/Reels.tsx`** (after canvas stitch returns)

Add a guard: if `stitchedBlob.size < 1000`, do not save or set as the video. Instead, show an error toast and fall back to keeping the original video URL.

### 4. Single-clip shortcut for B-roll
**File: `src/pages/Reels.tsx`**

When there's exactly 1 original video and the user adds B-roll, but stitching fails, save both clips as separate scenes in the reel record rather than producing a blank combined video.

## Technical Details

- **Root cause**: `canvasStitchVideos` with cross-origin videos produces 0-byte output due to canvas tainting
- **Guard in canvas stitch** (`src/lib/canvasStitch.ts`): Add a check after `recorder.stop()` — if `finalBlob.size === 0`, throw an error instead of returning empty blob
- **Creatomate error surfacing**: The edge function already returns the 402 error, but `restitchWithAppendedClips` catches it generically. Parse `stitchData?.error` for "credits" and show a specific message.

## Files to Change
1. `src/lib/canvasStitch.ts` — throw on 0-byte output instead of returning empty blob
2. `src/pages/Reels.tsx` — in `restitchWithAppendedClips`: detect credit errors, guard against 0-byte blobs, fall back to original video URL when stitching fails

