# Platform Bug Audit — Batch 2: Full Platform Scan

## Status: 📋 Audit Complete — Ready for Implementation

### Previously Fixed (Batch 1 & 2): 17 bugs in Reels.tsx, canvasStitch.ts, generate-reel-video

---

## 🔴 CRITICAL — Cross-Platform Communication Issues

### Dashboard & Navigation

**51. Dashboard "Start Creating" button does nothing**
`Dashboard.tsx` line 200-202: `<Button variant="hero" size="lg">Start Creating</Button>` — no `onClick`, no `Link` wrapper. Dead button.

**52. Dashboard doesn't count AI Twins in stats**
`Dashboard.tsx` line 119-121: Total videos = projects + reels + movie_projects. Doesn't include testimonial_commercials, video_hooks, or ai_twins. Misleading stats.

**53. Dashboard "Recent Activity" always shows "Ready"**
`Dashboard.tsx` line 126: `recentProjects: []` — the array is always empty because projects data is fetched but never assigned to `recentProjects`. The `formatTimeAgo` function exists but is never used.

**54. Dashboard quick actions link to outdated pages**
`Dashboard.tsx` line 21-40: "Create Video" links to `/projects` (old WAN 2.5 workflow), "Generate Script" links to `/scripts` (standalone scripts). Neither links to `/reels` (the primary creation tool) or `/movie-scene-creator`.

### Authentication & Routing

**55. Auth page doesn't redirect after signup with email confirmation**
`Auth.tsx` line 182-186: On signup success, shows toast "Welcome to AI Video Creator!" but the user still needs to confirm email. The toast is misleading — should say "Check your email to confirm."

**56. No redirect from /auth for authenticated users who navigate directly**
`Auth.tsx` line 106-108: `useEffect` redirects on `user` change, but if user is already authenticated and navigates to `/auth`, there's a flash of the login form before redirect.

**57. Sign out navigates via `window.location.href` instead of React Router**
`Navigation.tsx` line 114: `setTimeout(() => { window.location.href = '/'; }, 100)` — causes full page reload instead of SPA navigation. Loses React state.

### AI Spokesperson (1911 lines)

**58. Script prompt tells AI to use em dashes and ellipses**
`AISpokesperson.tsx` line 332-333: "Use em dashes (—) for natural pauses" and "Use ellipses (...) for dramatic pauses" — but the TTS sanitizer in `text-to-speech/index.ts` line 21-24 replaces these with commas/periods. The AI generates them, TTS strips them. Contradictory instructions.

**59. `selectedDuration` used as string but calculated as number**
`AISpokesperson.tsx` line 328: `parseInt(selectedDuration)` — works, but scattered `selectedDuration` is passed around as string `'15'` creating type confusion.

**60. No loading state for AI Twin fetch on first mount**
`AISpokesperson.tsx` line 196-223: `loadingTwins` is `true` initially but the component renders a "No AI Twins" warning before twins finish loading.

**61. Draft auto-save runs on EVERY state change**
`AISpokesperson.tsx` line 179-194: `useEffect` with 13 dependencies saves draft on every keystroke, toggle, or selection. No debounce.

**62. `generateScript` requires `selectedTwin` but beginners may not have one**
`AISpokesperson.tsx` line 313: `if (!message.trim() || !selectedTwin) return;` — silently returns with no error toast if no twin is selected.

**63. Voice cloning key sent as `voiceCloningKey` vs `clonedVoiceUrl`**
`AISpokesperson.tsx` uses `clonedVoiceUrl` parameter name, but `MovieSceneCreator.tsx` line 337 uses `voiceCloningKey`. The `text-to-speech` function accepts both but inconsistent naming causes confusion.

### Movie Scene Creator (4235 lines!)

**64. MovieSceneCreator.tsx is 4235 lines**
Even larger than Reels.tsx was. Should be decomposed.

