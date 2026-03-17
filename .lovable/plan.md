

## Plan: Fix Reels UI Clutter and Make Intro/Outro AI-Generated

### Problems Identified

1. **6,226-line monolith page** with everything stacked vertically -- Topic Strategist, topic input, podcast toggle, 4-column settings grid, video size grid, cut scenes collapsible, lip sync collapsible (with full character management UI duplicated from beginner Step 3), intro/outro template selector, scene scripts card, character reference card, preview card, final video card. User has to scroll through all of it.

2. **Intro and outro narration are hardcoded templates** -- `getDefaultIntroText()` and `getDefaultOutroText()` return canned strings like "This is going to change how you think about {topic}." The AI only generates the middle content scenes. The intro/outro are appended after AI generation with these hardcoded lines.

3. **Duplicate outro scene** -- Lines 543-554 create BOTH a spoken outro scene AND a silent "CTA hold" scene with identical `getOutroVisualDescription()` visuals, resulting in two near-identical scenes at the end.

4. **Advanced mode duplicates Beginner Step 3's character UI** -- The lip sync collapsible section (lines 4300-4800) contains a full AI Twin picker, character generator, portrait upload, voice selector -- all of which already exist in Beginner Step 3.

### Implementation Plan

#### 1. Make Intro/Outro AI-Generated (Edge Function)

**File: `supabase/functions/generate-reel-script/index.ts`**

- Remove `getDefaultIntroText()`, `getDefaultOutroText()`, and their hardcoded template switch statements
- Instead, add intro/outro generation instructions directly into the AI system prompt when `hasIntro` or `hasOutro` is true:
  - Tell the AI: "Scene 1 must be a 3-second intro hook" (if intro enabled) with template style hint
  - Tell the AI: "The final scene must be a 2-second spoken outro/CTA" (if outro enabled) with CTA style hint
  - Increase `sceneCount` passed to the AI by 1 or 2 to account for intro/outro
- Remove the post-generation `scenes.unshift(introScene)` and `scenes.push(outroScene)` blocks (lines 511-555)
- Remove the duplicate silent CTA hold scene entirely
- Keep `getIntroVisualDescription()` and `getOutroVisualDescription()` for visual consistency but let AI write the narration
- Redeploy edge function

#### 2. Simplify the Reels UI -- Consolidate Advanced Mode into Tabs

**File: `src/pages/Reels.tsx`**

Replace the current vertical stack of cards in Advanced mode with a compact tabbed layout inside a single Card:

```text
+------------------------------------------+
|  [Settings] [Script] [Character] [Video] |
|------------------------------------------|
|  (only active tab content visible)       |
+------------------------------------------+
```

**Settings tab** (replaces the sprawling top section):
- Topic textarea + Enhance button
- Compact 2-column grid: Scene count, Duration, Hook style, Transition, Video size (as a simple Select instead of 4-button grid)
- Cut scenes toggle (inline, no collapsible)
- Intro/Outro toggle with minimal template picker (only when enabled)
- "Generate Script" button at bottom

**Script tab** (replaces Scene Scripts card):
- Shows generated scenes in a scrollable list
- Editable narrations
- Voice preview button
- "Continue to Character" button

**Character tab** (replaces the duplicated lip sync/character section):
- Single unified character picker: AI Twins grid, Generate Character, or Upload
- Voice selector
- This replaces BOTH the lip sync collapsible AND the character reference card

**Video tab** (replaces preview + final video cards):
- Generate Preview / Generate Video buttons
- Scene preview grid
- Final video player
- Download/Save/Stitch buttons

This eliminates ~1500 lines of duplicate UI and removes the need to scroll past 8+ cards.

#### 3. Remove Duplicate Character UI

- Delete the character management UI from the lip sync collapsible (lines ~4300-4600) since it will live in the Character tab
- The lip sync toggle itself becomes a simple switch in Settings tab

#### 4. Remove Silent CTA Hold Scene

**File: `supabase/functions/generate-reel-script/index.ts`**
- Delete lines 544-554 (the `ctaHoldScene` block) -- this duplicate scene adds nothing

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-reel-script/index.ts` | AI-generate intro/outro narration, remove hardcoded templates, remove duplicate CTA scene |
| `src/pages/Reels.tsx` | Restructure Advanced mode into tabbed layout, remove duplicate character UI |

### What This Fixes

- Scrolling reduced by ~60% in Advanced mode
- Intro/outro narrations are now unique, AI-written, and topic-relevant instead of generic templates
- No more duplicate outro scene
- Character setup exists in one place, not two
- Settings are compact and organized instead of sprawled across the page

