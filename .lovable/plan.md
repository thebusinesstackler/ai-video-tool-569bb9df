

## Problem

The "bottle in hand" issue comes from **two sources**:

1. **Template character descriptions** — Characters like "Maya – Fitness Influencer" have descriptions that say "holding a supplement bottle" and "Sarah – Product Ambassador" says "holding a skincare/beauty product." When a user selects one of these templates, the `characterDescription` is injected verbatim into every scene's image generation prompt via `generate-reel-video/index.ts` (`Character: ${characterDescription}`).

2. **Reference images** — The template character images (`template-char-product1.jpg`, `template-char-product3.jpg`) physically show people holding products/bottles. The AI model sees these reference images and reproduces the bottle/product in every generated scene, regardless of the topic.

## Plan

### 1. Sanitize character descriptions to remove product references
In `src/components/CharacterManager.tsx`, update the template character descriptions to describe **only the person's appearance** (face, hair, build, clothing style) — not what they're holding:
- "Sarah – Product Ambassador" → describe her appearance only (professional woman, styled hair, etc.)
- "Maya – Fitness Influencer" → describe her appearance only (athletic build, workout attire, etc.)
- Same for Jake and Carlos

### 2. Strip product/prop references from characterDescription before image generation
In `supabase/functions/generate-reel-video/index.ts`, add a sanitizer function that strips prop-related phrases from `characterDescription` before injecting it into image prompts. Pattern: remove "holding a...", "with a...", "carrying a..." type phrases so only physical appearance remains.

### 3. Add anti-prop instruction to image generation prompts
In `supabase/functions/generate-reel-video/index.ts`, add an explicit instruction to the image generation prompts: "Do NOT add any objects, bottles, or products to the character's hands unless the scene description explicitly calls for it. The character's hands should be natural and empty unless specified."

### 4. Reinforce in generate-reel-script edge function
The script generator already has a "NEVER default to holding a bottle" instruction, but strengthen it by also adding: "visualDescription must NEVER include 'holding a bottle', 'holding a product', or any prop in the character's hands unless the topic explicitly involves that specific item."

### Files to modify
- `src/components/CharacterManager.tsx` — Clean template descriptions
- `supabase/functions/generate-reel-video/index.ts` — Sanitize characterDescription, add anti-prop prompt instructions
- `supabase/functions/generate-reel-script/index.ts` — Strengthen visual description rules

