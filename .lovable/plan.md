

## Fix Beginner Mode: Lip Sync ON by Default + Auto-Generate Character

### Problem
In beginner (easy) mode, lip sync starts as OFF and the user must manually create a character. The expectation is that beginner mode should automatically enable lip sync and generate a character from the script/topic when one isn't provided.

### Changes

**1. Default lip sync to ON in beginner mode (`src/pages/Reels.tsx`)**
- Change the initial `enableLipSync` state: when `isBeginner` or `isQuick`, default to `true` instead of `false`
- Also set `featureToggles.lipSync` to `true` by default in beginner/quick modes
- Update all the draft-restore paths to default lip sync ON for beginner mode (currently they restore `false` from old drafts)

**2. Auto-generate character when moving to Step 3 with no character (`src/pages/Reels.tsx`)**
- When beginner mode transitions to Step 3 (after script review) and no character/twin is selected, automatically trigger `generateCharacter()` using the topic — the function already supports deriving a character from the topic when the prompt is empty
- This means the user lands on Step 3 with a character already being generated

**3. Auto-generate character on "Generate" if none exists (`src/pages/Reels.tsx`)**  
- In the `generateAll` function, if beginner mode has no portrait and no twin, call `generateCharacter()` before proceeding instead of just auto-selecting the first twin
- This covers the case where the user skips Step 3 or has no saved twins

**4. Clean up stale WaveSpeed voice badge (`src/pages/Reels.tsx`)**
- Line 4812: Remove the `voice_engine === 'wavespeed'` check from the twin picker badge display (leftover from the MiniMax removal)

### Technical Detail
- The `generateCharacter` function (line 3139) already handles empty prompts by calling `deriveCharacterFromTopic(topic)` to auto-create a fitting character
- The beginner `generateAll` (line 2851) already auto-enables lip sync when a portrait exists — the fix ensures a portrait gets created first

