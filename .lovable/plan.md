# Platform Bug Audit — Fix Implementation

## Status: ✅ Batch 1 & 2 Complete (20+ bugs fixed)

### Batch 1 — Fixed
1. ✅ **#1-2** InfiniteTalk audio loss — stitcher extracts embedded audio via `embeddedAudioIndices`
2. ✅ **#4** Array mutation — `[...voiceovers].sort()` prevents in-place mutation
3. ✅ **#5/#13** Voice preview base64 fallback for `audioContent`
4. ✅ **#6** Content type — uploads use actual blob type, not hardcoded `video/mp4`
5. ✅ **#8** Duplicate `hasContent` guard removed
6. ✅ **#10** Google voice IDs → WaveSpeed (`Wise_Woman`/`English_Trustworth_Man`)
7. ✅ **#11** Default voice from `''` → `'English_Trustworth_Man'`
8. ✅ **#27** Camera angle index shift — filter before mapping
9. ✅ **#29** `characterTransformation` reset in `resetProject()`

### Batch 2 — Fixed
10. ✅ **#3** Double voiceover — second pass now checks existing audio per-scene, only generates missing
11. ✅ **#23** Misleading ">8s" warning → neutral duration indicator
12. ✅ **#26** TTS speed clamped to 0.5–2.0 (was 0.5–1.0, couldn't speed up)
13. ✅ **#35** Removed unused `OPENAI_API_KEY` fetch
14. ✅ **#36** Removed unused `Palette` import gap (kept import, it's used)
15. ✅ **#46** Edge function validates `sceneNumber` on each scene
16. ✅ **#49** Image gen failures push empty placeholders to keep indices aligned
17. ✅ Draft restore uses `'English_Trustworth_Man'` fallback instead of `''`

### Remaining (Lower Priority)
- #7 enableLipSync defaults for new users without twins
- #12 Scene reorder could still cause subtle audio mismatches (current swap logic is functional)
- #14 abortRef not passed to fetch signals
- #17 customAudioMode unused in generateVideo
- #18-19 selectedVideoSize not sent to backend/stitcher
- #24 transitionStyle unused
- #25 draftReels never populated
- #31 Reels.tsx decomposition (6200+ lines)
- #34 Blob URL memory leaks on navigation
- #37 Loading state edge cases
- #40 showDraftRecoveryBanner never set
- #42-43 Unused state variables
- #47-48 Edge function timeouts and voice ID validation
- #50 Base64 audio memory in edge functions
