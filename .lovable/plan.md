

## Plan: Switch to OpenAI for Image Generation + Use GPT for Scripts

### Summary
Remove all Lovable AI Gateway fallbacks. Use **OpenAI `gpt-image-1`** for image generation and **Claude (already configured)** or **OpenAI `gpt-4o`** for text/script tasks. When Claude is unavailable, fall back to OpenAI — never to Lovable AI.

### Changes

#### 1. Update `supabase/functions/ai/index.ts` (central AI function)
- **Image requests**: Replace Lovable AI gateway with OpenAI `gpt-image-1` API (`api.openai.com/v1/images/generations`)
- **Text requests**: Keep Claude as primary. Add OpenAI `gpt-4o` as fallback if Claude fails (instead of no fallback)
- Remove all `ai.gateway.lovable.dev` references

#### 2. Update `supabase/functions/edit-scene-image/index.ts`
- Remove `generateWithLovableAI` function entirely
- For **reference image** requests: Use OpenAI `gpt-image-1` (it supports image editing via the new API). Build a rich text prompt that describes the reference context instead of passing reference images directly, since DALL-E doesn't accept multimodal input
- For **text-only** requests: Use OpenAI `gpt-image-1` directly
- Remove all Lovable AI fallback paths

#### 3. Update `supabase/functions/generate-scene-image/index.ts`
- Replace Lovable AI gateway calls with OpenAI `gpt-image-1`
- For reference image scenarios: enhance the text prompt with detailed character/location descriptions instead of passing images (OpenAI limitation)
- Remove 402 "add Lovable credits" error messages

#### 4. Update `supabase/functions/generate-reel-video/index.ts`
- Replace image generation calls from Lovable AI to OpenAI `gpt-image-1`
- Replace the "AI super prompt" text call to use Claude or OpenAI `gpt-4o`

#### 5. Update `supabase/functions/generate-twin-angles/index.ts`
- Replace Lovable AI image generation with OpenAI `gpt-image-1`

#### 6. Update `supabase/functions/upscale-image/index.ts`
- Replace Lovable AI image editing with OpenAI `gpt-image-1` edit endpoint

#### 7. Enhance prompt quality
- Add a prompt enhancement step: before generating images, use Claude/GPT-4o to refine the user's prompt into a detailed, photorealistic image prompt optimized for DALL-E
- This ensures higher quality output from OpenAI's image model

### Technical Notes
- `OPENAI_API_KEY` is already configured as a secret
- `ANTHROPIC_API_KEY` is already configured for Claude
- OpenAI `gpt-image-1` returns base64 or URL — existing extraction logic will be adapted
- 6 edge functions will be updated across the project

