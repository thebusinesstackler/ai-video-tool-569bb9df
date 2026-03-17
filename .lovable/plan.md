

## Plan: Fix Draft Continue Editing, Background Music, Script Generator Integration, and Restore to Drafts

Four issues identified after code investigation:

---

### Issue 1: "Continue Editing" on Drafts Doesn't Let You Edit

**Root cause**: `restoreDraftFromDatabase` (line 1287) restores all state correctly and switches to the `create` tab, but it does NOT reset the `project.status` properly or clear the "completed reel" view state. If a previous reel was completed, the UI may still show the "Your Reel is Ready" section instead of the editor. Additionally, `generatedScenes` is always set to `[]` (line 1353) even though the draft may have had generated scenes with images — so the restored draft loses all visual progress.

**Fix** (`src/pages/Reels.tsx`):
- In `restoreDraftFromDatabase`: restore `generatedScenes` from `ds.generatedScenes` if available, and restore `previewScenes` image/audio URLs
- Reset completion-related state (e.g., `setProgress(0)`, clear any "reel ready" flags) so the editor view is shown
- Set the correct beginner step and ensure the active mode matches the draft's mode

### Issue 2: Background Music Toggle Does Nothing

**Root cause**: The `backgroundMusic` feature toggle (line 456) has a comment `// Background music toggle - could add music selection UI` — it's a no-op. The `generate-music` edge function exists and works (uses ElevenLabs), but it's only wired in the Testimonial Commercial page, not in Reels.

**Fix** (`src/pages/Reels.tsx`):
- When `backgroundMusic` toggle is enabled, show a music configuration panel (mood/prompt input + generate button)
- Add `backgroundMusicUrl` state and a `generateBackgroundMusic` handler that calls the `generate-music` edge function
- During final video stitching, if `backgroundMusicUrl` is set, merge it as a background audio track (the `creatomate-stitch` function already supports background audio, or use `merge-audio`)

### Issue 3: Script Generation Not Using ScriptGenerator Component

**Root cause**: Reels uses its own `generate-reel-script` edge function (line 1619) which is a separate, reel-optimized script generator. The `ScriptGenerator` component (from `/scripts` page) is available as a dialog (line 6520-6536) but is standalone — its output doesn't feed back into the reel pipeline.

**Fix** (`src/pages/Reels.tsx`):
- Add a callback prop or event to `ScriptGenerator` so when a script is generated there, it can be imported into the reel's scene list
- Alternatively, add a "Use in Reel" button in the ScriptGenerator dialog that converts the generated script into reel scenes and closes the dialog
- This connects the existing ScriptGenerator feature to the reel workflow

### Issue 4: "Restore Project" Should Save Last Video as Draft, Not Replace Current

**Root cause**: The user wants completed reels from the History tab to be restorable as drafts (so they can re-edit them) rather than the current behavior where `duplicateReel` just loads the script into a fresh create form and loses all generated assets.

**Fix** (`src/pages/Reels.tsx`):
- Add a "Restore as Draft" button in the History tab (alongside Duplicate, Edit, Download, Delete)
- This button saves a copy of the completed reel as a new draft (`is_draft: true`) with all its scenes, settings, and generated assets preserved
- Then navigates to the Drafts tab where the user can "Continue Editing" it
- Keep the existing "Duplicate" button for the lightweight script-only copy

---

### Files to Edit
1. **`src/pages/Reels.tsx`** — All four fixes (draft restore logic, background music UI + handler, ScriptGenerator integration, restore-as-draft button)
2. **`src/components/ScriptGenerator.tsx`** — Add optional callback prop for "Use in Reel" functionality

### No Backend Changes Needed
- `generate-music` edge function already exists
- `creatomate-stitch` / `merge-audio` already support background audio mixing

