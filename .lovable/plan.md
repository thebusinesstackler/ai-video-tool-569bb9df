

# Fix Music Playback, Volume Control, and Motion Graphics Workflow

## Issues Identified

1. **Music doesn't play** — The audio sync effect creates `Audio` elements but they may fail to auto-play due to browser autoplay policies. The audio elements are created lazily inside an effect that re-runs on every `currentTime` update, and `play()` calls silently fail. The `audioEl.loop = true` also conflicts with the range-based sync logic.

2. **Volume control only mutes, no slider** — The music track header only has a mute/unmute toggle button. There is no volume slider to adjust the music level.

3. **Motion graphics: no generation notification** — When Marco adds overlays, `generateMotionGraphic` fires and updates state, but there is no prominent toast or chat notification when generation completes or fails. The user has no clear signal that the graphic is ready.

## Plan

### 1. Fix music playback (src/pages/ChatcutAI.tsx)

- **Remove `audioEl.loop = true`** — looping conflicts with range-based sync. If the track ends before the video, it should just stop.
- **Add a user-interaction gate** — After the first user click (play button), set a flag `hasInteracted` so audio elements can reliably call `.play()`. Use a one-time `click` listener on the document.
- **Fix audio element lifecycle** — Move audio element creation out of the rapid `timeupdate` effect. Create/destroy audio elements in a separate effect that watches only `musicTracks` (specifically their `audioUrl`). The sync effect should only manage play/pause/seek.
- **Add error logging** — Log `.play()` failures visibly so we can debug.

### 2. Add volume slider for music tracks

- In the Music track header area (line ~1524), add a `Slider` component (already imported) that controls `track.volume` for each music track.
- Clicking the music track in the timeline or media panel opens a small inline volume slider.
- Simpler approach: add a volume slider directly in the track header, replacing just the mute button with a mute button + slider combo.
- Update the audio sync effect to apply volume changes in real-time: `audioEl.volume = trackMuted.a1 ? 0 : track.volume`.

### 3. Motion graphics generation notifications

- In `generateMotionGraphic`, after success, also append a system chat message from Marco: "Your motion graphic '[text]' is ready! It's on the timeline at [start]s."
- On failure, append an error message: "Heads up — the graphic for '[text]' didn't generate. Want me to retry?"
- This gives the user clear feedback in the chat alongside the existing toast.

### Summary

| Area | Change |
|------|--------|
| Music playback | Fix audio lifecycle, remove `loop`, add interaction gate |
| Volume control | Add inline `Slider` to music track header for volume adjustment |
| Motion graphics | Add chat notifications on generation complete/fail |

**File modified:** `src/pages/ChatcutAI.tsx`

