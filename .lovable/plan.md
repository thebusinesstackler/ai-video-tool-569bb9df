

## Issues Identified

1. **Captions not showing in video**: The auto-stitch after video generation (line ~2541) uses `canvasStitchVideos` which does NOT support captions. Only the manual `stitchVideos` function (line ~3537) calls `creatomate-stitch` with caption settings. The auto-stitch needs to use Creatomate cloud stitching when captions are enabled.

2. **No post-generation editing**: After the video is generated, the UI shows "Your Reel is Ready" with Download/Save buttons but doesn't expose the Timeline Editor or scene-level editing controls. The user needs to be able to make changes (re-order, trim, swap scenes, adjust captions) after generation.

3. **Product placement only in Character tab**: The product picker is only in Quick Mode and the Character tab in Advanced Mode. It should also be accessible from the Settings tab, Script tab, and Video tab so the product selection is visible and usable regardless of which tab the user is working in.

## Plan

### 1. Fix auto-stitch to use Creatomate with captions
**File**: `src/pages/Reels.tsx` (~lines 2522-2578)

- When captions are enabled (`captionSettings.enabled`) and all video URLs are public (`allPublicUrls`), use `creatomate-stitch` instead of `canvasStitchVideos`
- Pass the full caption settings (`captionFont`, `captionFontSize`, `captionFontColor`, `captionBackground`, `captionAnimation`, `captionStyle`) just like the manual stitch does at line 3537
- Also pass `introImageUrl` (thumbnail), `logoUrl`, `backgroundMusicUrl`, and `transition` settings
- Fall back to `canvasStitchVideos` if Creatomate fails
- This ensures the auto-generated video includes burned-in captions matching the user's style settings

### 2. Enable post-generation editing
**File**: `src/pages/Reels.tsx`

- After video generation completes (status = 'complete'), show an "Edit in Timeline" button alongside Download/Save
- When clicked, switch to Timeline View (`showTimeline = true`) with the generated scenes populated as timeline clips
- Add a "Re-stitch with Changes" button in the timeline that calls the manual `stitchVideos` with current settings, allowing users to apply edits (reorder, trim, caption changes) and produce a new final video
- Ensure the "Your Reel is Ready" section includes scene cards below the video player so users can regenerate individual scenes or swap products without having to start over

### 3. Make product picker available across all tabs
**File**: `src/pages/Reels.tsx`

- Extract the product picker UI into a reusable inline component/section
- Add the product picker to:
  - **Settings tab**: Below the topic/template area so users set the product before generating scripts
  - **Script tab**: Below the voice settings so users can see which product is selected while reviewing scenes
  - **Video tab**: Near the video model selector so it's visible during preview generation
- All locations share the same `selectedProductImageUrl`/`selectedProductName` state
- Show a small "Selected Product" badge/indicator in the tab header when a product is active, so the user always knows a product is selected regardless of which tab they're viewing

### Technical Details

- **Creatomate auto-stitch**: Replace the `canvasStitchVideos` call at line ~2541 with a Creatomate-first approach (mirroring the pattern at line ~3506-3591), including caption params from `captionSettings`, with canvas as fallback
- **Timeline entry point**: Add `onClick={() => { setShowTimeline(true); setActiveTab('timeline'); }}` button in the completion card
- **Product picker component**: Create a small `ProductPicker` inline section that renders the product grid with select/deselect, reused across 4 locations via a shared render function or extracted component

