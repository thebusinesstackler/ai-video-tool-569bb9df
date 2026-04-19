---
name: chatcut-phase3-audio-sync
description: Phase 3 — speech-aware music ducking, synthesized SFX library (whoosh/ding/pop/swoosh/thud/click), and word-level overlay alignment via Marco
type: feature
---
# Chatcut AI Phase 3 — Audio Ducking + SFX + Word Sync

## Audio ducking (`src/pages/ChatcutAI.tsx`)
- `isSpeechActive` memo scans `wordList` to detect if any word's `[start-0.05, end+0.15]` window contains `currentTime`.
- Music sync effect multiplies `track.volume` by `(1 - duckStrength)` (clamped to ≥0.05) when speech active.
- Defaults: `duckEnabled=true`, `duckStrength=0.65` (music drops to 35% under speech).
- Marco action: `{action:"set_ducking", enabled?, strength?}`.

## Synthesized SFX library
- Web Audio API generates `whoosh` / `swoosh` (filtered noise sweeps), `ding` (sine pluck pair), `pop` / `thud` (sine drops), `click` (square blip). No network calls — instant fire.
- Single `AudioContext` reused via `sfxAudioCtxRef`.
- `sfxFiredRef` Set tracks already-fired clips during current playback pass; cleared on pause / backward seek so SFX re-trigger on rewind.
- Triggered when `currentTime` crosses `sfx.at` within a 0.4s window.
- Marco actions: `add_sfx` (with optional `pairedOverlayId` to auto-snap to overlay start), `remove_sfx`.
- Cyan timeline marker row with click-to-preview + × delete.

## Word-level overlay alignment
- `wordList` flattens `transcript.segments[].words[]` into sorted `{word, start, end, norm}[]` (with coarse fallback when no word timings).
- `findWordTime(word, occurrence)` — case + punctuation insensitive lookup.
- Marco action: `{action:"align_overlay_to_word", overlayId, word, occurrence?, lead?}` — snaps overlay's `start` to the spoken word's start time (lead is negative offset for early reveal).
- Payload: `wordTimings[]` (first 200 sampled) + `wordTimingsAvailable` boolean.

## Marco prompt directives (chatcut-director)
- #11 SFX library + pairedOverlayId convention
- #12 Audio ducking control
- #13 Word-level sync (recommends pairing align + ding for max punch)

## Persistence
`chatcut_drafts.timeline_state` now includes `sfxClips`, `transitions`, `duckEnabled`, `duckStrength`.

## Files touched
- `src/pages/ChatcutAI.tsx` — `SfxClip`/`SfxKind` types, state, `playSfx` engine, ducking, word-list, `findWordTime`, `isSpeechActive`, executor cases (`add_sfx`/`remove_sfx`/`set_ducking`/`align_overlay_to_word`), payload sections, draft persist, cyan SFX timeline row
- `supabase/functions/chatcut-director/index.ts` — Directives #11-13
