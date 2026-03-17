

## Problems Identified

1. **`startNewProject` doesn't reset all state** — It clears `movieIdea`, `outline`, `scenes`, and `stitchedVideoUrl`, but does NOT reset `storyBible`, `currentStep`, `generateAllProgress`, `generateAllStep`, `isGeneratingAll`, `locations`, `sceneCoverages`, `sceneBlockings`, `selectedTwins`, `autoLinkScenes`, `activeSceneIndex`, etc. So when the user clicks "Make My Movie" again, stale data from the previous movie persists.

2. **`generateAll` doesn't clear old state before starting** — It begins generating without resetting `scenes`, `stitchedVideoUrl`, `storyBible`, or `outline`. If a previous movie's stitched video URL exists, it stays visible throughout the new generation and the "Your Movie" card shows the OLD video while new scenes generate underneath.

3. **Video player is too large** — The `<video>` tag uses `className="w-full"` with no `max-height` or `aspect-ratio` constraint, so it stretches to the full container width which can be very tall and hard to view.

4. **Scene cards hidden when old video exists** — Line 4019: `scenes.length > 0 && !stitchedVideoUrl` means if an old `stitchedVideoUrl` is still set, new scenes won't show at all — only the old video.

## Plan

### 1. Full state reset in `startNewProject`
Add missing resets: `setStoryBible(null)`, `setCurrentStep(0)`, `setGenerateAllProgress(0)`, `setGenerateAllStep('')`, `setLocations([])`, `setSceneCoverages(new Map())`, `setSceneBlockings(new Map())`, `setActiveSceneIndex(0)`, `setShowStoryBibleEditor(false)`, and clear any recovery state.

### 2. Clear stale state at the start of `generateAll`
At the top of `generateAll` (after the movieIdea check), explicitly reset: `setScenes([])`, `setStitchedVideoUrl(null)`, `setOutline('')`, `setStoryBible(null)`, `setCurrentStep(0)`. This ensures the old movie video disappears immediately when a new generation starts.

### 3. Constrain video player size
Change the video element from `className="w-full rounded-lg border border-border"` to include `max-h-[70vh] object-contain` so it fits within the viewport and doesn't dominate the page.

### 4. Show scenes even when stitched video exists
Change the condition on line 4019 from `scenes.length > 0 && !stitchedVideoUrl` to `scenes.length > 0` so scene cards are always visible below the movie player. This lets users see their scenes and the final video simultaneously.

### Files to edit
- `src/pages/MovieSceneCreator.tsx` — all changes in this single file

