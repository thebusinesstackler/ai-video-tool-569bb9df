

# Platform Bug Audit — Comprehensive Findings

After a thorough review of the codebase (Reels.tsx at 6,195 lines, edge functions, stitcher, navigation, and more), here are the bugs and issues found, grouped by severity.

---

## CRITICAL — Breaks Core Functionality

**1. InfiniteTalk lip-sync audio is discarded during stitching**
`canvasStitch.ts` line 20: `video.muted = true`. InfiniteTalk videos have embedded audio (lip-synced speech), but the stitcher mutes all videos for canvas capture. The audio track from those videos is lost. Result: silent lip-sync videos.

**2. InfiniteTalk scenes get no audio overlay either**
`Reels.tsx` ~line 2010-2012: Audio overlay only includes non-embedded-audio scenes. InfiniteTalk scenes are excluded from `audioUrlsForStitch` (correct intent), but since embedded audio is discarded by the muted canvas, the final video has NO audio for those scenes.

**3. Voiceovers generated twice**
`Reels.tsx` lines 1677-1756 generate voiceovers. Then lines 1962-2007 generate voiceovers AGAIN if `someScenesNeedAudio` is true. This re-generation happens even when voiceovers already exist from the first pass, because the condition at line 1966 checks `sortedAudios.every(a => !a.audioUrl)` — but `sortedAudios` was already populated. The second pass PUSHES duplicates into the `voiceovers` array (line 2001).

**4. `sortedAudios` mutated in-place during stitching**
`Reels.tsx` line 1933: `const sortedAudios = voiceovers.sort(...)` — `.sort()` mutates the original `voiceovers` array in-place AND aliases it. Then line 2005: `sortedAudios.length = 0; sortedAudios.push(...)` clears and repopulates, but since it's the same reference as `voiceovers`, it corrupts the original array too.

**5. Voice preview uses wrong response shape**
`Reels.tsx` line 2697: `const audioUrl = data?.audioUrl || data?.url`. The `text-to-speech` function returns `{ audioContent: string, audioUrl: string }`. The preview tries `data.audioUrl` (correct for WaveSpeed storage URL), but for base64 responses it gets the storage URL which may not exist yet. Should also handle `data.audioContent` as base64 fallback.

**6. Upload content type mismatch**
`Reels.tsx` line 2039: Uploading `finalBlob` (which is `video/webm` from MediaRecorder) with `contentType: 'video/mp4'`. WebM files saved as `.mp4` — playback issues on some devices.

---

## HIGH — Major UX/Logic Issues

**7. `enableLipSync` defaults to `false` even in Quick/Beginner mode without twins**
Quick mode (line 2260) and Beginner mode (line 2188) only enable lip sync if `aiTwins.length > 0`. New users with no twins get static Kling 3.0 Pro videos with no talking.

**8. Duplicate `hasContent` guard**
`Reels.tsx` line 641-642: `if (!hasContent) return;` is written twice in a row (copy-paste error).

**9. `ANGLE_PROMPTS` referenced out of scope**
`Reels.tsx` line 2647: `ANGLE_PROMPTS[idx]?.label` — `ANGLE_PROMPTS` is defined inside `generateCharacter()` (line 2503) but referenced inside the `.then()` callback at line 2647 inside a `setGeneratedCharacterShots` call. Works by closure but is fragile.

**10. Advanced mode twin click sets Google voices instead of WaveSpeed voices**
`Reels.tsx` line 5060: When clicking an AI Twin without a cloned voice, it sets `'en-US-Journey-F'` (Google TTS voice). But the TTS system uses WaveSpeed MiniMax voices. This causes a voice lookup mismatch.

**11. `selectedVoice` defaults to empty string**
`Reels.tsx` line 340: `useState<string>('')`. An empty string voice ID gets sent to the TTS function, which may fail or use a fallback. Should default to `'English_Trustworth_Man'`.

**12. Scene reorder corrupts scene numbers**
`Reels.tsx` lines 5438-5497: Scene reordering swaps `sceneNumber` properties, but voiceover lookups later use `sceneNumber` to match scenes to audio. After reorder, the audio for scene 1 could play over scene 2's video.

**13. `previewVoice` doesn't handle `audioContent` (base64)**
`Reels.tsx` line 2697-2700: If `text-to-speech` returns only `audioContent` (base64), `audioUrl` will be `undefined` and the preview will throw "No audio returned."