**65. Voice preview sends Google voice ID `'en-US-Journey-D'` as base voice**
`MovieSceneCreator.tsx` line 335: `voice: 'en-US-Journey-D'` — when doing voice preview, it sends a Google TTS voice ID. This routes to Google Cloud TTS instead of WaveSpeed, producing inconsistent voice quality.

**66. `autoSaveField` called without checking user auth**
`MovieSceneCreator.tsx` line 288-298: `useEffect` triggers `autoSaveField({ outline })` whenever outline changes, but doesn't check if user is authenticated first. RLS will reject the update silently.

**67. Scene data shape inconsistency**
`MovieSceneCreator.tsx` line 20-32 defines `MovieScene` with `dialogue`, `imagePrompt`, etc. But `Movies.tsx` line 20-32 defines an identical but separate `MovieScene` interface. Changes to one won't affect the other.

### Testimonial Commercial (943 lines + 721 line hook)

**68. Uses `toast` from sonner AND `useToast` from custom hook**
`TestimonialCommercial.tsx` line 13: `import { toast } from 'sonner'`. But other pages use `useToast` from `@/hooks/use-toast`. Two different toast systems running simultaneously — inconsistent UX.

**69. `useTestimonialCommercial` doesn't clean up audio URLs**
`useTestimonialCommercial.ts` line 438-450: Uploads audio to storage but never tracks blob URLs for cleanup. Old audio files accumulate in storage.

**70. `creditError` referenced but never defined in visible scope**
`useTestimonialCommercial.ts` line 384: `if (creditError) break;` — `creditError` is not defined in the visible function scope, will be `undefined` and never break.

**71. Character group deduplication is fragile**
`useTestimonialCommercial.ts` line 290-300: Groups segments by character description string match. If one segment says "A professional woman" and another says "Professional woman", they get different groups and different character images.

### Hook Engine (618 lines)

**72. Hook Engine doesn't connect to Reels pipeline**
`HookEngine.tsx` — Generates video hooks but there's no "Use in Reel" or "Transfer to Reels" button. Hooks are isolated. User has to copy-paste.

**73. Hook scores are AI-generated but presented as metrics**
`HookEngine.tsx` line 69-78: `ScoreBar` renders scores like `scrollStop: 8.5` but these are AI-hallucinated numbers, not actual measurements. No disclaimer.

### Videos Page (1931 lines)

**74. Videos page still references old model costs and names**
`Videos.tsx` line 75-86: Only knows about `wan-2.5-i2v`. Doesn't know about InfiniteTalk, Kling 3.0 Pro, WAN 2.5 text-to-video, or any model used in Reels/Commercials.

**75. Videos page is essentially abandoned**
`Videos.tsx` — 1931 lines of an old workflow that creates individual video segments. Completely separate from the Reels pipeline, Movie Scene Creator, or AI Spokesperson. But still in navigation under "Projects" via indirect link.

### Projects Page (643 lines)

**76. Projects page shows old model names**
`Projects.tsx` line 63-73: `MODEL_NAMES` includes 'VEO3 (Google)', 'Seedream V4', 'VIDU' — models that may not be available or used anymore. Misleading.

**77. Projects page stitching uses old `stitchVideos` function**
`Projects.tsx` line 26: `import { stitchVideos } from '@/lib/videoStitch'`. This is the legacy wrapper — works but doesn't use the improved `canvasStitchVideos` with embedded audio support.

### Gallery Page

**78. Gallery migration runs indefinitely**
`Gallery.tsx` line 63-79: `while (remaining > 0)` migration loop — if the edge function keeps returning `remaining > 0` due to a bug, this runs forever with no max iterations.

### Settings Page

**79. Settings page only has voice preset — no actual settings**
`Settings.tsx` — Only setting is "Loop AI Director Voice" which uses browser `speechSynthesis`. No account settings, no API key management, no video quality preferences, no storage management.

