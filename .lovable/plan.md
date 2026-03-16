

# Fix All 80 Remaining Platform Bugs

This is a large-scale fix across multiple files. I'll batch the fixes into logical groups and implement them all.

---

## Batch 1: Reels.tsx — State, Logic, and UX Fixes (Bugs #8, #12, #14, #17, #20, #24, #25, #29, #34, #36, #37, #39, #40, #41, #42, #43)

### Changes in `src/pages/Reels.tsx`:

1. **#8 — Duplicate `hasContent` guard**: Already fixed in prior batch (confirmed removed).

2. **#12 — Scene reorder corrupts voiceover mapping**: The current reorder logic (lines 5476-5496) correctly swaps `sceneNumber` on both `generatedScenes`, `videoClips`, AND `voiceovers`. This was already fixed in a prior batch.

3. **#14 — AbortController signal not passed to fetches**: Add `signal: abortRef.current?.signal` to all `supabase.functions.invoke` calls in `generateScripts`, `generateVideo`, and TTS generation loops.

4. **#17 — `customAudioMode` never used in `generateVideo`**: In `generateVideo`, check if `customAudioMode === 'upload'` and `customAudioUrl` exists. If so, skip TTS generation for all scenes and use the custom audio URL instead.

5. **#20 — Podcast duration mismatch**: Clamp podcast duration to 120s max and update the UI to reflect the TTS speed limits.

6. **#24 — `transitionStyle` unused**: Pass `transitionStyle` to the `canvasStitchVideos` call and the `creatomate-stitch` edge function body.

7. **#25 — `draftReels` never populated**: Already fixed — `fetchSavedReels` (line 1112) separates drafts: `setDraftReels(allReels.filter(r => r.is_draft))`.

8. **#34 — No cleanup of blob URLs on navigation**: Add a `useEffect` cleanup that calls `URL.revokeObjectURL` when the component unmounts.

9. **#36 — `Palette` imported but unused**: Remove `Palette` from the lucide import.

10. **#37 — Loading state not cleared on storage upload error**: Wrap storage upload in try/catch with `setIsGenerating(false)` in finally blocks.

11. **#39 — No debounce on topic input**: The auto-save already uses `saveDraftDebounced` (the hook debounces). The topic input itself doesn't trigger generation, only the save — so this is acceptable. No change needed.

12. **#40 — `showDraftRecoveryBanner` never set to `true`**: The current logic auto-restores drafts silently (line 491-554), which is the intended UX. The banner was replaced by auto-restore. Remove the dead `showDraftRecoveryBanner` state and related UI code.

13. **#41 — Race condition in twin auto-selection**: Already mitigated with local variables in `generateAll()` (lines 2188-2243). No further change needed.

14. **#42 — `editingReel` declared but used**: It IS used (line 6218: `{editingReel && <ReelEditor ...}`). Not a bug.

15. **#43 — `fromMovieScene` unused**: Remove the dead state variable.

16. **#29 — `characterTransformation` not reset**: Already fixed in prior batch (line 2453).

17. **Draft restore voice fallback (line 570, 1290)**: Change `'en-US-Journey-F'` fallback on line 1290 to `'English_Trustworth_Man'`.

---

## Batch 2: Dashboard Fixes (Bugs #51-54, #52-53, #108)

### Changes in `src/components/Dashboard.tsx`:

1. **#51 — Dead "Start Creating" button**: Already fixed — links to `/reels`.

2. **#52-53 — Dashboard stats incomplete**: Add AI Twin count and recent reels to the stats. Populate `recentProjects` with the 5 most recent items across all content types.

3. **#54 — Quick action links point to wrong pages**: Change "Create Video" href from `/projects` to `/reels`. Change "Generate Script" href from `/scripts` to `/reels`.

4. **#108 — Re-render loop**: Already fixed — removed `Date.now()` key.