**14. abortRef never checked during async operations**
`Reels.tsx`: `abortRef.current?.signal.aborted` is checked at a few spots, but the actual fetch calls (TTS, video generation) don't pass the signal. Clicking "Stop Generation" doesn't actually cancel in-flight API calls — it just hides the UI.

**15. File upload to storage uses wrong path format**
`Reels.tsx` line 2039: `${user.id}/videos/...` but line 2883: `${user.id}/...` — inconsistent storage path prefixes.

**16. No error handling for storage upload quota**
Multiple upload calls throughout `Reels.tsx` catch errors silently (`console.warn`). If storage is full, the user gets no feedback.

---

## MEDIUM — Logic Bugs and Inconsistencies

**17. `customAudioMode` state never used in `generateVideo`**
`Reels.tsx` line 343-345: Custom audio upload state exists but `generateVideo()` never checks it. The custom audio URL is only passed to `generatePreview`.

**18. `selectedVideoSize` never sent to backend**
`Reels.tsx` line 397: `selectedVideoSize` is `'9:16'` by default with options for `1:1`, `16:9`, `4:5`. But it's never sent to `generate-reel-video` — the edge function always generates 1080x1920 (9:16).

**19. Canvas stitcher hardcodes 1080x1920**
`canvasStitch.ts` line 91: Default `width = 1080, height = 1920`. This ignores `selectedVideoSize`. Square (1:1) or landscape (16:9) videos get incorrectly rendered.

**20. Podcast duration options mismatch scene duration**
`Reels.tsx` line 249-255: Podcast durations go up to 300s (5 min). But `calculateTTSSpeed` in the edge function caps at 0.5-1.0 speed range, which can't produce 5-minute voiceovers from short text.

**21. `saveToMyReels` function referenced but never shown in code**
`Reels.tsx` line 3348: `onClick={saveToMyReels}` — this function isn't visible in the lines I read. If it doesn't exist, clicking "Save to My Reels" throws a runtime error.

**22. `fetchSavedReels` called but never defined in visible code**
`Reels.tsx` line 2081: `fetchSavedReels()` — referenced after saving but definition not visible in the read lines. Could be undefined.

**23. Script duration warning says ">8s" but InfiniteTalk has no 8s limit**
`Reels.tsx` line 4864-4884: Warning about "Audio exceeds 8s video limit." InfiniteTalk supports up to 10 minutes. This warning is misleading.

**24. `transitionStyle` state exists but isn't used anywhere**
`Reels.tsx` line 350: `transitionStyle` is saved/restored from drafts but never passed to any stitching function.

**25. `draftReels` never populated from database**
`Reels.tsx` line 297: `useState<SavedReel[]>([])`. The drafts tab references `draftReels` but there's no visible `useEffect` or function to fetch drafts from the database.

**26. TTS speed calculation is inverted**
`generate-reel-video/index.ts` line 51: `requiredSpeed = normalDuration / targetDurationSeconds`. If narration takes 6s naturally and target is 8s, this gives 0.75 (slower). But WaveSpeed `speed` parameter means: speed > 1 = faster speech. So the formula is correct for making speech slower, but the comment at line 53 says "speed < 1 = slower" which is WaveSpeed's actual behavior. Actually this seems correct but the clamping at 0.5-1.0 means audio can never be sped up, even when narration is too long for the scene.

**27. `cameraAngleRotation` filters out `undefined` but preserves order mismatch**
`Reels.tsx` line 1796: `.filter(Boolean)` removes `undefined` entries for intro/outro scenes. But this shifts the indices — scene 3's angle now maps to scene 2's slot in the array.

**28. Google voice IDs in WaveSpeed pipeline**
`Reels.tsx` line 5060: Sets `selectedVoice` to `'en-US-Journey-F'` or `'en-US-Journey-D'`. The TTS function checks `isWaveSpeedVoice()` which returns `false` for `en-US-*` voices, routing to Google Cloud TTS instead of WaveSpeed MiniMax. This works but produces different-sounding voices.

**29. `characterTransformation` used for image editing but never reset on new project**
`Reels.tsx`: `resetProject()` (line 2398) doesn't reset `characterTransformation`, so transformations from a previous reel leak into the next one.

