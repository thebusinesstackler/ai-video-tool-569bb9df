---
name: Voice Engine Modernization
description: Voice routing across Movies, Reels, and Lifestyle Stories
type: feature
---

**Reels & Lifestyle Stories** route narration through the same `text-to-speech` edge function as the **Movie Scene Creator**:

1. **AI Twin Speechify clone** when `voice_cloning_key` is a UUID (passed as `speechifyVoiceId`)
2. **AI Twin Google clone** when key exists but isn't a UUID (passed as `voiceCloningKey`)
3. **`gpt-4o-mini-tts`** fallback only when no Twin/voice clone is selected

Multi-character dialogue routes through `multi-voice-tts` (Gemini 2.5 Pro multi-speaker).

Lip-sync model (`wavespeed-ai/infinitetalk-hd`) is unchanged.

### Multi-speaker Conversation Mode (Reels + Lifestyle Stories)
- Component: `src/components/ConversationBuilder.tsx` (shared, 2–4 speakers)
- Client hook: `src/hooks/useConversationGenerator.ts`
- Flow:
  1. `generate-conversation-dialogue` writes labeled lines for N speakers (Claude)
  2. `generate-conversation-video` kicks off per-line TTS (cloned voice) + lip-sync tasks via `generate-talking-head-from-audio` → returns array of taskIds
  3. Client polls each task via `wavespeed-video`, then stitches in dialogue order via `creatomate-stitch`
- Only twins with a `voice_cloning_key` are selectable as speakers.
- Reels gets a "Conversation" tab; Lifestyle Stories shows the builder on the initial brand-input step.

### Wiring
- `src/lib/voiceUtils.ts` — `isSpeechifyVoiceId`, `buildVoicePayload`, `buildVoiceAssignments` shared helpers
- `supabase/functions/generate-reel-video/index.ts` — `tryCreateTTSUrl` accepts `aiTwin` + forwards `Authorization` header to invoke `text-to-speech`
- `src/pages/Reels.tsx` — passes `aiTwin` payload to the edge fn + Conversation tab
- `src/pages/LifestyleStories.tsx` — Twin picker overrides `match-speechify-voice` + ConversationBuilder
