

## Plan: Fix Identical Clips, Add Camera Angle Variety, Intro/CTA Slides, and On-Demand Person Generation

### Problems Identified

1. **All clips look the same**: The `selectedCameraAngle` state exists but is never passed to `generate-reel-video`. Every scene uses the same default prompt with no angle variation. The camera angle data (`CAMERA_ANGLES` with `promptModifier`) is completely unused during generation.

2. **No intro/CTA slide system**: Users can't insert custom front slides or call-to-action cards into the clip sequence before stitching.

3. **No on-demand person generation**: Users must pre-create an AI Twin. There's no way to generate a character inline during reel creation.

---

### Changes

#### 1. Inject Camera Angle Variety Into Each Scene Image (Edge Function)

**File: `supabase/functions/generate-reel-video/index.ts`**
- Accept a new `cameraAngles` parameter (array of angle IDs or prompt modifiers)
- For each scene, rotate through different camera angles (e.g., scene 1 = eye-level, scene 2 = three-quarter, scene 3 = low-angle, etc.) and append the angle's `promptModifier` to the image generation prompt
- This ensures each scene looks visually distinct even with the same character

**File: `src/pages/Reels.tsx`**
- Pass `selectedCameraAngle` and a curated rotation of angles from `CAMERA_ANGLES` to the `generate-reel-video` call
- Import and use the `promptModifier` field from camera angle data

#### 2. Add Intro Slide and CTA Slide Insertion

**File: `src/pages/Reels.tsx`**
- Add an "Add Intro Slide" and "Add CTA Slide" button in the scene gallery area (near the stitch button)
- Each opens a small form where the user provides: headline text, subtitle, background color/gradient, and optional logo
- On submit, generate a slide image using the AI image model with the text content baked into a visual design
- Insert the generated slide into `project.generatedScenes` and `project.videoClips` at position 0 (intro) or last (CTA) with a fixed 3-5s duration
- These slides participate in the normal stitch flow

#### 3. Generate a Person On-Demand (No AI Twin Required)

**File: `src/pages/Reels.tsx`**
- Add a "Generate Character" button alongside the existing AI Twin selector
- Clicking it opens a dialog where the user describes the person (e.g., "professional woman in her 30s, business attire")
- Uses the Lovable AI image model (`google/gemini-3.1-flash-image-preview`) to generate a reference portrait
- The generated image URL is set as `portraitImage` and `characterDescription` is populated, feeding into the existing character consistency pipeline
- No need to save as a full AI Twin — it's a session-scoped generated reference

#### 4. Pass Data Through the Pipeline

**File: `src/pages/Reels.tsx`** — in `generateVideo()`:
- Build a `cameraAngleRotation` array from `CAMERA_ANGLES` data, cycling through varied angles per scene
- Pass it to the edge function call

**File: `supabase/functions/generate-reel-video/index.ts`** — in `getTemplateImagePrompt()`:
- Accept and incorporate the per-scene camera angle modifier into the prompt so each scene has a distinct visual perspective

### Files to Modify
- `src/pages/Reels.tsx` — pass camera angles, add intro/CTA slide UI, add generate-person button
- `supabase/functions/generate-reel-video/index.ts` — accept and use per-scene camera angle modifiers in image prompts

