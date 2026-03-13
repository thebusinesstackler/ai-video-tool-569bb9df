

# Simplify Movie Scene Creator — AI-First, One-Click UX

## Core Problem
The current UI has too many buttons, options, and manual steps. Users don't know what to do. The "Generate Complete Movie" button only appears if you select an AI Twin first — most users never find it. Each scene card has 3 tabs, 10+ buttons, manual prompt editing, camera angle selectors, and position inputs. It reads like a professional editing suite, not something approachable.

## Design Philosophy
**Make the default path require exactly 2 actions: type an idea → click "Make My Movie."** Everything else becomes optional advanced controls hidden behind a single "Customize" toggle.

## Changes

### 1. Redesign Step 1 — Single Hero Input (MovieSceneCreator.tsx)

**Current**: Pete AI chat box + Quick Start buttons + Character selection card with 3 tabs (Twins/Characters/Gallery) + Movie Idea display card + Movie Length selector + "Generate Complete Movie" button (only if twin selected) + "or step by step" divider + Story Bible / Outline buttons + How It Works collapsible.

**New layout**:
- Large centered hero card: "What's your movie about?" with a big textarea and a prominent **"Make My Movie ✨"** button below it
- The button triggers `generateAll` regardless of whether a twin is selected — if no twin, it just skips the voice-assignment steps and uses default voices
- Quick Start sample chips below the textarea (same as now, but styled as pill buttons)
- **Collapsible "Advanced Options"** section below containing: Movie Length selector, Character/Twin selection, and step-by-step buttons
- Remove the separate "Current Movie Idea" card — the textarea IS the idea
- Remove the Pete AI chat assistant from the main flow (move it into a floating help button or remove entirely — it adds confusion)

### 2. Auto-generate without requiring twin selection (MovieSceneCreator.tsx)

**Current**: `generateAll` is gated behind `selectedTwins.length >= 1`. Users who haven't created an AI Twin see a dashed box saying "Select AI Twins above to enable one-click movie generation" — a dead end.

**Fix**: Allow `generateAll` to run with zero twins. In the function, skip voice-assignment steps when no twins are selected. The button becomes always visible when `movieIdea.trim()` is truthy.

### 3. Simplify KeyframeSceneCard — Default to Auto Mode (KeyframeSceneCard.tsx)

**Current**: Each scene card shows 3 tabs (Keyframes, Audio, Settings) with manual prompt textareas, camera angle selectors, position inputs, "Generate" and "Auto-Generate" buttons per frame, plus transition controls.

**New default view**:
- Scene card shows: title, description (2 lines), start frame image (or placeholder), and a single **"Generate Scene ✨"** button that calls `onDescribeAndGenerate` for both frames + auto-generates video
- Dialogue shown as read-only chat bubbles (already exists)
- Generated video shown inline when ready
- All manual controls (prompt editing, camera angles, position inputs, lighting, mood, transition settings) hidden behind a **"Customize"** collapsible
- Remove the 3-tab navigation entirely from default view — merge into: main view (images + video + dialogue) and collapsible advanced section

### 4. Simplify Step 4 header (MovieSceneCreator.tsx)

**Current**: "Scenes" header + "Build Movie" button + collapsible "Bulk Actions" + scene timeline + per-scene coverage/blocking collapsibles.

**New**:
- Header: "Your Movie" + scene count + "Build & Download" button
- Remove the Bulk Actions collapsible entirely (regenerate dialogue can go into an overflow menu)
- Remove per-scene Coverage & Blocking collapsibles — these are pro features that confuse casual users. Put them behind a single "Director Mode" toggle at the top that reveals all advanced per-scene tools
- Scene timeline stays but simplified

### 5. Clean up the header bar (MovieSceneCreator.tsx)

**Current**: Title + New/Load/Save buttons + CommercialTemplateSelector + StoryboardExport + "Transfer to Reels" button — 6+ action items.

**New**: Title + Save button + overflow menu (⋮) containing: New, Load, Export Storyboard, Transfer to Reels, Templates. Reduces visual noise from 6 buttons to 2.

### 6. Simplify Steps 2 & 3 — Make them feel automatic

- Step 2 (Story Bible): Show as a read-only summary card. Characters, logline, and structure displayed cleanly. Voice assignment dropdowns only shown if user has AI Twins. Add a "Looks good, continue →" button prominently.
- Step 3 (Outline): Show outline as read-only formatted text (not an editable textarea by default). Add "Edit" toggle for power users. The "Generate Scenes" button should be the hero CTA. Remove Location Manager from default view — auto-extract locations silently during generateAll.

## Summary of Removals
- Pete AI Assistant from main flow (confusing extra step)
- 3-tab navigation in scene cards (Keyframes/Audio/Settings)
- Manual prompt textareas as default (hidden in Customize)
- Twin-required gate on one-click generation
- Bulk Actions collapsible
- Coverage & Blocking tools from default view
- 6 header buttons → 2

## Files Modified
1. `src/pages/MovieSceneCreator.tsx` — Steps 1-4 JSX restructure, header cleanup, `generateAll` ungating
2. `src/components/KeyframeSceneCard.tsx` — Simplified default view with "Generate Scene" CTA, manual controls in collapsible

