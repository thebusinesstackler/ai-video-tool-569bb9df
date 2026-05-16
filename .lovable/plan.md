
## Goal
Replace the `gpt-4o-mini-tts` narration path in **Reels** and **Lifestyle Stories** with the same voice stack the Movie Scene Creator uses:

1. **Speechify** cloned voice when an AI Twin with a Speechify `voice_cloning_key` is selected
2. **Gemini 2.5 Pro multi-speaker** when the script has 2+ characters
3. Google cloned voice as a silent fallback (already inside the existing function)

No new edge function is needed — both `text-to-speech` and `multi-voice-tts` already do all the heavy lifting. The work is mainly **routing** + **passing twin metadata** through the Reels/Stories pipeline.

---

## Changes

### 1. `supabase/functions/generate-reel-video/index.ts`
Currently `tryCreateTTSUrl(...)` calls OpenAI's `gpt-4o-mini-tts` directly. Refactor it to:

- Accept an optional `twin` object (`{ id, voice_cloning_key, voice_engine, google_voice_id, gender }`) and an optional `dialogue` array (for multi-character scenes).
- Routing:
  - **If `dialogue.length >= 2` with 2+ unique speakers** → `supabase.functions.invoke('multi-voice-tts', { dialogue, voiceAssignments })`. Decode the returned base64, upload to the `reels` storage bucket, return the URL.
  - **Else if `twin.voice_cloning_key` is a UUID (Speechify)** → `supabase.functions.invoke('text-to-speech', { text, voice: 'cloned', speechifyVoiceId: twin.voice_cloning_key })`. Upload returned audio to storage.
  - **Else if `twin.voice_cloning_key` exists (Google clone)** → same function with `voiceCloningKey: twin.voice_cloning_key`.
  - **Else** → fall back to current OpenAI path (kept only as last resort so existing flows without a twin still work).
- Remove `gpt-4o-mini-tts` as the primary path.

Pass the selected twin into the per-scene loop from the existing request payload (Reels already sends `aiTwin` / `characterId` — surface it into `tryCreateTTSUrl`).

### 2. `src/pages/LifestyleStories.tsx`
Two TTS callsites (lines 301 and 487) currently invoke `text-to-speech` with the default OpenAI voice. Update both:

- Read the currently selected Twin from existing state (the page already supports a Twin selector via `useAITwins`; if none is selected, prompt the user once via toast rather than silently falling back).
- Build the same body the Movie page uses:
  ```ts
  { text, voice: 'cloned',
    speechifyVoiceId: isSpeechifyVoiceId(twin.voice_cloning_key) ? twin.voice_cloning_key : undefined,
    voiceCloningKey: !isSpeechifyVoiceId(twin.voice_cloning_key) ? twin.voice_cloning_key : undefined }
  ```
- Extract `isSpeechifyVoiceId` from `MovieSceneCreator.tsx` into a small shared helper at `src/lib/voiceUtils.ts` and import it from all three pages.

### 3. Shared helper: `src/lib/voiceUtils.ts` (new)
- `isSpeechifyVoiceId(key)` — UUID regex test
- `buildVoicePayload(twin, text)` — returns the `text-to-speech` body
- `buildVoiceAssignments(twins)` — returns the `voiceAssignments` array shape `multi-voice-tts` expects

This keeps Movies, Reels, and Stories on identical routing logic.

### 4. UI surface
- **Reels** (`src/pages/Reels.tsx` / the active script panel): the AI Twin selector already exists; add a small "Voice: <TwinName> (Speechify clone)" indicator under the narration step so users see which voice will be used. No new picker.
- **Lifestyle Stories** (`src/pages/LifestyleStories.tsx`): add the same Twin selector dropdown if it isn't already present, defaulting to the user's first Twin with a `voice_cloning_key`.

### 5. Memory update
Update `mem://technical/audio/voice-engine-modernization` to reflect that Reels & Stories now use **Speechify cloned voice + Gemini 2.5 Pro multi-speaker**, with `gpt-4o-mini-tts` retained only as a no-twin fallback. Lip-sync model (`infinitetalk-hd`) is unchanged.

---

## Out of scope
- No changes to lip-sync / video models.
- No new edge function.
- No changes to Movie Scene Creator (it already works).
- No new secrets needed — `SPEECHIFY_API_KEY`, `WAVESPEED_API_KEY`, `GOOGLE_CLOUD_TTS_API_KEY` already configured.

---

## Verification
1. Generate a Reel with a Twin that has a Speechify clone → audio plays in that voice.
2. Generate a Reel with a Twin that has a Google clone (non-UUID key) → still works.
3. Generate a Lifestyle Story with a Twin selected → narration uses cloned voice.
4. Generate a multi-character script in Reels (if/when introduced) → routes to `multi-voice-tts`.
5. Generate with no Twin → falls back to existing OpenAI path; toast informs user.
