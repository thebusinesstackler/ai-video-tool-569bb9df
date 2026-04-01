

# Switch All AI Edge Functions from Lovable AI to Claude API (Opus with Extended Thinking)

## Overview

Replace the Lovable AI Gateway with Anthropic's Claude API (claude-opus-4-20250514) across all 23 edge functions that currently call `ai.gateway.lovable.dev`. Claude's extended thinking feature will be enabled for complex reasoning tasks.

## Step 1: Add Claude API Key as a Secret

You'll need to provide your Anthropic API key. We'll store it securely as `ANTHROPIC_API_KEY` in the backend secrets.

## Step 2: Create a Shared Claude Helper

**New file: `supabase/functions/_shared/claude.ts`**

A reusable module that:
- Calls `https://api.anthropic.com/v1/messages` with the Claude Messages API format
- Converts OpenAI-style `messages` arrays to Claude's format (separating `system` from user/assistant messages)
- Enables extended thinking with configurable budget (default: 10,000 tokens for complex tasks, 5,000 for simpler ones)
- Handles 429/402 errors consistently
- Returns a normalized response matching the current `{ response, imageUrl }` shape so frontend code doesn't need changes

## Step 3: Update All 23 Edge Functions

Each function will be updated to:
1. Import the shared Claude helper
2. Replace `LOVABLE_API_KEY` with `ANTHROPIC_API_KEY`
3. Replace `fetch('https://ai.gateway.lovable.dev/...')` with the Claude helper call
4. Use `claude-opus-4-20250514` as the model

**Functions to update:**
- `ai/index.ts` (general purpose — used by AI Spokesperson)
- `generate-script/index.ts`
- `generate-reel-script/index.ts`
- `generate-commercial-strategy/index.ts`
- `generate-scene-dialogue/index.ts`
- `generate-movie-outline/index.ts`
- `generate-movie-scenes/index.ts`
- `generate-story-bible/index.ts`
- `generate-content-strategy/index.ts`
- `generate-video-hooks/index.ts`
- `generate-scene-image/index.ts`
- `generate-twin-angles/index.ts`
- `generate-conversation-dialogue/index.ts`
- `pete-ai-chat/index.ts`
- `analyze-face-description/index.ts`
- `analyze-face-similarity/index.ts`
- `analyze-reference-image/index.ts`
- `extract-locations/index.ts`
- `upscale-image/index.ts`
- `upscale-video/index.ts`
- `edit-scene-image/index.ts`
- `describe-scene/index.ts`
- `generate-reel-voiceover/index.ts` (if it uses AI gateway)

## Step 4: Handle Image Generation Functions

Claude does not generate images. Functions that use Gemini image models (`gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`) for image generation will **keep using Lovable AI** since Claude cannot replace that capability. These include:
- `generate-scene-image/index.ts` (image generation)
- `generate-twin-angles/index.ts` (image generation)
- `upscale-image/index.ts` (image editing)
- `edit-scene-image/index.ts` (image editing)

Only the **text reasoning** portions of these functions will switch to Claude where applicable.

## Step 5: Extended Thinking Configuration

Extended thinking will be enabled with budget tokens based on task complexity:
- **High reasoning** (script generation, commercial strategy, movie outlines): `budget_tokens: 16000`
- **Medium reasoning** (dialogue, content strategy, scene descriptions): `budget_tokens: 8000`
- **Light reasoning** (chat responses, face analysis, location extraction): `budget_tokens: 4000`

## Technical Notes

- Claude Messages API uses `anthropic-version: 2023-06-01` header
- Extended thinking requires `thinking: { type: "enabled", budget_tokens: N }` in the request body
- System prompts go in the top-level `system` field, not as a message
- No frontend changes needed — the edge functions maintain the same response contract
- Image generation functions retain Lovable AI as a fallback for that specific capability

## Files Changed

- 1 new shared helper file
- ~19 edge function updates (text-only AI calls)
- ~4 edge functions partially updated (keep Lovable AI for image gen, use Claude for text)

