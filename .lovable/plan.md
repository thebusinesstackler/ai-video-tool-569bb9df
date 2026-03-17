
# Integrate Gemini 2.5 Pro Multi-Speaker TTS via WaveSpeed

## What This Solves
Currently, multi-character dialogue generates each line separately using WaveSpeed MiniMax, then stitches silent MP3 frames between them. This produces robotic, disconnected audio. The **Google Gemini 2.5 Pro TTS** model on WaveSpeed generates **all speakers in a single pass** with natural conversational rhythm, speaker handoffs, and emotional delivery — no stitching needed.

## API Details
- **Endpoint**: `POST https://api.wavespeed.ai/api/v3/google/gemini-2.5-pro/text-to-speech`
- **Auth**: Same `WAVESPEED_API_KEY` already configured
- **Parameters**:
  - `text`: Script in `"Speaker: dialogue"` format
  - `language`: `"English (United States)"`
  - `speakers`: Array of `{ speaker: "Name", voice: "VoiceName" }`
- **Polling**: Same `GET /api/v3/predictions/${taskId}/result` pattern already in use
- **Cost**: $0.08 per 1,000 characters (vs $0.05 per line with current approach)

## Available Gemini Voices (30)
Male-coded: Charon (Informative), Fenrir (Excitable), Puck (Upbeat), Orus (Firm), Enceladus (Breathy), Iapetus (Clear), Umbriel (Easy-going), Algenib (Gravelly), Rasalgethi (Informative), Alnilam (Firm), Schedar (Even)

Female-coded: Kore (Firm), Aoede (Breezy), Zephyr (Bright), Leda (Youthful), Despina (Smooth), Callirrhoe (Easy-going), Autonoe (Bright), Erinome (Clear), Algieba (Smooth), Laomedeia (Upbeat), Achernar (Soft)

## Changes

### 1. Update `multi-voice-tts` edge function
- Add a new `generateGeminiMultiSpeakerTTS()` function that:
  - Formats dialogue array into `"Character: line\nCharacter2: line"` text
  - Maps each unique character to a Gemini voice (using gender: male→Charon/Puck/Fenrir pool, female→Aoede/Kore/Despina pool)
  - Calls `api.wavespeed.ai/api/v3/google/gemini-2.5-pro/text-to-speech` with `text`, `language`, `speakers`
  - Polls for result using the existing `pollWaveSpeedResult` function
- Make Gemini multi-speaker the **primary path** for 2+ characters; fall back to the existing per-line MiniMax approach if it fails
- Keep all existing Speechify/Google Cloud cloned voice paths unchanged — if a character has a cloned voice, we still use the per-line approach for that character's lines

### 2. Update `MovieSceneCreator.tsx` (minor)
- No structural changes needed — the edge function handles the routing internally
- The response format stays the same (`audioContent` base64 string)

### Files Changed
- `supabase/functions/multi-voice-tts/index.ts` — add Gemini multi-speaker as primary engine
