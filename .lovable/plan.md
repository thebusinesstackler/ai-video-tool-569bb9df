## What's happening

Your scenes never get past "pending" because every call to the `generate-scene-image` edge function is being rejected with a 400 before any image is even requested. The Supabase client wraps that as a generic "Edge Function returned a non-2xx status code", so the UI just keeps retrying and you never see why.

I confirmed the function itself is healthy (a direct test call returned 200). The failure is in **what we're sending it** from `MovieSceneCreator.tsx`'s `generateAll` loop:

1. The edge function caps `referenceImages` at **4**:
   ```ts
   if (!Array.isArray(referenceImages) || referenceImages.length > MAX_REFERENCE_IMAGES) → 400
   ```
2. But the client builds end-frame refs as `[startImg, ...sceneRefs].slice(0, 6)` — up to **6** images. And `sceneRefs` itself (built from every assigned twin's reference images) can already be more than 4 on its own, which also explains why some scenes' *start* frames fail too (scene 5 start in your logs).
3. The same call also forwards `characterDescription` which can exceed the function's 1000-char limit, producing the same 400.

So every scene where the cast has many reference images → 400 → "pending forever".

## Fix

Frontend-only change in `src/pages/MovieSceneCreator.tsx`:

1. **Cap references to 4** inside `tryGenerateFrame` before invoking (and drop the `slice(0, 6)` at the call sites).
2. **Truncate `characterDescription` to 1000 chars** before sending.
3. **Surface the real error** when present — read `error.context?.json()` / `data?.error` and log it (and toast on final failure) so future failures show "Reference images must be an array of max 4" instead of an opaque non-2xx.
4. **Mark scene status visibly** when both retries are exhausted so the storyboard shows "failed — retry" instead of staying "pending" forever, with a one-click retry already wired through the existing per-scene generate buttons.

No edge function or backend changes needed; the limits in `generate-scene-image` are sane, the client just has to respect them.

## Files to edit

- `src/pages/MovieSceneCreator.tsx` — `tryGenerateFrame` helper + the two `endRefs` build sites in `generateAll` and the sweep retry block (around lines 2104–2230).

## Out of scope

- No changes to `generate-scene-image/index.ts`, scene timeline, storyboard panel, or any other generators.