**80. Voice preview uses browser speechSynthesis, not actual TTS**
`Settings.tsx` line 27-49: Preview uses `window.speechSynthesis` which sounds completely different from WaveSpeed MiniMax TTS. User hears one voice in settings, gets a different voice in production.

---

## 🟠 HIGH — Shared Component Issues

### Voice System Inconsistency

**81. Three different voice systems coexist**
- WaveSpeed MiniMax (Reels, Testimonials) — `text-to-speech` function
- Google Cloud TTS (Movie Scene Creator, cloned voices) — same function, different path
- Browser speechSynthesis (Settings preview) — client-side only
No unified voice preview that matches production output.

**82. `VoiceSelector` component lists 8 voices but `text-to-speech` function has 17**
`VoiceSelector.tsx` line 36-49: Only shows 8 voices (4 male, 4 female). `text-to-speech/index.ts` line 40-45: Has 17 WaveSpeed voices. 9 voices are hidden from users.

**83. `isWaveSpeedVoice()` false positive for custom voice IDs**
`text-to-speech/index.ts` line 51-53: `!voice.startsWith('en-')` — any voice ID that doesn't start with 'en-' is treated as WaveSpeed. A typo like `'EEnglish_Trustworth_Man'` would pass.

### Video Player

**84. `VideoPlayer` component doesn't handle WebM files**
Throughout the app, `VideoPlayer` is used for playback. Canvas stitcher produces WebM, but some browsers (Safari) can't play WebM. No fallback or format detection.

### Image Generation

**85. `generate-scene-image` called with inconsistent `aspectRatio` values**
Different pages send different values: `'1:1'`, `'9:16'`, `'16:9'` — some send as strings, edge function may not validate.

### Layout

**86. Layout provides consistent wrapper but each page defines its own header**
`Layout.tsx` wraps pages with Navigation. But pages like `Reels.tsx`, `AISpokesperson.tsx`, `MovieSceneCreator.tsx` each have their own h1 header patterns. No shared `PageHeader` component.

---

## 🟡 MEDIUM — Logic & Data Issues

### Data Isolation Between Features

**87. AI Twins not shared across features**
Each page (`Reels.tsx`, `AISpokesperson.tsx`, `MovieSceneCreator.tsx`, `TestimonialCommercial.tsx`) loads AI Twins independently with its own query. No shared hook or context.

**88. No shared "active project" concept**
Each feature (Reels, Movies, Commercials, Spokesperson) has its own independent state. User can't "continue" a reel from the dashboard or see "last worked on" across features.

**89. Generated images not saved to Gallery automatically**
`generate-scene-image` saves to `generated_images` table but Gallery page reads from `generated_images` + storage. Reels-generated images aren't browseable in Gallery unless explicitly saved.

**90. Movie projects can't transfer scenes to Testimonial Ads**
MovieSceneCreator has "Transfer to Reels" but no "Transfer to Commercial" option. Isolated workflows.

**91. Hook Engine hooks not saved with project context**
`video_hooks` table has `video_url` and `video_title` but no `project_id` or `reel_id`. Can't link a hook back to the reel it was generated for.

### Edge Function Issues

**92. `ai` edge function is a generic proxy with no rate limiting**
`supabase/functions/ai/index.ts` — Generic AI proxy used by multiple features. No per-user rate limiting, no request size validation.

**93. `generate-content-strategy` and `generate-commercial-strategy` duplicate logic**
Two separate edge functions that both generate AI content strategies. Could be unified.

**94. `merge-audio` edge function failure silently falls back to first audio**
`videoStitch.ts` line 40-43: If `merge-audio` fails, it just uses `audioUrls[0]`. Other audio tracks are silently lost. No user notification.

**95. `upscale-video` and `upscale-image` don't validate file sizes**
No pre-check for file size limits. Large files will fail with cryptic timeout errors.

**96. `clone-voice` and `clone-voice-speechify` — two voice cloning systems**
Two separate edge functions for voice cloning with different APIs. No unified interface.

