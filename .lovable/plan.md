

# Fix Lifestyle Stories: Product Filtering, Music Fallback, and Video Assembly

## Problems Identified

1. **Unwanted product in prompt**: The `generate-lifestyle-concepts` edge function sends `brandAnalysis.product_type` directly to the AI. Whatever the brand analysis extracted gets baked into every concept — users have no way to remove or filter products before concept generation.

2. **Background music fails silently**: The `generate-music` function returns a non-2xx error (likely WaveSpeed API issue), but the code catches the error silently and marks music as "done" regardless.

3. **No video generation step**: After scenes (images), voiceover, and music are generated, the pipeline simply stops. There is no step to turn the scene images into actual video clips or stitch them together into a final video.

## Plan

### 1. Add product editing before concept generation
- On the Analysis step (step 2), make the "Product Type" field editable (an Input instead of plain text) so users can modify or clear the detected product before generating concepts.
- Pass the edited product type to `generate-lifestyle-concepts` instead of the raw brand analysis value.

### 2. Fix music error handling and add fallback status
- Track `'failed'` status for each production stage instead of always marking `'done'`.
- After scene generation, check how many scenes got images — show partial/failed counts.
- After voiceover and music, set `'failed'` if they threw errors.
- Show error indicators (red icon, "Failed" label) in the production UI for failed stages.
- Add a "Retry" button per failed stage.
- For music specifically: pass `mood` instead of `prompt` to `generate-music` (the edge function expects a `mood` field, but the client sends `prompt`).

### 3. Add video generation step (stitch scenes into video)
- After all assets are ready (scenes + voiceover), add a "Generate Video" button that calls `wavespeed-video` for each scene image (to animate the stills into short clips), then stitches them together with the voiceover and music via `creatomate-stitch`.
- Show a "Video Assembly" stage in the production dashboard.
- Display the final video with a player when complete.

### Files Modified
- `src/pages/LifestyleStories.tsx` — editable product field, failure tracking UI, retry buttons, video generation step with stitching
- `supabase/functions/generate-music/index.ts` — no changes needed (it already accepts `mood`)

### Technical Details
- The `generate-music` edge function expects `{ mood, duration }` but the client sends `{ prompt, duration }` — this is why music fails. Fix the client call to use `mood` instead of `prompt`.
- Video generation will use the existing `wavespeed-video` function (wan 2.5 model) to animate scene images into clips, then `creatomate-stitch` to assemble the final video with audio tracks.
- Production status will track: `scenes`, `voiceover`, `music`, `video` stages with values `queued | in_progress | done | failed`.

