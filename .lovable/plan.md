

## Strengthen Podcast Talking Head Prompts

### Problem
The current prompts use "cinematic" language and studio settings, producing overly polished results. The user wants a natural, iPhone-selfie-style talking head with realistic mouth movements and subtle camera motion.

### Changes

**File: `src/pages/Podcast.tsx`**

**1. Update the image generation prompt (line 251-257)**
Replace the cinematic studio portrait prompt with a natural iPhone selfie-style prompt:
- Shot on iPhone, natural daylight, casual setting (home office, coffee shop, outdoors)
- Natural skin texture with pores/imperfections, no retouching
- Mid-sentence speaking expression, relaxed posture
- Remove all "cinematic", "RED V-RAPTOR", "8K editorial" language

**2. Update the lip-sync video prompt (line 269)**
Replace the cinematic spokesperson prompt with realistic talking-head direction:
- Emphasize wide, natural mouth movements with visible jaw motion
- Add subtle iPhone-style camera micro-movements (handheld wobble)
- Natural head tilts, eyebrow raises, blinking
- Remove "cinematic", "broadcast studio", "premium quality"
- Add "filmed on iPhone front camera" framing

### Example prompts

**Image prompt:**
```
Photorealistic selfie of this EXACT person filmed on an iPhone front camera.
CHARACTER: {description}
CAMERA: iPhone front-facing camera, slight low angle, arm's length distance
SETTING: Casual real environment — home office or living room, natural window light
EXPRESSION: Mid-sentence speaking, relaxed and authentic, looking directly at camera
QUALITY: Ultra photorealistic, natural skin with pores, no retouching. NO text, NO watermarks.
```

**Video lip-sync prompt:**
```
Real person talking naturally on iPhone front camera. Wide fluid mouth movements with visible jaw and lip motion. Natural head movements — slight tilts, nods, eyebrow raises. Subtle handheld camera micro-shake. Casual, authentic energy. NOT cinematic, NOT polished — raw and real like an iPhone selfie video.
```

