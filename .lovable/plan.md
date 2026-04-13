

# Plan: Simplify AI Spokesperson to Single Continuous Video

## Problem
AI Spokesperson splits scripts into multiple scenes (speaking + B-roll + transitions), generates separate videos for each, and stitches them via Creatomate. The user wants one continuous talking-head video for the full script — just the person on screen talking — identical to how Podcast mode works. B-roll will be added later in ChatCut.

## Solution
Replace the multi-scene `generateVideo` pipeline in AI Spokesperson with Podcast's single-clip approach: one TTS call, one portrait, one `infinitetalk-hd` render. No scene splitting, no B-roll, no stitching.

## Changes

### 1. Simplify `generateScript` prompt (`src/pages/AISpokesperson.tsx`)
- Change the script generation prompt to request a **single narration block** (no scene breakdown, no B-roll directions)
- Remove the multi-scene `scenes[]` structure from the prompt — just return `narration` and `visualDescription`
- Keep duration/word-count targeting as-is

### 2. Rewrite `generateVideo` to single-clip pipeline (`src/pages/AISpokesperson.tsx`)
Replace the current multi-scene pipeline (lines ~650-900) with:
1. Generate one TTS from the full `generatedScript.narration`
2. Generate one character portrait using the existing `generateSceneImage` helper (iPhone selfie style, like Podcast)
3. Submit one `infinitetalk-hd` task with the full audio + portrait
4. Poll until complete — no Creatomate stitching
5. Keep optional Wan 2.7 enhancement step
6. Set final video URL

This mirrors exactly what Podcast (`src/pages/Podcast.tsx` lines 262-299) does.

### 3. Remove multi-scene UI elements (`src/pages/AISpokesperson.tsx`)
- Remove/hide the scene gallery, scene shot cards, and multi-shot generation UI since there's only one continuous clip
- Keep the script preview, settings (mood, setting, camera angle), and video player

### 4. Update duration options
- Extend duration options to support longer videos (up to 180s) matching Podcast's `DURATION_OPTIONS`
- Currently limited to 15s; add 30s, 60s, 90s, 120s, 180s options

## Technical Details
- `infinitetalk-hd` already handles full-length audio up to 3 minutes in a single call (proven by Podcast mode)
- No new edge functions needed — reuses existing `text-to-speech`, `ai`, and `wavespeed-video`
- No database changes required
- The scene-splitting logic, Creatomate stitching, and Sora-2 B-roll calls are all removed from the main flow

