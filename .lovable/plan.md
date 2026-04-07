

# Animate Statics — New AI Tool

## Overview
A new page under AI Tools that lets users upload or select a static image, get AI-powered animation suggestions, and generate animated video clips using existing WaveSpeed image-to-video models. The AI analyzes the image and interprets natural-language prompts to determine animation direction.

## What Gets Built

### 1. Navigation and routing
- Add "Animate Statics" nav item under AI Tools group in `Navigation.tsx` with `Wand2` icon and Beta badge
- Add `/animate-statics` route in `App.tsx` (protected)
- Create `src/pages/AnimateStatics.tsx`

### 2. Page UI — multi-step wizard
**Step 1: Image Selection**
- Upload a new image (drag-and-drop zone) or pick from existing Image Gallery (reuse `useImageGallery` hook)
- Show selected image preview

**Step 2: AI Analysis and Prompt**
- Call a new edge function `analyze-animate-image` that sends the image to Lovable AI (Gemini 2.5 Pro with vision) to identify objects, layout, product elements
- Display AI-suggested animation ideas as clickable chips (e.g. "Slow zoom in", "Product float", "Background parallax", "Fade-in CTA text")
- Free-text prompt input where users can type custom instructions like "Add a Shop Now button" or "Animate the bottle left and right"
- Combine user prompt + AI suggestions into a final animation prompt

**Step 3: Generation**
- Call `wavespeed-video` with model `kling-v3.0-pro` (high-quality image-to-video) using the image and composed prompt
- Poll for status, show progress bar
- Display video preview when complete

**Step 4: Refine and Export**
- Video player with the result
- "Refine" button to go back to prompt step and adjust
- Option to add background music (reuse existing `generate-music` edge function)
- Export as downloadable MP4/GIF
- Save to gallery option

### 3. New edge function: `analyze-animate-image`
- Accepts `{ imageUrl: string }`
- Sends image to Lovable AI Gateway (Gemini 2.5 Pro) with a system prompt asking it to:
  - Identify objects, products, text, layout elements in the image
  - Suggest 5-8 animation directions (zoom, pan, float, pulse, parallax, fade-in text, etc.)
  - Return structured JSON via tool calling
- Returns `{ objects: string[], suggestions: { label: string, prompt: string }[] }`

### 4. Database table: `animated_statics`
- Columns: `id`, `user_id`, `source_image_url`, `analysis` (JSONB), `prompt`, `animation_url`, `music_url`, `status`, `created_at`, `updated_at`
- RLS: users can only CRUD their own rows

## Technical Details

**Files to create:**
- `src/pages/AnimateStatics.tsx` — main page with 4-step wizard
- `supabase/functions/analyze-animate-image/index.ts` — AI vision analysis

**Files to modify:**
- `src/components/Navigation.tsx` — add nav item
- `src/App.tsx` — add route

**Video generation:** Reuses existing `wavespeed-video` edge function with `kling-v3.0-pro` model (best quality for image-to-video). The composed prompt from the AI analysis + user input drives the animation style.

**GIF export:** Use the browser to capture video frames and encode as GIF client-side, or provide MP4 download directly (GIF encoding can be a Phase 2 enhancement).

**Music:** Reuse existing `generate-music` edge function to add background audio matched to mood.