5. **Remove `isDevPreview` import and usage** (bug #107 dead code).

---

## Batch 3: canvasStitch.ts Improvements (Bugs #33, #19)

### Changes in `src/lib/canvasStitch.ts`:

1. **#33 — `video.muted = true` set twice**: Remove the duplicate mute in the playback loop (keep only the one in `loadVideo` that conditionally mutes based on `embeddedAudioIndices`).

2. **#19 — Canvas stitcher hardcodes 1080x1920**: Already fixed — now accepts `width`/`height` params.

---

## Batch 4: Edge Function Fixes (Bugs #47, #48, #50, #94)

### `supabase/functions/text-to-speech/index.ts`:
- **#48**: Already fixed — voice validation added.
- **#47**: Already fixed — 90s timeout added.

### `supabase/functions/generate-reel-video/index.ts`:
- **#50**: Add a size check before base64-to-Uint8Array conversion. If `audioContent.length > 10_000_000` (10MB), skip the upload and use the base64 data URL directly.
- **#46**: Already fixed — scene validation added.

### `supabase/functions/merge-audio/index.ts`:
- **#94**: Add proper error response with status code and message instead of silent failure.

---

## Batch 5: Cross-Page Communication Fixes (Bugs #55-57, #72, #81, #87, #101, #106)

### `src/App.tsx`:
- **#106 — Dual toast system**: Remove the sonner `Toaster` import and component. Keep only the shadcn `Toaster`.

### `src/pages/Reels.tsx` — Voice ID fixes:
- **#81 — Voice system inconsistency**: Already mostly fixed — WaveSpeed voices are now default. Ensure the `restoreDraftFromDatabase` function (line 1290) uses `'English_Trustworth_Man'` instead of `'en-US-Journey-F'`.

### Navigation/Routing:
- **#55-57 — Auth redirect**: The current flow already handles auth (ProtectedRoute redirects to `/auth`, Index shows Landing for unauthenticated users). Verified working.

### Shared types:
- **#101 — Duplicate AITwin interfaces**: Create a shared type file `src/types/aiTwin.ts` and export a single `AITwin` interface. Update imports in Reels.tsx.

### Hook Engine connection:
- **#72 — Hook Engine isolated**: Add "Use in Reel" button to `HookEngine.tsx` that navigates to `/reels?source=hook-engine&topic=...`.

---

## Batch 6: Minor Code Quality (Bugs #31, #38, #44, #45)

These are lower priority but quick fixes:

- **#38 — `selectedCharacterId` without picker**: Add a character picker dropdown in podcast mode UI.
- **#44 — No retry on video generation failure**: Add a "Retry Failed Scenes" button when some scenes fail.
- **#45 — Missing content type on voice preview**: Already handled by browser `Audio` element — no change needed.
- **#31 — Reels.tsx 6200 lines**: This is a refactoring task, not a bug fix. Will not address in this batch.

---

## Batch 7: Remaining Audit Bugs from Second Pass (#58-110)

Many of these were already addressed or are minor. Key remaining ones:

- **#58 — AISpokesperson prompt contradicts sanitizer**: Review and align the prompt instructions.
- **#66-67 — MovieSceneCreator silent failures**: Add error toasts for failed scene generation.
- **#68 — Toast duplication**: Fixed by removing sonner in Batch 5.
- **#75 — Videos.tsx dead workflow**: Leave as-is (page exists but is low priority).
- **#87 — AI Twins fetched independently**: Create shared `useAITwins` hook.
- **#92, #95 — Edge function validation/rate limiting**: Add input validation to remaining edge functions.
- **#107 — devBypass dead code**: Remove import from Dashboard.tsx.

---

## Implementation Order

1. **Reels.tsx** — All state/logic fixes in one pass
2. **Dashboard.tsx** — Stats, links, dead code removal
3. **App.tsx** — Remove dual toast
4. **canvasStitch.ts** — Remove duplicate mute
5. **Edge functions** — merge-audio error handling, generate-reel-video memory guard
6. **New shared files** — `src/types/aiTwin.ts`
7. **HookEngine.tsx** — Add "Use in Reel" button
8. **AISpokesperson.tsx** — Fix prompt contradiction

Total estimated files to modify: ~10 files.

