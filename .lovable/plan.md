

## Problem

Two issues:

1. **InfiniteTalk quality**: The edge function (`wavespeed-video/index.ts` line 276) maps `model: 'infinitetalk'` to the `infinitetalk-fast` endpoint (`https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk-fast`). The fast version is 480p at $0.015/s. The standard version (`https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk`) is 720p HD at $0.03/s — double the quality.

2. **Sora-2 not used in Movie Scene Creator**: `MovieSceneCreator.tsx` hardcodes `infinitetalk` for all single-character speaking scenes (line 1415) and never offers Sora-2 as an option for cinematic non-dialogue scenes. In Reels (`generate-reel-video`), Sora-2 is only used for intro/outro scenes.

## Plan

### 1. Add quality tier support for InfiniteTalk in the edge function

**File: `supabase/functions/wavespeed-video/index.ts`**

- Add a new model option `'infinitetalk-hd'` that routes to the standard (HD 720p) endpoint: `https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk`
- Keep `'infinitetalk'` mapped to `infinitetalk-fast` for backward compatibility in Reels (cost-sensitive)
- Update the model type to include `'infinitetalk-hd'`

### 2. Update client-side model types

**File: `src/lib/wavespeed.ts`**

- Add `'infinitetalk-hd'` to the model union type

### 3. Use HD InfiniteTalk in Movie Scene Creator

**File: `src/pages/MovieSceneCreator.tsx`**

- Change speaking scene model from `'infinitetalk'` to `'infinitetalk-hd'` for higher quality movie scenes (lines 1415, 3080)

### 4. Use Sora-2 for non-dialogue movie scenes

**File: `src/pages/MovieSceneCreator.tsx`**

- For conversation/non-lip-sync scenes (currently using `wan-2.5-i2v` at line 1406), switch to `sora-2` for cinematic quality with proper duration snapping (4/8/12/16/20s)

### 5. Redeploy the edge function

Deploy the updated `wavespeed-video` function.

### Summary of model routing after changes

| Context | Speaking/Lip-sync | Non-speaking/B-roll |
|---|---|---|
| Movie Scene Creator | `infinitetalk-hd` (720p) | `sora-2` (cinematic) |
| Reels | `infinitetalk` (fast, cost-efficient) | Kling/Wan/Sora-2 (unchanged) |
| Commercials | `infinitetalk` (fast, unchanged) | unchanged |

