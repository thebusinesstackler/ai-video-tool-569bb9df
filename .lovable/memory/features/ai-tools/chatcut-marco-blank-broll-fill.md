---
name: chatcut-marco-blank-broll-fill
description: Marco can autofill blank b-roll windows with static saved frames — no user pinning required. Pre-computed brollGaps + savedFrames in payload + add_broll savedFrameId+static path
type: feature
---
Marco now sees the timeline well enough to fill empty B-roll stretches by himself.

## What changed
- `src/pages/ChatcutAI.tsx` payload now includes:
  - `savedFrames` — top 24 saved frames `{id, label, thumbUrl}` from `generated_images` source='broll-frame'.
  - `context.brollGaps` — pre-computed empty windows on the B-Roll track (gaps ≥ 1.5s), each `{start, end, duration}`. Computed by sorting `bRollClips`, walking the timeline, and emitting any range > 1.5s gap.
- `add_broll` action gained PATH 3: `savedFrameId` (looked up in `savedBrollFrames`) + `static:true` → calls `addBRollFromImage(..., { staticOnly: true })` which now skips the wan-2.5 animation entirely.
- `addBRollFromImage` accepts `opts.staticOnly` and `opts.duration` (default 3s).

## Director prompt addition
New "BLANK B-ROLL WINDOWS — CRITICAL" section in `supabase/functions/chatcut-director/index.ts` (right after SOURCE VIDEO COVERAGE) tells Marco: read `context.brollGaps`, match each gap to the best `savedFrames[].label` against the transcript at that timestamp, emit `add_broll` with `savedFrameId+static:true+matchType`, chain 2-3 frames inside any gap > 4s, skip gaps < 2s. Triggered by phrases like "fill the blank spots", "add static b-roll throughout", "cover the gaps", "no overlap with existing b-roll".

## Trigger phrases (locked in prompt)
"fill the blank spots", "add static b-roll throughout", "cover the gaps", "use my saved frames everywhere they fit", "pin frames for me", "no overlap with existing b-roll", "fill in the empty parts", "static b-roll in the blanks".

## Empty-library fallback
If user asks to fill gaps but `savedFrames` is empty, Marco asks: pin frames first, or generate fresh AI b-roll instead?

## Out of scope
- Marco does not yet auto-pin frames himself; only places existing saved frames.
- Animated (wan-2.5) gap-fill still requires the user to ask for "premium b-roll" or generation explicitly — `static:true` is the gap-fill default.
