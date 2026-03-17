

## Research: Google AI Studio Voices Integration

### Current State

The platform already has **Google Cloud TTS** integrated (`GOOGLE_CLOUD_TTS_API_KEY` is configured). It's used in two ways:
1. **Cloned voice synthesis** via `voiceCloningKey` (Google's voice cloning beta)
2. **Fallback TTS** when Speechify and WaveSpeed both fail (uses Journey-D/Journey-F voices)

However, it's only used as a silent fallback — users can't actively select Google voices.

### What "Google AI Studio Voices" Could Mean

Google offers two distinct voice systems:

1. **Google Cloud TTS** (already integrated) — 400+ voices across Wavenet, Neural2, Studio, Journey, and Polyglot families. High quality, production-grade. The API key is already configured.

2. **Gemini TTS** (newer, via Gemini API) — Gemini models can generate speech directly. This would use the Lovable AI gateway (`google/gemini-2.5-flash` etc.) but the gateway does not currently support audio output modality, so this path is not viable today.

### Recommended Approach

Since the `GOOGLE_CLOUD_TTS_API_KEY` is already set, we can expose Google's premium voices (Journey, Studio, Neural2) as **selectable voice profiles on AI Twins**. This fits the existing "voices must be tied to a twin" rule:

- Add a "Voice Style" selector on the AI Twin detail panel (e.g., "Cloned Voice", "Google Journey-F", "Google Studio-M", etc.)
- Store the selected voice engine + voice ID on the `ai_twins` table (new column or use existing `voice_cloning_key` with a prefix)
- Update the TTS edge function to route based on the twin's selected voice engine
- Twins without a cloned voice could use a Google Cloud voice instead of falling back to WaveSpeed defaults

### Implementation

| Step | Detail |
|---|---|
| Add `voice_engine` column to `ai_twins` | Values: `speechify`, `google-cloud`, `wavespeed`. Default: `speechify` |
| Expose Google voice picker in TwinDetailPanel | Dropdown of ~10 curated Google voices (Journey, Studio families) |
| Update TTS edge function routing | Check `voice_engine` to determine which provider to call |
| Update VoiceSelector | Show the voice engine badge (Cloned vs Google vs WaveSpeed) per twin |

### Files Changed

| File | Change |
|---|---|
| DB migration | Add `voice_engine` column to `ai_twins` |
| `src/components/ai-twin/TwinDetailPanel.tsx` | Add voice engine + Google voice selector |
| `supabase/functions/text-to-speech/index.ts` | Accept `voiceEngine` param, route accordingly |
| `src/components/VoiceSelector.tsx` | Show voice engine type per twin |

