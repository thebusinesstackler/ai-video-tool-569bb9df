

## Issues Identified

1. **Character/voice overridden on generate**: `generateAll()` at line 1956-1989 unconditionally overwrites the user's selected character and voice. If the user already generated a character and picked a voice in Steps 2-3, clicking "Make My Reel" replaces them with the first AI Twin or re-detects gender from the topic text.

2. **No way to cancel generation**: There is no abort/cancel mechanism. Once the user clicks "Make My Reel", they must wait for the entire pipeline to complete.

## Plan

### Fix 1: Preserve user's character and voice selections in `generateAll`

Modify `generateAll()` to skip the auto-selection logic when the user has already set values:

- **Character**: Only auto-select an AI Twin if `portraitImage` is already null (user hasn't generated or selected one).
- **Voice**: Only auto-detect gender voice if `selectedVoice` is still `'ai-auto'` (user hasn't manually changed it). When voice is `'ai-auto'`, resolve it to a concrete voice using gender detection but store it in a local variable passed to the pipeline — don't overwrite the state so the UI still shows "AI Auto-Select".

### Fix 2: Add cancel/stop generation button

- Add an `AbortController` ref (`abortRef`) to the component.
- Create it fresh at the start of `generateAll`, `generateScripts`, and `generateVideo`.
- Pass its signal to fetch calls (edge function invocations can't be aborted, but we can check `abortRef.current.signal.aborted` between pipeline steps to bail out early).
- Add a "Stop Generation" button that appears during generation, which calls `abortRef.current.abort()` and resets `isGenerating` to false.
- Between each major step (script gen → image gen → voiceover → video gen → stitching), check if aborted and return early.

### Fix 3: UI — show stop button in beginner mode

Replace the disabled "Creating your reel..." button with a red "Stop Generation" button when `isGenerating` is true. Also show it in the progress bar card.

### Files to modify

- **`src/pages/Reels.tsx`** — All three fixes above

