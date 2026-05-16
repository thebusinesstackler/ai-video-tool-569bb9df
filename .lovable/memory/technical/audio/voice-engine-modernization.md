---
name: Voice Engine Modernization
description: Voice routing across Movies, Reels, and Lifestyle Stories
type: feature
---

**Reels & Lifestyle Stories** now route narration through the same `text-to-speech` edge function as the **Movie Scene Creator**:

1. **AI Twin Speechify clone** when `voice_cloning_key` is a UUID (passed as `speechifyVoiceId`)
2. **AI Twin Google clone** when key exists but isn't a UUID (passed as `voiceCloningKey`)
3. **`gpt-4o-mini-tts`** fallback only when no Twin/voice clone is selected

Multi-character dialogue still routes through `multi-voice-tts` (Gemini 2.5 Pro multi-speaker).

Lip-sync model (`wavespeed-ai/infinitetalk-hd`) is unchanged.

**Wiring:**
- `src/lib/voiceUtils.ts` — `isSpeechifyVoiceId`, `buildVoicePayload`, `buildVoiceAssignments` shared helpers
- `supabase/functions/generate-reel-video/index.ts` — `tryCreateTTSUrl` accepts `aiTwin` + forwards `Authorization` header to invoke `text-to-speech`
- `src/pages/Reels.tsx` — passes `aiTwin` payload to the edge fn
- `src/pages/LifestyleStories.tsx` — Twin picker (Mic select) overrides `match-speechify-voice` when a Twin clone is selected
