

## Problem

Loop AI Director currently lacks several critical production capabilities:

1. **No video diagnostic** — Loop can't analyze completed video clips (check lip-sync quality, visual consistency, timing)
2. **No "extend clip" action** — Can't extend an existing video clip using the `wan-2.5/video-extend` pipeline
3. **No product-from-library swap** — Can't pull product images from the user's `product_images` table; only copies from one scene to another
4. **B-roll voiceover gaps** — B-roll scenes can be silent; no automatic enforcement of consistent voiceover across all B-roll
5. **Missing production actions** — No ability to trigger video generation for individual scenes, reorder scenes, duplicate scenes, or generate individual voiceovers for B-roll from the chat

## Plan

### 1. Add new action types to the EditAction system (LoopAIDirector.tsx)

Extend the `action` union type with these new actions:

- **`generateVideo`** — Triggers video generation for specific scene(s). Requires a new `onGenerateVideo` callback prop. For speaking scenes, calls the lip-sync pipeline; for B-roll, calls text-to-video.
- **`extendClip`** — Takes a scene index with an existing `videoUrl` and extends it using the `wan-2.5/video-extend` model via a new `onExtendClip` callback prop. Passes the video URL + a super-prompt.
- **`productSwapFromLibrary`** — Fetches product images from the `product_images` table and applies the first (or named) product to target scene indices. No need for a source scene — pulls directly from the user's library.
- **`generateBrollVoiceover`** — Generates TTS voiceover specifically for B-roll scenes using their `voiceoverText` field. Uses the same voice profile as the main character for consistency.
- **`duplicateScene`** — Calls the existing `duplicateSegment` function (needs to be passed as a new prop `onDuplicateSegment`).
- **`reorderScene`** — Moves a scene from one position to another (needs `onReorderSegments` prop).
- **`videoDiagnostic`** — Runs a diagnostic check on scenes that have `videoUrl`, reporting on lip-sync status, duration match, and missing audio. This is a frontend-only analysis that reports findings back as a system-action message.

### 2. Add new props to LoopAIDirectorProps (LoopAIDirector.tsx)

```
onGenerateVideo: (segmentId: string) => Promise<void>;
onExtendClip: (segmentId: string, prompt: string) => Promise<void>;
onDuplicateSegment: (id: string) => void;
onReorderSegments: (fromIndex: number, toIndex: number) => void;
```

### 3. Implement handler logic for new actions (LoopAIDirector.tsx)

In `applyEditActions`, add cases for each new action:

- **generateVideo**: Loop through target indexes, call `onGenerateVideo(seg.id)` for each
- **extendClip**: Call `onExtendClip(seg.id, edit.prompt || 'Continue the scene naturally')` 
- **productSwapFromLibrary**: Query `product_images` table for user's products, apply the first match (or by name) to target scenes, then trigger B-roll regeneration
- **generateBrollVoiceover**: For B-roll scenes with `voiceoverText`, call `previewAudio` using the main character's voice profile for consistency
- **duplicateScene**: Call `onDuplicateSegment(seg.id)`
- **reorderScene**: Call `onReorderSegments(edit.fromIndex, edit.toIndex)`
- **videoDiagnostic**: Iterate all segments, build a report of video status, lip-sync readiness, duration mismatches

### 4. Implement callbacks in TestimonialCommercial.tsx

- **handleGenerateVideo**: Calls the `wavespeed-video` edge function for a single segment (speaking = infinitetalk with audio+image, B-roll = wan-2.5 with prompt)
- **handleExtendClip**: Calls `wavespeed-video` with `model: 'alibaba/wan-2.5/video-extend'` passing the existing `videoUrl` as the video input + a super-prompt

### 5. Auto-enforce B-roll voiceover consistency

In the `generateBrollVoiceover` action handler:
- Find the first speaking segment's character description to determine voice gender
- Use that same voice profile for all B-roll voiceovers
- Store the `audioUrl` on the B-roll segment

### 6. Update the edge function system prompt (generate-commercial-strategy/index.ts)

Add the new actions to the "Available Actions" documentation:

```
- **generateVideo**: Generate lip-sync video for speaking scenes or cinematic video for B-roll. Use after character images and audio are ready.
- **extendClip**: Extend an existing video clip using AI. Requires "prompt" describing what should happen next.
- **productSwapFromLibrary**: Pull a product from the user's saved product library and apply to target B-roll scenes. Use when user says "add my product" without specifying a source scene.
- **generateBrollVoiceover**: Generate voiceover audio for B-roll scenes using their voiceoverText. Uses the main character's voice for consistency.
- **duplicateScene**: Clone a scene. Useful for creating variations.
- **reorderScene**: Move a scene to a different position. Requires "fromIndex" and "toIndex".
- **videoDiagnostic**: Analyze all generated videos for quality issues (lip-sync readiness, duration mismatch, missing audio). Use when user asks to "check videos" or "diagnose".
```

Add a new rule: "B-ROLL VOICEOVER MANDATE — Every B-roll scene MUST have voiceoverText. When adding or reviewing B-roll, if voiceoverText is empty, write narration that bridges the adjacent speaking scenes and trigger generateBrollVoiceover."

### 7. Update quick actions (LoopAIDirector.tsx)

Add contextual quick action buttons:
- "🎬 Generate all videos" — when characters + audio exist but no videos
- "📦 Add product from library" — when product_images exist
- "🔍 Diagnose videos" — when videos exist
- "⏭️ Extend Scene #X" — when a scene has video but could be longer

### Files to modify
- `src/components/testimonial/LoopAIDirector.tsx` — New action types, handlers, props, quick actions
- `src/pages/TestimonialCommercial.tsx` — New callback implementations, pass new props to LoopAIDirector
- `supabase/functions/generate-commercial-strategy/index.ts` — Updated system prompt with new actions and B-roll voiceover mandate

