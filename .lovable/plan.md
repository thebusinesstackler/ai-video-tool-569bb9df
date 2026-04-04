

## Fix Sora-2 Illegible Speech — Restore TTS + Lip-Sync Pipeline for Narrator Scenes

### Problem
Sora-2 is a video model, not a speech model. When narration text is embedded in the prompt, the generated audio is often garbled and unintelligible. The speech quality is unreliable.

### Solution
Restore a two-step pipeline for narrator (speaking) scenes:
1. **Generate clear TTS audio** using OpenAI's `gpt-4o-mini-tts` model (high quality, expressive, varied voices — no "Journey D")
2. **Generate lip-synced video** using InfiniteTalk HD (`wavespeed-ai/infinitetalk`) which takes image + audio and produces perfectly synced talking-head video

Keep Sora-2 for intro/outro/b-roll scenes (no speech needed).

### Why OpenAI TTS
- OpenAI API key is already configured in the project
- `gpt-4o-mini-tts` supports instructable voices with a `voice` parameter (alloy, echo, fable, onyx, nova, shimmer, sage, coral, ash, ballad) — all sound different and natural
- Supports a text `instructions` field to control tone/style (e.g., "Speak with confident energy, like a YouTube creator")
- No "Journey D" — every voice is distinct and high quality
- Returns audio directly as mp3 bytes

### Changes

**1. Edge Function: `generate-reel-video/index.ts`**
- Add `generateOpenAITTS(text, apiKey, voice?)` function that calls `POST https://api.openai.com/v1/audio/speech` with model `gpt-4o-mini-tts`
- Auto-select voice based on character gender (e.g., `onyx`/`echo` for male, `nova`/`shimmer` for female)
- Upload the resulting MP3 to Supabase Storage and get a public URL
- Update the Sora-2 narrator routing (line 499-523): instead of embedding narration in Sora-2's prompt, first generate TTS audio, then route to InfiniteTalk HD (`wavespeed-ai/infinitetalk`) with image + audio URL
- Keep Sora-2 for intro/outro/b-roll (lines 525-567) unchanged — no speech in those

**2. Edge Function: `generate-reel-video/index.ts` — InfiniteTalk fallback (line 569-587)**
- Same fix: generate OpenAI TTS first, then call InfiniteTalk HD with the audio

**3. Edge Function: `text-to-speech/index.ts`**
- Add OpenAI TTS as a fallback after Speechify/Google cloned voice — so non-cloned `ai-auto` voices use OpenAI `gpt-4o-mini-tts` instead of failing

**4. No frontend changes needed**
- The voice selector already shows "Auto" which will now route to OpenAI TTS + InfiniteTalk

### What stays the same
- Speechify cloned voice support
- Sora-2 for intro/outro/b-roll (visual-only scenes)
- VEO3 native audio path (VEO3 handles speech better than Sora-2)
- Caption/karaoke system

### Result
Narrator scenes get crystal-clear, natural speech from OpenAI TTS with perfect lip sync from InfiniteTalk, while non-speaking scenes keep using Sora-2's cinematic quality.

