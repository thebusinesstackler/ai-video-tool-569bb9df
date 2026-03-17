

# Fix Character Voice Assignment in Movie Scene Creator

## Problem
When generating movie scene audio, characters without a cloned voice (`voice_cloning_key`) all fall back to the same default male Google voice (`en-US-Journey-D`). The system ignores the twin's `gender` field entirely, so female characters sound male. Most of your twins (16 out of 20) don't have a cloning key, meaning they all get the same voice.

## Root Cause
The voice resolution logic in `MovieSceneCreator.tsx` only checks for `voice_cloning_key`. If none exists, it passes no voice parameters to `text-to-speech`, which defaults to `English_Trustworth_Man` (WaveSpeed) or `en-US-Journey-D` (Google) — both male voices.

The `multi-voice-tts` edge function has the same problem: unassigned characters get alternating Google voices without considering gender.

## Solution

### 1. Pass gender to TTS in MovieSceneCreator (3 code paths)

In `generateLipSyncVideo`, `generateTransitionVideo`, and `generateAllVideos` — when no `voice_cloning_key` is found, pass the twin's `gender` to the TTS call so the edge function picks a gender-appropriate WaveSpeed voice:

```typescript
// Instead of just: { text, voice: 'en-US-Journey-D' }
// Pass: { text, voice: 'en-US-Journey-D', gender: twin.gender || 'male' }
```

For the single-voice paths, expand the fallback logic:
- If twin has `voice_cloning_key` → use it (existing behavior)
- Else → pass `gender` from the twin so TTS picks the right WaveSpeed voice

### 2. Update multi-voice-tts edge function

Add `gender` to the `VoiceAssignment` interface. When no cloning key matches, use gender to pick from WaveSpeed MiniMax voices instead of alternating Google voices:
- Female → `English_compelling_lady1`, `English_radiant_girl`, etc.
- Male → `English_magnetic_voiced_man`, `Deep_Voice_Man`, etc.

Add WaveSpeed TTS generation capability to `multi-voice-tts` (reuse the same WaveSpeed MiniMax API pattern from `text-to-speech`).

### 3. Always populate voice assignments from twins

Currently, voice assignments are only built from twins with `voice_cloning_key`. Change this to include ALL selected twins, passing their `gender` even when they lack a cloning key. This ensures every character gets a distinct, gender-appropriate voice.

### Files Changed
- `src/pages/MovieSceneCreator.tsx` — voice resolution in lip-sync, transition, and batch generation paths
- `supabase/functions/multi-voice-tts/index.ts` — add WaveSpeed support and gender-based voice selection

