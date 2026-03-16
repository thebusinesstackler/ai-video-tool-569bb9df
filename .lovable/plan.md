

## Plan: Fix Gender-Voice Mismatch and Improve Voice Auto-Detection

### The Problem

There are **two bugs** causing the female reference image to get a male voice:

1. **Legacy voice IDs in `analyzeReferenceImage`** (line 642-644): When a reference image is analyzed and detected as female, it sets `en-US-Journey-F` — a legacy Google Cloud voice ID that no longer exists in the WaveSpeed system. The `generate-reel-voiceover` edge function then maps this unknown ID back to a male voice (`English_Trustworth_Man`) via its fallback logic.

2. **Weak fallback in `generateAll`** (line 2070): If `ai-auto` fails all detection steps, it defaults to `English_magnetic_voiced_man` (male) instead of doing a smarter check.

### Available Voices (8 total)

**Female (4):** `English_compelling_lady1`, `English_radiant_girl`, `Calm_Woman`, `Inspirational_girl`
**Male (4):** `English_magnetic_voiced_man`, `English_Trustworth_Man`, `Casual_Guy`, `Deep_Voice_Man`

### Changes

**1. Fix `analyzeReferenceImage` voice assignment** (`src/pages/Reels.tsx` ~line 641-645)
- Replace `en-US-Journey-F` → `English_compelling_lady1`
- Replace `en-US-Journey-D` → `English_magnetic_voiced_man`

**2. Improve voice quality settings in `generate-reel-voiceover`** (`supabase/functions/generate-reel-voiceover/index.ts`)
- Add WaveSpeed voice settings for more natural output: adjust `speed`, `emotion`, and `pitch` based on content type
- Ensure the `gender` parameter from the client is properly used in voice resolution

**3. Pass gender context from reference image analysis to voiceover generation**
- When `analyzeReferenceImage` detects gender, store it as state so `generateAll` can pass `gender` to the voiceover edge function as a reliable fallback signal

### Files Modified
- `src/pages/Reels.tsx` — fix legacy voice IDs, improve gender detection flow
- `supabase/functions/generate-reel-voiceover/index.ts` — better voice quality prompting and gender-aware defaults

