

## Remove WaveSpeed MiniMax TTS — Use Sora-2 Native Audio Everywhere

### Problem
WaveSpeed MiniMax TTS voices sometimes produce "Journey D"-style voices the user dislikes. Sora-2 generates varied, natural-sounding voices natively that the user prefers.

### Approach
Stop generating separate TTS audio via WaveSpeed MiniMax. Instead, pass the narration text directly into Sora-2's prompt so it generates the voice as part of the video. This is already working for intro/outro/b-roll scenes — we just need to extend it to narrator (speaking) scenes too.

### Changes

**1. Edge Function: `generate-reel-video/index.ts`**
- Remove the `generateWaveSpeedTTS` and `pollWaveSpeedTTSResult` functions (lines 70-166) — no longer needed
- Remove the `calculateTTSSpeed` helper
- Update the Sora-2 narrator scene routing (line 617-681): instead of generating TTS audio first and then trying to pass it to a lip-sync model, go straight to Sora-2 image-to-video with the narration embedded in the prompt (same pattern already used for intro/outro scenes)
- All narrator scenes become: image + prompt with `Audio (MANDATORY): person says EXACTLY: "..."` — no separate TTS step

**2. Edge Function: `generate-reel-voiceover/index.ts`**
- This function generates standalone voiceovers using WaveSpeed MiniMax. Since we're moving to Sora-2 native audio, this function becomes a lightweight passthrough — it can return a placeholder or be skipped entirely by the caller
- Alternatively, keep it but mark it as optional/deprecated so existing callers don't break

**3. Frontend: `src/components/VoiceSelector.tsx`**
- Simplify to only show cloned voices (for Speechify use cases) and the "Auto" option
- Remove references to WaveSpeed MiniMax voice IDs (English_Trustworth_Man, etc.)
- The "Auto" option now means "Sora-2 will generate a unique voice"

**4. Frontend: `src/pages/Reels.tsx`**
- Update `resolveVoiceForGeneration` to default to `'ai-auto'` which signals Sora-2 native audio
- Remove MiniMax voice references from UI labels

**5. Frontend: `src/components/ai-twin/TwinDetailPanel.tsx`**
- Remove "WaveSpeed MiniMax" engine option — keep only "Cloned Voice (Speechify)" for twins with cloned voices
- The non-cloned path now means "native model voice" (Sora-2/VEO3)

**6. Edge Function: `text-to-speech/index.ts` and `multi-voice-tts/index.ts`**
- Remove WaveSpeed MiniMax TTS code paths
- Keep Speechify path for cloned voice twins only

### What stays
- Speechify cloned voice support (for users who uploaded voice samples)
- Sora-2 and VEO3 native audio generation (already working)
- The voice prompt strategy: narration text embedded in video prompt with MANDATORY audio instructions

### Result
Every non-cloned voice scene uses Sora-2's native audio — producing unique, natural voices without any Journey D artifacts.

