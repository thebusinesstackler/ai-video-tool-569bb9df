
# Plan: Scene Detection + AI Director Timeline Superpowers

## What We're Building

1. **AI Scene Detection** — Automatically detect scene boundaries in video clips using audio silence detection + AI frame analysis (Gemini vision), then offer one-click splitting at those boundaries.

2. **AI Director Timeline Chat** — A chat panel integrated into both timeline editors where the AI Director can make live edits: split clips, trim, regenerate segments, reorder, and more.

---

## 1. Edge Function: `detect-scenes`

**New file: `supabase/functions/detect-scenes/index.ts`**

Two-pass detection:
- **Pass 1 (Audio)**: Use the reel's audio URL — send to Gemini 2.5 Flash with a prompt: "Analyze this audio and identify timestamps where there are natural pauses, silence gaps, or topic changes. Return an array of split points."
- **Pass 2 (Visual verification)**: Extract frames at the detected timestamps and send them to Gemini 2.5 Pro (vision) to confirm scene changes (different backgrounds, camera angles, subjects). Removes false positives.

Returns:
```json
{
  "sceneBreaks": [
    { "timestamp": 4.2, "confidence": 0.95, "reason": "Camera angle change + audio pause" },
    { "timestamp": 8.7, "confidence": 0.82, "reason": "New background / setting" }
  ]
}
```

## 2. Scene Detection UI Component

**New file: `src/components/SceneDetector.tsx`**

- Button: "🔍 Detect Scenes" in both timeline editors
- Shows detected scene break markers on the timeline as draggable split points
- User can approve/dismiss each detected break
- "Split All" button to auto-split at all detected boundaries
- Each split creates a new segment with the correct duration

## 3. AI Director Timeline Panel

**New file: `src/components/TimelineAIDirector.tsx`**

A slide-out chat panel (Sheet) that connects to the timeline state:

### Superpowers (tool-calling actions the AI can execute):
- **`split_clip`** — Split a clip at a specific timestamp
- **`trim_clip`** — Adjust trimStart/trimEnd of a segment
- **`delete_clip`** — Remove a segment
- **`reorder_clips`** — Move a clip to a new position
- **`regenerate_clip`** — Regenerate a video segment matching the exact duration
- **`add_caption`** — Add/edit caption text on a segment
- **`detect_scenes`** — Trigger scene detection on the current video
- **`adjust_transition`** — Change transition type between clips

### How it works:
- Chat sends the full timeline state (segments, durations, captions, transitions) as context
- AI Director responds with natural language + structured tool calls
- Tool calls are parsed and applied to the timeline state in real-time
- User sees changes immediately and can undo via the existing undo/redo stack

### Edge function: `timeline-director/index.ts`
- Uses Claude (existing `_shared/claude.ts`) with Extended Thinking
- System prompt: "You are the AI Director with full control over the video timeline. You can split, trim, delete, reorder, and regenerate clips."
- Tools defined for each superpower action
- Returns both a chat message and an array of actions to execute

## 4. Integration Points

### Reels Timeline (`TimelineEditor.tsx`)
- Add "Detect Scenes" button to the toolbar
- Add "AI Director" button that opens the chat panel
- Wire scene detection markers into the timeline track visualization
- Apply AI Director actions to the timeline state

### Video Repo Pro Timeline (`VideoRepoTimeline.tsx`)
- Same buttons and wiring
- Scene detection uses the stitched video or individual segments
- AI Director has the same superpowers

## 5. Clip Regeneration Logic

When the AI Director (or user) regenerates a clip:
- Captures the exact duration of the original clip
- Uses the clip's visual context (narration, scene description, or frame analysis) as the prompt
- Calls `wavespeed-video` or `sora-2` matching the original duration
- Replaces the segment URL in the timeline state
- Duration constraints are enforced (Sora-2: 4/8/12/16/20s snapping)

---

## File Summary

| File | Action |
|------|--------|
| `supabase/functions/detect-scenes/index.ts` | New — audio + visual scene detection |
| `supabase/functions/timeline-director/index.ts` | New — AI Director chat with tool-calling |
| `src/components/SceneDetector.tsx` | New — scene detection UI + markers |
| `src/components/TimelineAIDirector.tsx` | New — AI Director chat panel |
| `src/components/TimelineEditor.tsx` | Edit — add detect + director buttons |
| `src/components/VideoRepoTimeline.tsx` | Edit — add detect + director buttons |
