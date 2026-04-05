

# Plan: One-Click Captions, Video Continuation & Auto Voice Cloning for Reels

## What We're Building

Three connected features for the Reels history section:

1. **One-Click "Add Captions" button** on completed reels in history — sends the existing video + scene narrations to the `creatomate-stitch` edge function to burn in captions, then lets you save or discard.
2. **"Continue Video" flow** for videos that got cut off — extracts the last frame as a reference image, auto-generates a continuation script that picks up from the last sentence, and generates a new clip to extend the video.
3. **Auto voice cloning** from the reel's existing audio — when continuing a video, the system automatically clones the speaker's voice (using the Speechify clone engine, same as AI Twins) so the extension matches perfectly.

---

## Technical Details

### 1. One-Click Captions (History Cards)

**File: `src/pages/Reels.tsx`** — history section (~line 7948)

- Add a **"Add Captions"** button to each reel card (next to Download).
- On click:
  - Extract scene narrations from `reel.scenes` and video URLs.
  - Call `creatomate-stitch` with the existing clips + caption text using default caption settings (karaoke style).
  - Show a loading state on the button.
  - When done, open a preview dialog showing the captioned video side-by-side with the original.
  - Two buttons: **"Save with Captions"** (updates `video_url` in `reels` table) and **"Discard"**.
  - Store original URL in a `video_url_no_captions` field so captions can be toggled/removed later.

**Migration**: Add `video_url_no_captions text` column to `reels` table.

### 2. Continue Video Flow

**File: `src/pages/Reels.tsx`** — new "Continue" button on history cards

- Add **"Continue Video"** button on reel cards.
- On click:
  - Extract last frame from the video using a hidden `<video>` + `<canvas>` (similar to existing `FrameCapture` component pattern).
  - Parse the last scene's narration to identify where speech was cut off.
  - Call the `ai` edge function with a prompt: "Given this script that was cut off at: '[last narration]', write a natural 5-10 second closing script that wraps up the thought."
  - Open a "Continue Video" panel showing: the extracted frame, the AI-suggested closing script (editable), and a "Generate Continuation" button.
  - Generate the continuation clip using the same pipeline (Sora-2 or InfiniteTalk depending on whether it's a speaking scene).
  - Auto-stitch the original video with the new clip via `creatomate-stitch`.

### 3. Auto Voice Cloning for Continuation

- When the "Continue Video" flow starts, extract audio from the reel's `audio_url` or scene audio.
- Automatically call `clone-voice-speechify` with the reel's audio to get a temporary voice clone.
- Use that cloned voice ID for TTS generation of the continuation script.
- This ensures the extended portion sounds like the same speaker.
- If the reel was made with an AI Twin that already has a cloned voice, skip cloning and reuse the twin's `voice_cloning_key` directly.

### 4. UI Component: CaptionPreviewDialog

**New file: `src/components/CaptionPreviewDialog.tsx`**

- Dialog with two video players (original vs captioned).
- "Save" and "Discard" buttons.
- Caption style selector for quick adjustments before saving.

### 5. UI Component: ContinueVideoPanel

**New file: `src/components/ContinueVideoPanel.tsx`**

- Sheet/dialog showing:
  - Last frame thumbnail
  - Last sentence context
  - AI-generated continuation script (editable textarea)
  - Voice match status (cloned / using existing twin voice)
  - "Generate & Stitch" button
  - Progress indicator

### Database Migration

```sql
ALTER TABLE public.reels 
  ADD COLUMN video_url_no_captions text DEFAULT NULL;
```

### Flow Diagram

```text
History Card
├── [Add Captions] → creatomate-stitch with narrations → Preview Dialog → Save/Discard
├── [Continue Video] → Extract last frame + parse script
│   ├── Has AI Twin voice? → Reuse clone
│   └── No twin? → clone-voice-speechify(reel audio) → temp voice
│   └── AI generates closing script → Generate clip → Stitch → Save
```

