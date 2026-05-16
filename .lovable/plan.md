## Goal

Add **Multi-Speaker Conversation Mode** to Reels and Lifestyle Stories. User describes a conversation topic, AI writes a 2–4 person back-and-forth dialogue, and the video cuts between each speaker's AI Twin (Movie Scene Creator style).

## What's already in place (reuse, don't rebuild)

1. **`generate-conversation-dialogue` edge fn** — already writes labeled `[{character, line, emotion}]` JSON for 2 speakers via Claude. Will extend to accept 2–4 speakers.
2. **`multi-voice-tts` edge fn** — already takes a `dialogue[]` + `voiceAssignments[]` and returns stitched audio (Speechify clone → Google clone → Gemini multi-speaker fallback).
3. **`buildVoiceAssignments()` helper** in `src/lib/voiceUtils.ts` — already exists for this exact payload shape.
4. **`generate-reel-video`** — already routes through `text-to-speech`; needs a new branch for multi-speaker mode that generates **one clip per dialogue line** (each line lip-synced to its own twin) and stitches them in order.

## Changes

### 1. `supabase/functions/generate-conversation-dialogue/index.ts`
- Accept `characterNames: string[]` of length 2–4 (currently hard-coded to first two).
- Update Claude prompt to handle N speakers and rotate lines naturally.
- Keep the same output shape: `{ conversation: [{character, line, emotion}] }`.

### 2. New mode in Reels (`src/pages/Reels.tsx`)
Add a **"Conversation"** mode toggle next to existing mode selector (alongside cinematic / talking-head). When active:
- **Speaker picker:** select 2–4 AI Twins (must have `voice_cloning_key`).
- **Topic textarea:** "Describe what they're talking about" (free-form).
- **Tone selector:** reuse existing tone options.
- **Generate Dialogue** button → calls `generate-conversation-dialogue` with the selected speaker names; renders the resulting labeled lines in an editable list (per-line text + speaker dropdown).
- **Generate Video** → posts the dialogue + selected twins to `generate-reel-video` with new `mode: "conversation"` flag.

### 3. New mode in Lifestyle Stories (`src/pages/LifestyleStories.tsx`)
Same UI block + same payload shape — reuse a shared component `src/components/ConversationBuilder.tsx`.

### 4. Shared component `src/components/ConversationBuilder.tsx` (new)
Self-contained:
- Speaker count slider (2–4)
- N twin pickers (filtered to those with cloned voices)
- Topic + tone inputs
- Dialogue editor (add/remove/reorder lines, edit speaker per line)
- `onGenerate(dialogue, twins)` callback
Used by both pages → ~250 lines, isolated from the giant page files.

### 5. `supabase/functions/generate-reel-video/index.ts` — conversation branch
New top-level branch when `mode === 'conversation'`:
- For each dialogue line:
  - TTS that line via `text-to-speech` using the corresponding twin's voice clone (reusing existing `tryCreateTTSUrl` with `twin` param).
  - Lip-sync that twin's reference image to the audio via `wavespeed-ai/infinitetalk-hd` (same model already used elsewhere).
- Concatenate the per-line video clips via Creatomate (already wired) or canvas fallback to produce the final video.
- Persist segment URLs so partial regeneration still works.

### 6. Memory update
Update `mem://technical/audio/voice-engine-modernization` to note: Reels/Stories now support **conversation mode** with 2–4 speakers via `multi-voice-tts` + `infinitetalk-hd` lip-sync per line.

## Out of scope
- Side-by-side / split-screen layouts (user picked Movie-style cuts only).
- More than 4 speakers.
- Importing existing single-speaker scripts (not requested).
- B-roll cutaways during dialogue (can be a follow-up).

## Verification
1. Pick 3 twins → describe a conversation → AI writes labeled dialogue → edit one line → generate.
2. Final video cuts between speakers, each lip-syncs to their own voice clone.
3. Works in both Reels and Lifestyle Stories from the same shared component.
4. Falls back gracefully when only 2 twins are picked.