

## Plan: Add Pitch Control + External Audio Upload to Reels

### What We're Building
1. **Pitch slider** for voiceovers — adjustable before generating, works across Quick, Easy, and Advanced modes
2. **External audio file upload** (MP3 from Google AI Studio or any source) — available in all modes, bypasses TTS

---

### Changes

**1. Edge Function: `supabase/functions/text-to-speech/index.ts`**
- Accept a new `pitch` parameter (range: -10 to +10, default 0)
- Pass `pitch` to Google Cloud TTS (`audioConfig.pitch`)
- Pass `pitch` to WaveSpeed MiniMax (`pitch` field — already in the schema but hardcoded to 0)
- Validate and clamp the value

**2. Frontend State: `src/pages/Reels.tsx`**
- Add `voicePitch` state (number, default 0, range -10 to +10)
- Pass `pitch` to all TTS invocations (preview voice, generate voiceovers)
- Save/restore pitch in draft auto-save

**3. UI — Quick Mode Script Tab (~line 4226-4231)**
- Replace the read-only voice label with `VoiceSelector` component (compact)
- Add a pitch `Slider` control below the voice selector (-10 to +10)
- Add "Audio Source" toggle: AI Voice / Upload MP3
- When "Upload" selected, show file input (reuses existing `handleCustomAudioUpload` handler) and hide voice/pitch controls

**4. UI — Easy/Beginner Mode Character Tab (~line 4240+)**
- Add pitch `Slider` next to existing voice controls
- The custom audio upload UI already exists here — no changes needed

**5. UI — Advanced Mode (~line 4620+)**
- Add pitch `Slider` in the Lip Sync / voice section
- Add "Audio Source" toggle with upload option (same pattern as Quick mode)

**6. `src/components/VoiceSelector.tsx`**
- No changes needed — pitch is a separate control managed at the Reels page level

### External Audio (Google AI Studio etc.)
The existing `handleCustomAudioUpload` handler already supports MP3, WAV, M4A, and WebM uploads. It uploads to storage and provides a public URL. When custom audio mode is active, TTS is skipped entirely and the uploaded file is used directly for lip-sync. This will be surfaced in Quick and Advanced modes (already exists in Easy mode).

### Scope
- 2 files edited: `text-to-speech/index.ts`, `Reels.tsx`
- No new database changes
- No new edge functions

