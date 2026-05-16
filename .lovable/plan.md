# Audio-Driven Talking Video — Upload MP3 → Lip-Synced Video

Lets users upload their own narration (MP3/WAV) and generate a talking-head video whose length **exactly matches** the audio. Output uses a portrait — either an existing AI Twin or a one-off uploaded photo.

## Where it lives

Add the same "Upload Audio" flow in two places:

1. **Podcast page** — new "Upload Audio" tab/toggle next to the existing script-driven flow.
2. **AI Spokesperson page** — new "Use my own voice recording" option that bypasses script generation and TTS.

Both surfaces share the same component + edge-function path.

## Source of the visual

Inside each page, user picks:
- **AI Twin** — pulled from existing `ai_twins` (uses `get_twins_summary` RPC, same as today).
- **Upload portrait** — drag-and-drop a single photo (jpg/png, square or 9:16 portrait).

Validation: must be 1 clearly-visible face, ≤ 8MB. Uploaded to the existing `reels` bucket under `{user_id}/podcast-uploads/`.

## Audio upload

- Accepts MP3, WAV, M4A. Max 25MB / 300s.
- Client uses an `<audio>` element to read `duration` before submitting.
- Uploaded to `reels` bucket under `{user_id}/podcast-audio/`.
- If duration > 300s, show toast: "Audio too long — max 5 minutes per clip."

## Model routing (automatic by duration)

| Audio length | Model | Reason |
|---|---|---|
| **0 – 120s** | `wavespeed-ai/infinitetalk-hd` | Highest fidelity, ideal for short hooks/ads |
| **120 – 300s** | `wavespeed-ai/infinitetalk` (standard) | ~40-50% cheaper, acceptable quality for long episodes |

Router lives server-side so we can tune thresholds without redeploying the UI. A small "Quality used: HD/Standard" badge appears on the result card so users understand what they got. No user-facing toggle for v1.

## Frontend changes

- **New shared component**: `src/components/podcast/AudioUploadTalkingHead.tsx`
  - Audio dropzone + portrait picker (Twin selector OR photo dropzone)
  - Duration meter + cost-tier preview ("HD" or "Standard")
  - Submit button → calls `generate-talking-head-from-audio` edge function
  - Progress polling identical to current Podcast flow
- **`src/pages/Podcast.tsx`**: add a tabs control at the top — "From Script" (current) | "From Audio Upload" (new).
- **`src/pages/AISpokesperson.tsx`**: add a "Use my recorded audio" option in the script step that swaps the script editor for the new component.

## Backend changes

- **New edge function**: `supabase/functions/generate-talking-head-from-audio/index.ts`
  - Auth: standard JWT-claims fast path (same pattern as `generate-podcast-from-content`).
  - Input: `{ audioUrl, portraitUrl, durationSec, source: 'podcast' | 'spokesperson' }` validated with Zod.
  - Routes to `infinitetalk-hd` or `infinitetalk` based on `durationSec`.
  - Creates WaveSpeed task via existing `wavespeed-video` flow (model already supported in `src/lib/wavespeed.ts` union).
  - Returns `{ taskId, model }`. Frontend polls existing `wavespeed-video` `status` action — no new polling endpoint needed.
- **Background task persistence**: register the job through the existing `BackgroundVideoContext` so users can navigate away and come back, matching the current Reels/Podcast pattern.

## Out of scope (v1)

- No TTS, no script generation — audio is taken as-is.
- No multi-speaker / dual-portrait mode (single talking head only).
- No captions/burn-in — handled by the existing captioning suite afterward if user wants.
- No `avatar-omni-human-1.5` (forbidden per project memory).

## Technical notes

- Storage uses existing public `reels` bucket; no new bucket or migration needed.
- WaveSpeed `infinitetalk` (non-HD) is already in the `model` union of `src/lib/wavespeed.ts` — no SDK change.
- Reuse `BackgroundVideoContext` for monitoring; result video flows into the regular `videos` table via the existing wavespeed-video completion handler.
- Threshold constant `HD_MAX_SECONDS = 120` lives in the edge function and is logged on every run for observability.

## Files to add / edit

- **add** `supabase/functions/generate-talking-head-from-audio/index.ts`
- **add** `src/components/podcast/AudioUploadTalkingHead.tsx`
- **edit** `src/pages/Podcast.tsx` — add "From Audio Upload" tab
- **edit** `src/pages/AISpokesperson.tsx` — add "Use my recorded audio" mode toggle
