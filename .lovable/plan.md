
## Goal
New AI Tool: **Voiceover Studio** — upload an MP3, get a transcription, edit the script, generate a new voiceover, then lip-sync it onto a saved Podcast Talking Head video.

## Exploration notes
- Transcription: reuse existing `transcribe-video` edge function (Whisper → Gemini fallback per memory). It accepts audio too — confirm by reading it. If audio-only path needs work, extend it or add `transcribe-audio` wrapper.
- Voice generation: reuse `text-to-speech` (gpt-4o-mini-tts) and AI Twin voice cloning (`clone-voice` / `clone-voice-speechify`) so user can pick their own twin voice, an OpenAI preset, or upload a sample.
- Lip-sync: reuse `wavespeed-video` with `infinitetalk-hd` (already used by Podcast / AI Spokesperson per memory).
- Podcast history: Podcast outputs are stored in `projects` table (model_type-tagged) or `reels`. Need to verify which — will load saved podcast videos that have a single talking-head video URL.
- Storage: upload mp3 to `reels` bucket (public) under `voiceover-studio/{userId}/...`.

## Plan

### 1. New page: `src/pages/VoiceoverStudio.tsx`
Three-step workflow in a single page:

**Step 1 — Upload & Transcribe**
- Dropzone for `.mp3 / .wav / .m4a`
- Upload to storage → call `transcribe-video` (audio supported)
- Show full transcript in editable `<Textarea>` (this becomes the new script)
- Show waveform/audio player of original

**Step 2 — Generate New Voiceover**
- Voice source picker:
  - My AI Twins (loads via `get_twins_summary`, uses cloned voice)
  - OpenAI preset voices (alloy, echo, nova, etc.)
- "Generate Voiceover" → calls `text-to-speech` with edited script
- Audio preview + duration shown
- Re-generate button

**Step 3 — Lip-sync to a Podcast Video**
- Grid of saved Podcast Talking Head videos pulled from history (filter by source)
- User selects one source video
- Click "Lip-sync with new voiceover" → calls `wavespeed-video` with `infinitetalk-hd`, passing source video URL + new audio URL
- Background job tracked via existing `BackgroundVideoContext`
- Final video appears with download / send-to-Chatcut buttons

### 2. Database
New table `voiceover_studio_projects`:
- `id`, `user_id`, `created_at`, `updated_at`
- `original_audio_url` (text), `transcript` (text)
- `edited_script` (text)
- `voice_source` (jsonb: `{type, twinId?, voiceId?}`)
- `new_voiceover_url` (text)
- `source_video_url` (text), `final_video_url` (text)
- `status` (text: draft / transcribing / voiced / rendering / done)
- Standard RLS: `auth.uid() = user_id` for all 4 ops

### 3. Edge function adjustments
- Verify `transcribe-video` accepts pure audio MP3. If it strictly expects video, add a thin `transcribe-audio` function (or branch inside the existing one) that posts the file directly to Whisper / Gemini. Keep fallback chain intact.
- No new function for voice or lip-sync — reuse existing.

### 4. Routing & Navigation
- Add route `/voiceover-studio` in `src/App.tsx`
- Add menu entry under **AI Tools** in `src/components/Navigation.tsx` (icon: Mic2)

### 5. Podcast history integration
- Query: pull videos where source = podcast (need to confirm column — likely `projects.model_type` containing "podcast" or the dedicated podcast storage). Will scan `Podcast.tsx` save logic during implementation to find the exact filter.

## Out of scope
- Multi-speaker diarization in transcript editor (single-track only)
- Re-timing audio to match original video length (lip-sync model handles drift naturally up to ~300s per memory)
- Editing transcript word-by-word with timestamps (just plain editable text)

## Files touched
- NEW: `src/pages/VoiceoverStudio.tsx`
- NEW migration: `voiceover_studio_projects` table + RLS
- EDIT: `src/App.tsx` (route)
- EDIT: `src/components/Navigation.tsx` (menu item)
- POSSIBLE EDIT: `supabase/functions/transcribe-video/index.ts` (audio path) OR new `transcribe-audio` function
