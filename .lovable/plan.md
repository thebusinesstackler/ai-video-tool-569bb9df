

# Plan: Animated B-Roll Video Generation + Motion Graphics Pipeline

## Current State

- **B-Roll**: Marco suggests B-roll → `generate-scene-image` creates a **static image** → placed on timeline
- **Motion Graphics**: Marco suggests overlays → Gemini Flash Image generates a **static PNG** → placed on timeline
- **No video generation** is wired into the Chatcut timeline for either feature

## What We'll Build

### 1. Animated B-Roll via WaveSpeed (Image-to-Video)

When Marco adds B-roll, instead of stopping at a static image, we'll chain a second step that animates it into a short video clip using the existing `wavespeed-video` edge function with the `wan-2.5-i2v` (image-to-video) model.

**Flow:**
```text
Marco suggests B-roll
  → generate-scene-image (static frame)
  → wavespeed-video (wan-2.5-i2v, animate the frame into 4s video)
  → Poll for completion
  → Place video URL on timeline + notify in chat
```

**Changes in `src/pages/ChatcutAI.tsx`:**
- Update `generateBRollImage` to chain into a video generation step after the image is ready
- Add a `videoUrl` and `videoStatus` field to the `BRollClip` type
- Show generation progress on the B-roll timeline clip (spinner → checkmark)
- When video is ready, append a Marco chat message: "Your B-roll video is ready at Xs! 🎬"
- On failure, notify in chat with retry offer

### 2. Motion Graphics with Animated Entrance

Motion graphics currently render as static images. We'll add CSS-based entrance animations (slide-in, fade, scale) to the overlay renderer so they feel like real motion graphics during playback.

**Changes in `src/pages/ChatcutAI.tsx`:**
- Add an `animation` property to overlay objects (e.g., `slide-up`, `fade-in`, `scale-pop`)
- Marco's system prompt already specifies styles — map each style to an animation preset
- In the video preview overlay renderer, apply CSS keyframe animations that trigger when `currentTime` enters the overlay's time range
- The overlay image (already generated) gets animated entrance/exit

### 3. Background Job Tracking for Video Generation

B-roll video generation takes 30-90 seconds. We need non-blocking progress tracking.

**Changes in `src/pages/ChatcutAI.tsx`:**
- Create an async polling function that checks `wavespeed-video` task status every 5 seconds
- Track active generation jobs in state: `{ clipId, taskId, status }`
- Show a subtle pulsing indicator on the B-roll clip while generating
- When done, update the clip with the video URL and send a chat notification

### 4. Update Marco's System Prompt

**Changes in `supabase/functions/chatcut-director/index.ts`:**
- Update the `add_broll` action docs to mention that B-roll now generates as animated video clips (not stills)
- Add an `animation` field to `add_overlay` action so Marco can specify entrance animations

## Summary

| File | Change |
|------|--------|
| `src/pages/ChatcutAI.tsx` | Chain B-roll image → video generation via `wavespeed-video`, add polling, chat notifications, overlay CSS animations, progress indicators |
| `supabase/functions/chatcut-director/index.ts` | Update Marco's prompt to reflect animated B-roll and motion graphic animation options |

## What This Does NOT Include
- External meme/clip library (would need a third-party API like Giphy/Tenor — can add later if wanted)
- Full video compositing/export with B-roll baked in (that's a separate render pipeline task)