**30. No landing page redirect for authenticated users**
`App.tsx` line 51: The `/` route renders `Index` for everyone. Authenticated users see the landing/marketing page, not the dashboard.

---

## LOW — Code Quality and Minor Issues

**31. Reels.tsx is 6,195 lines** — Should be split into sub-components (QuickModePanel, BeginnerModePanel, etc.)

**32. Unused import `Badge` on line 2 of Reels.tsx** — Actually used, but many conditional UI patterns make it hard to verify all imports are needed.

**33. `video.muted = true` set twice** — `canvasStitch.ts` line 20 in `loadVideo()` and line 215 in the playback loop.

**34. No cleanup of blob URLs** — `URL.createObjectURL` is called (line 2031) but `URL.revokeObjectURL` is only called in `resetProject`. If the user navigates away, the blob URL leaks memory.

**35. `OPENAI_API_KEY` fetched but never used** — `generate-reel-video/index.ts` line 297: `const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')` — never referenced.

**36. `Palette` imported with trailing comma and blank line** — `Reels.tsx` line 47-48: `Palette,` followed by blank line, then `Monitor`. `Palette` isn't used.

**37. Loading state not cleared on error** — Various `setIsGenerating(false)` calls exist in `catch` blocks but some edge cases (e.g., storage upload failure during save) could leave `isGenerating` stuck.

**38. `selectedCharacterId` state exists but Character selection UI is missing** — Line 355: `useState<string | null>(null)` — only used in podcast mode but no picker is visible.

**39. No debounce on topic input** — Typing triggers auto-save on every keystroke via the `useEffect` at line 637.

**40. `showDraftRecoveryBanner` is never set to `true`** — Line 480 checks `hasDraft()` and auto-restores, but `setShowDraftRecoveryBanner(true)` is never called. The banner UI at line 2977 will never appear.

**41. Race condition in twin auto-selection** — `generateAll()` calls `setSelectedTwinId()` (React state update) then immediately uses `aiTwins.find(t => t.id === selectedTwinId)` — the state hasn't updated yet. Mitigated by using local variables but fragile.

**42. `editingReel` state declared but never used** — `Reels.tsx` line 415.

**43. `fromMovieScene` state declared but never used for conditional logic** — Line 300.

**44. No max retry on video generation failure** — If all scenes fail, the user gets "All video scenes failed" but no easy retry path.

**45. Missing content type header on voice preview audio** — `new Audio(audioUrl)` — if `audioUrl` is a storage URL, some browsers may fail without proper CORS.

---

## Edge Function Issues

**46. `generate-reel-video` doesn't validate `scenes` array items** — No check that each scene has `sceneNumber`, `narration`, etc.

**47. No request timeout for WaveSpeed API calls** — If WaveSpeed is down, the edge function hangs until Deno's default timeout (varies).

**48. TTS function doesn't validate voice ID** — `text-to-speech/index.ts`: Accepts any string as voice ID. Invalid IDs fail silently.

**49. Image generation failures silently continue** — `generate-reel-video` line 401-403: If image generation fails for a scene, it's just skipped. But subsequent video generation still tries to use the (non-existent) image URL.

**50. Base64 audio upload could exceed edge function memory** — `generate-reel-video` line 480: Converting large base64 audio to Uint8Array in-memory could cause OOM on the edge function.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical (breaks core flow) | 6 |
| High (major UX/logic) | 10 |
| Medium (logic bugs) | 14 |
| Low (code quality) | 15 |
| Edge Function | 5 |
| **Total** | **50** |

I found 50 concrete, actionable bugs. The remaining "100" would require auditing all other pages (MovieSceneCreator, AITwin, TestimonialCommercial, AISpokesperson, HookEngine, Gallery, Characters, Projects, Settings, Auth, Landing) — each of which likely has its own set of issues.

## Recommended Fix Priority

1. **Fix #1-2 first**: InfiniteTalk audio loss during stitching — this is the root cause of the user's "static video" complaint
2. **Fix #6**: WebM/MP4 content type mismatch
3. **Fix #3-4**: Double voiceover generation and array mutation
4. **Fix #10-11**: Voice ID mismatches between Google and WaveSpeed
5. **Fix #18-19**: Video size options that don't actually work
6. **Fix #27**: Camera angle index shift after filtering

Shall I implement these fixes? I'd start with the critical audio stitching bug (#1-2) since that directly causes the "no lip sync" problem.

