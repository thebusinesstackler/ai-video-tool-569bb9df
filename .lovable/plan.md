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

### Changes Made

**A. Removed duplicate voice UI in beginner Step 3**
- Removed inline "Preview Voice" button and badge from character-ready card
- Single voice section kept as standalone "Character Voice" card

**B. Added skeleton placeholders during character generation**
- 5-cell pulsing skeleton grid shown while `isGeneratingCharacter` is true

**C. Switched AI Twin picker to 3-column grid in beginner mode**
- Changed from `grid-cols-4` to `grid-cols-3` for better tap targets
- Added voice badge indicator matching advanced mode

**D. Added sub-sections to Advanced Lip Sync**
- "Character" section: AI Twin picker, generate character, manual upload, character description
- "Voice & Model" section: lip sync model, voiceover source (AI/upload)
- Each in a bordered container with header

**E. Added "Skip Character" shortcut**
- Ghost button "Skip Character → Make My Reel" shown when no character is set
- Triggers `generateAll` directly
