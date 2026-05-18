# Honor user-provided scripts verbatim

## Problem
When the user pastes a full creative brief that contains an explicit `Script: "..."` block (like the BusyBee example), the system still runs it through Marco, who rewrites the spoken dialogue. Result: the actor doesn't say what the user wrote. The existing "Use my prompt as the script" toggle only works if the user manually flips it AND it then sends the *entire* brief to Sora verbatim (which is too literal — the brief contains visual direction that isn't dialogue).

## Goal
If the user's prompt contains an explicit script/dialogue block, the system must:
1. Detect it automatically
2. Extract just the spoken lines
3. Pass them to Marco as **locked, verbatim** dialogue that he wraps with visual/audio direction — never rewriting the words
4. Show the user clearly that their script was locked

## Plan

### 1. Script detection helper (new, in `src/pages/VideoRepo.tsx`)
Add `extractUserProvidedScript(prompt: string): string | null` that returns the spoken text when the prompt contains any of:
- A line matching `/^\s*script\s*:/im` followed by quoted or paragraph text
- A standalone quoted block ≥ 12 words (curly `"…"` or straight `"…"`)
- A `dialogue:` / `voiceover:` / `VO:` label

Strip surrounding quotes, smart-quotes, and trailing brand sign-offs. Return null if nothing qualifies.

### 2. Auto-lock UX
- On every `prompt` change (debounced), run the detector.
- When detected, show an inline chip above the composer: **"📝 Script detected — will be used verbatim"** with a small `×` to opt out (sets a `userOptedOutOfLock` flag for this prompt).
- The existing "Use my prompt as the script" toggle stays, but is now relabeled **"Send entire prompt to Sora verbatim (skip Marco)"** to distinguish from the new auto-lock.

### 3. Pass locked script to Marco
In `analyzeAndGenerate`, when a locked script is present:
- Add a top-of-system-prompt directive:
  ```
  🔒 LOCKED SPOKEN SCRIPT — USE VERBATIM
  The user has provided the exact words the actor must say. Copy them character-for-character into the AUDIO: block, inside quotes. Do NOT rewrite, shorten, paraphrase, reorder, or add words. Your job is only to wrap them with visual direction, camera, lighting, wardrobe, and sound design.

  SCRIPT (verbatim, do not change):
  "<extracted script>"
  ```
- Override the word-count target: derive duration recommendation from the locked script (`words / 2.5`) and if it doesn't match `soraDuration`, surface a warning toast: *"Your script is ~28s of speech but the clip is 20s. Trim the script or bump duration."* Block generation until resolved.
- Skip the auditor's "rewrite spoken lines" step when locked (auditor may still adjust visuals).

### 4. Preview clarity
In the script preview card, when locked:
- Add a green **"🔒 Verbatim from your script"** badge above the spoken-lines section.
- Diff-check the AUDIO block against the locked script; if Marco changed even one word, show a red warning and offer a one-click "Force replace with my script" button that swaps the AUDIO block.

### 5. Brand-name handling carve-out
The existing "spoken brand pronunciation" rule (e.g. `busybee.guru` → `Busy Bee dot guru`) currently rewrites the user's words. When a script is locked:
- Do NOT auto-transform brand spellings inside the locked block.
- Instead, after extraction, scan for known-squashed brand patterns and surface a one-time suggestion chip: *"Sora's TTS may mispronounce 'BusyBee.guru'. Replace with 'Busy Bee dot guru'? [Yes] [Keep mine]"*. User decides.

## Files
- `src/pages/VideoRepo.tsx` — detector, auto-lock chip, system-prompt injection, preview badge + diff, brand-suggestion chip
- `mem://features/video-repo/user-script-lock` — new memory documenting the verbatim-script contract

## Out of scope
- No changes to Sora/Wan calling code, no schema changes, no new edge functions.
