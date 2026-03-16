

## Problem

Loop AI Director is missing several critical awareness and control capabilities:

1. **No scene/B-roll count awareness in chat** — Loop doesn't proactively tell users "You have 4 speaking scenes and 2 B-roll clips" in context
2. **No audio regeneration action** — Can't re-record/change a voice for a specific scene (only `generateVoice` exists, but no explicit "regenerate with different voice" or "change voice gender")
3. **No pose change action** — Can't change a character's pose/camera angle and regenerate the image in one step
4. **No actor reference gallery awareness** — Loop can't show the user existing reference images for an actor or suggest generating more angles
5. **No twin/character library lookup** — Loop doesn't know about saved AI Twins or Characters from the database; can't pull them in
6. **No scene count summary in system prompt** — The segment context shows details but the AI doesn't have a concise "dashboard" summary at the top

## Plan

### 1. New action types (LoopAIDirector.tsx)

Add to the `action` union:
- **`regenerateAudio`** — Re-generates voiceover for a scene with optional voice override (`voiceId`, `gender`). Calls `previewAudio` with specified voice params.
- **`changePose`** — Updates character description with new pose/camera angle and triggers `onGenerateCharacter` to regenerate images. Combines `updateCharacterDescription` + `regenerateCharacter` in one action.
- **`showActorGallery`** — Queries the scene's character reference images and posts them as a system-action message with thumbnails. Also queries `ai_twins` table for matching twins to show saved poses.
- **`generateMoreAngles`** — Calls the `generate-twin-angles` edge function to create additional reference angles for a character's twin, then updates the segment.
- **`addSceneAfter`** — Inserts a new scene at a specific position (after a given index) rather than always appending. Uses `onAddSegment` + `onReorderSegments`.

Add to the `EditAction.edits` item:
- `voiceId?: string` and `gender?: string` fields for `regenerateAudio`
- `newPose?: string` field for `changePose` (the new camera angle/pose description)

### 2. Implement handlers in `applyEditActions` (LoopAIDirector.tsx)

- **`regenerateAudio`**: For target scenes, call `previewAudio(script, segId, description)` with optional override voice. If `edit.voiceId` is provided, call TTS directly with that voice ID instead of auto-detecting.
- **`changePose`**: Update the character description with the new pose/angle, then call `onGenerateCharacter(segId, newDescription)`. Post summary like "Changed Scene #2 to low angle hero shot — regenerating character images."
- **`showActorGallery`**: Read `segments[idx].character.referenceImages`, format as a gallery message with markdown images. Also query `ai_twins` for twins matching the character name/description and show their reference images. End with "Want me to generate more angles?"
- **`generateMoreAngles`**: Find the character's `twinId` (from segment or by matching in `ai_twins`), call the `generate-twin-angles` edge function, then update the segment's reference images. Post summary with new image count.

### 3. Add project dashboard to payload (LoopAIDirector.tsx)

Before `currentSegments` in the request body, add a `projectSummary` object:
```
{
  totalSegments: segments.length,
  speakingCount: N,
  brollCount: N,
  totalDuration: Ns,
  targetDuration: Ns,
  videosReady: N,
  audiosReady: N,
  charactersReady: N,
  uniqueActors: N (by matching character descriptions/twinIds),
  hasMusic: boolean,
  productImagesInUse: N
}
```

### 4. Update edge function system prompt (generate-commercial-strategy/index.ts)

Add `projectSummary` rendering in `buildSegmentContext` — a concise dashboard at the top:
```
## 📊 Project Dashboard
5 segments (3 speaking, 2 B-roll) | 30s total (target: 30s) | 2/3 characters ready | 1/3 audio ready | 0/5 videos ready | 1 unique actor
```

Add new actions to the "Available Actions" docs:
- **regenerateAudio** with `voiceId` and `gender` params
- **changePose** with `newPose` description
- **showActorGallery** to display reference images
- **generateMoreAngles** to create additional twin angles

Add rules:
- "ACTOR GALLERY AWARENESS — When a user asks about an actor's poses, references, or existing shots, use showActorGallery to display what exists. Then suggest generateMoreAngles if they want more variety."
- "VOICE CONTROL — When a user says 'change the voice', 'different voice', 'make it female/male', use regenerateAudio with the appropriate gender. Available voice IDs: English_compelling_lady1, English_radiant_girl, Calm_Woman, Inspirational_girl (female); English_magnetic_voiced_man, English_Trustworth_Man, Casual_Guy, Deep_Voice_Man (male)."
- "POSE CHANGES — When user says 'change the angle', 'different pose', 'make it a close-up', use changePose with the new cinematography description. This regenerates the character image automatically."

### 5. New callback props (LoopAIDirector.tsx + TestimonialCommercial.tsx)

Add `onGenerateTwinAngles?: (twinId: string, faceDescription: string, gender: string, name: string, referenceImageUrl?: string) => Promise<string[]>` prop.

Implement in TestimonialCommercial.tsx — calls the `generate-twin-angles` edge function and returns new image URLs.

### 6. Update quick actions (LoopAIDirector.tsx)

Add contextual quick actions:
- "🎭 Show actor poses" — when speaking scenes have character images
- "📸 Generate more angles" — when a character has few reference images
- "🔄 Change voice" — when audio exists but user might want to try different voices

### Files to modify
- `src/components/testimonial/LoopAIDirector.tsx` — New actions, handlers, dashboard payload, quick actions
- `src/pages/TestimonialCommercial.tsx` — New `onGenerateTwinAngles` callback, pass to LoopAIDirector
- `supabase/functions/generate-commercial-strategy/index.ts` — Dashboard rendering, new action docs, voice/pose rules