### State Management

**97. Every page manages its own loading/error/data lifecycle**
No shared data fetching patterns (like React Query hooks for AI Twins, saved voices, etc.). Each page has its own `useEffect` → `setState` pattern.

**98. `useCreatorMode` persists to database but reads before write completes**
`useCreatorMode.ts` — Writes to `user_preferences` table but the UI updates optimistically. If the DB write fails, mode is out of sync.

**99. localStorage used for AI Twin cache without expiry**
`AITwin.tsx` line 44-58: `CACHE_KEY = 'ai_twins_cache'` — cached indefinitely. If user creates a new twin on another device, the cache is stale until manually cleared.

**100. `useReelDraftAutoSave` and `useCommercialDraft` have identical patterns**
Two separate hooks with near-identical auto-save/restore logic. Should be a generic `useAutoSaveDraft` hook.

---

## 🔵 LOW — Code Quality & Cleanup

**101. Duplicate `AITwin` interface defined in 5+ files**
`Reels.tsx`, `AISpokesperson.tsx`, `MovieSceneCreator.tsx`, `Movies.tsx`, `AITwin.tsx` — each defines its own `AITwin` interface with slightly different fields. Should be shared type.

**102. `CommercialStudio` page exists but removed from nav**
`CommercialStudio.tsx` is importable at `/commercial-studio` but not in navigation. Orphaned page.

**103. `Scripts` page exists but removed from nav**
Same as above — accessible at `/scripts` but not navigable.

**104. `NotFound` page doesn't suggest valid routes**
Generic 404 with no helpful navigation. Should show "Did you mean..." with valid routes.

**105. No SEO metadata on any page**
No page titles, descriptions, or Open Graph tags. Landing page has no meta tags. All pages show default `<title>` from index.html.

**106. `Toaster` imported from BOTH `@/components/ui/toaster` and sonner**
`App.tsx` line 2-3: Both toast systems are mounted globally. Some pages use one, some use the other.

**107. `isDevPreview` is hardcoded to `false`**
`devBypass.ts` line 4: `export const isDevPreview = false;` — dead code. The entire devBypass module does nothing.

**108. `componentKey` in Dashboard forces re-render**
`Dashboard.tsx` line 64: `const componentKey = \`dashboard-\${Date.now()}\`` — creates a new key on every render, defeating React's reconciliation. Component always unmounts/remounts.

**109. No loading skeleton for any data list**
Projects, Movies, Gallery, Characters — all show a spinner while loading, then jump to content. No skeleton UI for smooth transitions.

**110. Mobile navigation closes on route change but doesn't animate**
`Navigation.tsx` line 102-104: `setMobileOpen(false)` on pathname change — instant hide, no smooth close animation.

---

## Summary

| Category | Count |
|----------|-------|
| Critical (cross-platform communication) | 7 (#51-57) |
| Critical (feature-specific) | 15 (#58-72) |
| High (shared components) | 6 (#81-86) |
| Medium (data isolation & edge functions) | 14 (#87-100) |
| Low (code quality) | 10 (#101-110) |
| **New bugs this audit** | **52** |
| **Previous bugs (Batch 1-2)** | **50** |
| **Grand Total** | **102** |

## Recommended Fix Priority

### Immediate (breaks user experience)
1. **#51**: Dead "Start Creating" button on dashboard
2. **#54**: Dashboard links to wrong pages
3. **#58**: Contradictory TTS prompt vs sanitizer
4. **#68/#106**: Dual toast systems causing inconsistent UX
5. **#108**: Dashboard re-renders on every cycle

### High Priority (workflow integration)
6. **#72**: Hook Engine → Reels transfer
7. **#87**: Shared AI Twins hook
8. **#101**: Shared type definitions
9. **#81**: Unified voice system

### Medium (cleanup)
10. **#75/#102/#103/#107**: Remove dead code and orphaned pages
