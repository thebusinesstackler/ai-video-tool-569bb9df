
## Add AI Script Director Chat to Video Repo Pro

### Problem
Currently the page auto-generates videos immediately after AI analysis. Users can't discuss, refine, or give feedback on the script/scenes before committing to expensive video generation.

### Solution
Split the flow into **Chat Phase** (discuss script) → **Generate Phase** (make video), allowing back-and-forth conversation with the AI Script Director.

### Changes to `src/pages/VideoRepoPro.tsx`

1. **Split `analyzeAndGenerate` into two functions:**
   - `analyzeReference()` — sends the initial analysis request + reference/product, shows AI response in chat
   - `generateFromScript()` — extracts video prompts from the latest AI message and runs the existing Sora-2 generation pipeline

2. **Add `handleFollowUp()` function** — When the user types a follow-up message (after initial analysis), send the full `messages` history to the AI edge function so it can refine the script based on feedback. The AI responds with an updated analysis/script.

3. **Add state to track phase:**
   - `hasAnalysis` boolean — true once AI has produced a script with video-prompt blocks
   - `latestAnalysisText` — stores the most recent AI response containing video prompts

4. **Update composer behavior:**
   - Before analysis: existing flow (send with attachments)
   - After analysis: follow-up chat mode (send text only, AI refines script)
   - Show a prominent "🎬 Generate Video" button when video-prompt blocks are detected in the latest AI message

5. **UI: Add "Generate Video" button** — Appears after AI analysis, triggers `generateFromScript()` using the latest script. Styled as a gradient CTA.

6. **Composer hint text changes** — "Describe your 30-second ad idea..." → "Give feedback on the script or ask for changes..." after analysis

### What stays the same
- Video generation pipeline (Sora-2, stitching, audio trim, extend)
- History tab
- File upload / URL import
- Aspect ratio selector
