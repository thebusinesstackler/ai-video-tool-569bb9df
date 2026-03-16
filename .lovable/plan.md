

## Audit & Improvement Plan for Reels & Testimonial Ads

### Problems Found

**1. FFmpeg stitching is broken (Critical)**
Console logs show `FFmpeg load timeout after 180 seconds` on both Reels and Testimonial Ads. The client-side FFmpeg WASM approach fails consistently — videos never get stitched into a final output. This is the biggest functional blocker.

**Fix:** Replace client-side FFmpeg stitching with cloud stitching via the existing `creatomate-stitch` edge function as the primary method. Fall back to `canvasStitch` only as a secondary option. Update both `src/lib/videoStitch.ts` and `src/hooks/useTestimonialCommercial.ts` to use cloud stitching first.

**2. Reels.tsx is 6,059 lines — unmaintainable and slow**
The entire Reels page is a single monolithic component with 60+ state variables. This causes re-render performance issues and makes every change risky.

**Fix (phased):** Extract the three mode UIs into separate components:
- `QuickModePanel.tsx` — lines ~3040-3256
- `BeginnerModePanel.tsx` — lines ~3258-3738
- `AdvancedModePanel.tsx` — lines ~3740-5163
- `ReelResultsPanel.tsx` — lines ~5165-5703 (the "Your Reel is Ready" + edit sheet)

Pass shared state via props or a context provider.

**3. Duplicate/redundant bottom gallery still showing**
The "Your Reel is Ready" card (line 5166) renders a duplicate scene gallery from `project.generatedScenes` even when `previewScenes` are active above. The previous fix was planned but the condition at line 5166 still allows both to show.

**Fix:** Change condition at line 5166 to: `(project.videoBlobUrl || (project.generatedScenes.length > 0 && previewScenes.length === 0))`

**4. Unnecessary/redundant pages in navigation**
- **Scripts page** (`/scripts`) — just wraps `ScriptGenerator` component, which is already accessible as a dialog within Reels (line 6026) and as a mode in the sidebar. Redundant.
- **Videos page** (`/videos`) — 1,931 lines of a standalone video segment editor that duplicates Reels functionality (scene-by-scene generation, stitching). Not connected to the rest of the workflow.
- **Commercial Studio** (`/commercial-studio`) — 832 lines, overlaps heavily with Testimonial Ads. Parses scripts into segments and generates clips — same workflow as Testimonial Ads but with less polish.

**Recommendation:** Remove Scripts, Videos, and Commercial Studio from navigation. Keep the pages but mark them as legacy/hidden. This declutters the nav and avoids user confusion.

**5. Testimonial Ads: video generation fails silently after FFmpeg timeout**
The `useTestimonialCommercial.ts` hook calls `stitchVideosWithAudio` which uses the broken FFmpeg path. No fallback to cloud stitching exists.

**Fix:** Update `useTestimonialCommercial.ts` to use cloud stitching (`creatomate-stitch`) as the primary stitching method.

### Implementation Order

1. **Fix cloud stitching as primary** — Update `videoStitch.ts` to try `creatomate-stitch` first, FFmpeg as fallback. Update `useTestimonialCommercial.ts` similarly.
2. **Fix duplicate gallery condition** — One-line fix in Reels.tsx line 5166.
3. **Clean up navigation** — Remove Scripts, Videos, Commercial Studio from `Navigation.tsx` nav groups.
4. **Extract Reels components** — Break the monolith into 4 sub-components with shared context.

### Files to modify
- `src/lib/videoStitch.ts` — Add cloud stitching as primary path
- `src/hooks/useTestimonialCommercial.ts` — Use cloud stitching
- `src/pages/Reels.tsx` — Fix gallery condition, extract components
- `src/components/Navigation.tsx` — Remove redundant nav items
- New files: `src/components/reels/QuickModePanel.tsx`, `BeginnerModePanel.tsx`, `AdvancedModePanel.tsx`, `ReelResultsPanel.tsx`

