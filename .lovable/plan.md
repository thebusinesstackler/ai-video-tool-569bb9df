

# Fix: Purge All "Closed Mouth / NOT Speaking" Directives

## Problem
You're exactly right. The prompts still tell the video model "NOT speaking, closed mouth" — which overrides the narration intent and produces silent video. There are **10 instances** across 4 files that need to go.

## Changes

### 1. `supabase/functions/generate-reel-video/index.ts` — 3 edits

- **Line 816**: Remove `NOT speaking or mouthing words. Closed mouth.` → `natural expression, confident pose, engaged with the moment.`
- **Line 878**: Remove `People should have closed mouths — not speaking or mouthing words.` entirely
- **Line 942**: Remove `People should have closed mouths — not speaking or mouthing words.` from fallback prompt

### 2. `supabase/functions/generate-twin-angles/index.ts` — 1 edit

- **Line 74**: `Closed mouth or slight smile - NOT speaking` → `Natural expression, relaxed and genuine`

### 3. `src/pages/AISpokesperson.tsx` — 4 edits

- **Line 496**: `closed mouth, natural micro-expression` → `natural micro-expression`
- **Line 505**: Remove `Person has CLOSED MOUTH — NOT speaking.`
- **Line 651**: `closed mouth, contemplative micro-expression, natural and candid — NOT posed` → `contemplative micro-expression, natural and candid`
- **Line 853**: `Character is NOT speaking — mouth closed, natural and candid.` → `Character in a natural, candid moment.`

### 4. `src/pages/CommercialStudio.tsx` — 1 edit

- **Line 329**: `CRITICAL: CLOSED MOUTH or slight smile.` → `EXPRESSION: Natural, relaxed.`

### 5. Redeploy edge functions
- `generate-reel-video`
- `generate-twin-angles`

## Result
Every "closed mouth," "NOT speaking," and "not mouthing words" directive is gone. Video models will no longer suppress audio or freeze expressions. Characters will have natural, living expressions — and narration will actually play.

