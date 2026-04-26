# Add Format Detection & Selection to Video Repo

Currently the Video Repo page hardcodes `aspectRatio: '9:16'` for every generation. We'll add automatic aspect detection from reference videos plus a manual format toggle that the user can override at any time.

## Behavior

1. **Auto-detect from reference video** — When a user uploads or imports a reference video, read `videoWidth`/`videoHeight` during frame extraction. If `width/height < 1` (portrait) → set format to **Reel (9:16)**. Otherwise → **YouTube (16:9)**.
2. **Manual override** — A format selector (segmented control) is always visible in the input area, defaulting to Reel (9:16). User can switch at any time, even after auto-detection.
3. **Generation respects choice** — All `createWaveSpeedVideo` calls in the main generate path and follow-up regenerate path use the selected aspect ratio instead of the hardcoded `'9:16'`.

## UI Placement

In the chat input area on `/video-repo`, just above the prompt textarea (near the existing reference/product chips around line 2005), add a small segmented control:

```text
Format: [ Reel 9:16 ] [ YouTube 16:9 ]
         Instagram /     Standard
         TikTok / Shorts  YouTube
```

When auto-detection fires, show a brief toast: *"Detected vertical format — set to Reel (9:16). You can change this anytime."*

## Technical Changes

**`src/pages/VideoRepo.tsx`**
- Add state: `const [outputFormat, setOutputFormat] = useState<'9:16' | '16:9'>('9:16')`.
- In the local `extractFrames` function (~line 277) and after URL-import frame extraction (~line 410), once `video.onloadedmetadata` fires, compute `aspect = videoWidth / videoHeight` and call `setOutputFormat(aspect < 1 ? '9:16' : '16:9')`. Show the detection toast once per upload.
- Apply the same detection inside the file-drop handler that sets `referenceVideoFile` (search for `setReferenceVideoFile` callers).
- Replace the two hardcoded `aspectRatio: '9:16'` in the Sora/Wan generation path (line ~716) and follow-up regenerate path (line ~923) with `aspectRatio: outputFormat`.
- Add a `ToggleGroup` (or two `Button`s) above the prompt input bound to `outputFormat`.

**No DB / edge function changes** — `createWaveSpeedVideo` already accepts `aspectRatio` as a parameter and Sora-2 / Wan-2.5-i2v support both `9:16` and `16:9`.

## Out of Scope

- Keyframe motion path (line 1089) stays at `16:9` since it's a separate flow.
- No persistence of the user's format preference across sessions (can be added later if desired).
