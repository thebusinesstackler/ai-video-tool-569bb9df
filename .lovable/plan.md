

## Plan: Add Wan 2.6 I2V as New Model Option in Reels

Add `alibaba/wan-2.6/image-to-video` alongside existing models with support for 5s, 10s, and 15s durations.

### Changes

**1. Edge Function: `supabase/functions/wavespeed-video/index.ts`**
- Add `'wan-2.6-i2v'` to the model type union (line 16)
- Add new routing branch for `https://api.wavespeed.ai/api/v3/alibaba/wan-2.6/image-to-video` with `image`, optional `prompt`, and `duration` (clamped to 5/10/15)

**2. Edge Function: `supabase/functions/generate-reel-video/index.ts`**
- Add a new branch for `videoModel === 'wan-2.6-i2v'` in the narrator scene routing (around line 675), using `alibaba/wan-2.6/image-to-video` with the scene's image, prompt, and duration clamped to 5/10/15

**3. Frontend: `src/pages/Reels.tsx`**
- Add `'wan-2.6-i2v'` to the `videoModel` state type union (line 333)
- Add a new option in both model selector UIs (Quick mode ~line 4168, Advanced ~line 4624):
  `{ value: 'wan-2.6-i2v', label: '🌟 Wan 2.6', desc: '5s, 10s, or 15s clips' }`
- When `wan-2.6-i2v` is selected, show a duration selector (dropdown or radio) allowing 5, 10, or 15 seconds, and pass this duration through to the edge function call

**4. Client type: `src/lib/wavespeed.ts`**
- Add `'wan-2.6-i2v'` to the model union type (line 13)

### Duration Handling
- Wan 2.6 accepts exactly 5, 10, or 15 seconds
- A new UI control will appear when this model is selected, letting users pick the duration
- This duration will be sent as part of the generation request and used per-scene

