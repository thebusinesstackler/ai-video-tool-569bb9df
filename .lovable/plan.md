# Simplify Movie Scene Creator — AI-First, One-Click UX

## Status: ✅ Implemented

## Changes Made

### 1. Hero "Make My Movie" CTA (Step 1)
- Replaced complex multi-panel layout with single hero card: textarea + "Make My Movie ✨" button
- Quick Start chips styled as pill buttons below textarea
- Pete AI, character selection, movie length moved into "Advanced Options" collapsible

### 2. Ungated generateAll
- Removed `selectedTwins.length >= 1` requirement — works with zero twins
- Character descriptions derived from story bible when no twins selected

### 3. Simplified KeyframeSceneCard
- Default view: title, description (2 lines), start frame image, video preview, single "Generate Scene ✨" button
- Dialogue shown as read-only summary
- All manual controls (prompts, camera angles, positions, lighting, mood, transitions) hidden behind "Customize" collapsible
- Removed 3-tab navigation (Keyframes/Audio/Settings)

### 4. Simplified Header
- Reduced to: Title + Save button + overflow menu (⋮) with New/Load/Transfer to Reels

### 5. Steps 2 & 3 Simplified
- Step 2 (Story Bible): Read-only summary with "Looks good, continue →" CTA; voice assignments in collapsible
- Step 3 (Outline): Read-only formatted text by default with "Edit" toggle; "Generate Scenes" as hero CTA

### 6. Step 4 Simplified
- Clean header: "Your Movie" + "Build & Download" button
- Bulk actions in overflow menu instead of collapsible
- Removed per-scene Coverage & Blocking from default view

# UI Improvements for Character + Voice Flow

## Status: ✅ Implemented

# Audit & Improvement Plan

## Status: ✅ Partially Implemented

### ✅ Done

**1. Cloud stitching as primary method**
- Replaced broken FFmpeg WASM in `videoStitch.ts` with Creatomate cloud stitching (canvas fallback)
- Updated Reels manual `stitchVideos` to try cloud first, canvas fallback
- Testimonial Ads already used cloud stitching — confirmed working
- Removed `@ffmpeg/ffmpeg` and `@ffmpeg/util` dependencies

**2. Fixed duplicate gallery condition**
- Added `previewScenes.length === 0` guard at line 5166 in Reels.tsx

**3. Cleaned up navigation**
- Removed Script Generator, Commercial Studio from nav
- Kept pages accessible via direct URL (not deleted)

### 🔲 Deferred

**4. Extract Reels into sub-components**
- QuickModePanel, BeginnerModePanel, AdvancedModePanel, ReelResultsPanel
- Deferred to a follow-up to reduce risk on 6000-line file
