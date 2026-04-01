# A/B Video Comparison for AI Spokesperson

## What it does
After generating your first spokesperson video, you can generate a **second version** with different settings (voice, mood, camera angle, setting) and compare them side-by-side before choosing your favorite.

## UI Changes

### 1. "Generate Version B" button
- Appears after the first video finishes generating
- Opens a quick settings panel to tweak voice, mood, camera angle, or setting for the second version

### 2. Side-by-side comparison view
- Shows Video A and Video B next to each other with their settings labeled
- Both videos play/pause in sync
- Each has a "Pick This One" button

### 3. State management
- Store `videoA` and `videoB` URLs + their settings
- "Pick" dismisses the comparison and keeps the chosen video as the final result

## What changes between versions
Users can vary any of these for Version B:
- **Voice engine** (e.g. cloned vs WaveSpeed vs Google Cloud)
- **Mood** (confident vs friendly vs inspiring)
- **Camera angle** 
- **Setting/backdrop**

The script stays the same so you're comparing the *delivery*, not the content.

## Files Changed
- `src/pages/AISpokesperson.tsx` — add Version B generation, comparison UI, and pick flow
