

# Plan: Loop AI Director — Live Timeline Review & Auto-Fix

## Problem
When you tell Loop AI to "review the entire timeline," it can only suggest text edits via action blocks. It cannot regenerate images, generate B-roll previews, or check character consistency — it just updates scripts and durations.

## Solution
Add new action types (`regenerateCharacter`, `regenerateBroll`) to the Loop AI Director's action system, plus update the system prompt to support a full "review mode" where the AI reads every segment, checks narrative coherence, visual consistency, and pacing, then outputs a batch of actions to fix everything — including triggering image regeneration.

## Changes

### 1. Edge Function: `generate-commercial-strategy/index.ts`
- Add `regenerateCharacter` and `regenerateBroll` actions to the system prompt documentation
- Add a "Review Mode" instruction block: when the user says "review", "check the timeline", "does this make sense", etc., the AI should analyze ALL segments holistically — scripts, character descriptions, B-roll prompts, durations, transitions — then output a single action block with all needed fixes
- Instruct the AI to maintain character consistency: if the same character appears in multiple scenes, flag mismatched descriptions and unify them

### 2. `LoopAIDirector.tsx` — `applyEditActions`
- Handle new action `regenerateCharacter`: calls `onGenerateCharacter(segmentId, description)` to regenerate the 6-angle character images for a speaking segment
- Handle new action `regenerateBroll`: calls a new prop `onGenerateBrollPreview(segmentId, prompt)` to regenerate a B-roll image
- Handle new action `updateCharacterDescription`: updates character description while preserving existing reference images (for consistency fixes without regenerating)
- After all actions are applied, show a summary toast with counts of what was changed vs regenerated

### 3. `LoopAIDirector` Props
- Add `onGenerateBrollPreview: (segmentId: string, prompt: string) => Promise<void>` prop

### 4. `TestimonialCommercial.tsx`
- Pass `generateBrollPreview` to `LoopAIDirector` as the new prop

### 5. System Prompt — Review Mode Instructions
The AI will be told:
- When user says "review" / "check" / "does this make sense": analyze every segment for narrative flow, pacing issues, character consistency, weak scripts, missing B-roll, and output a comprehensive action block
- Flag which scenes need image regeneration vs just text fixes
- After outputting the action block, explain what was changed and confirm "I'm done — take a look"
- For character consistency: if same character appears in multiple scenes, ensure descriptions match and trigger `regenerateCharacter` only on scenes with mismatched or missing images

