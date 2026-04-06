
# Lifestyle Stories Feature

## Phase 1 — Foundation (this session)

### 1. Add navigation & page route
- Add "Lifestyle Stories" nav item under AI Tools group in Navigation.tsx
- Create `/lifestyle-stories` route in App.tsx
- Create `src/pages/LifestyleStories.tsx` page shell with Layout

### 2. Brand Analysis Step
- URL input form for website analysis
- Create `supabase/functions/analyze-brand-website/index.ts` edge function that:
  - Uses Firecrawl to scrape the website (or falls back to Lovable AI if no Firecrawl connector)
  - Sends content to Lovable AI (Gemini 3 Flash) to extract: brand tone, product type, target audience, visual style, key benefits, content angles
  - Returns recommended video types (lifestyle benefit, before/after, daily routine, problem-solution, testimonial, emotional, education)
- Display analysis results and video type recommendations as selectable cards

### 3. Video Concept Generation
- User selects duration (15s, 30s, 60s) and number of concepts (3-5)
- Create `supabase/functions/generate-lifestyle-concepts/index.ts` that generates 3-5 story concepts with:
  - Hook, scene breakdowns, product placement moments, CTA
  - Each concept has title, description, scene list with prompts
- Display concepts as cards for user to pick/edit

### 4. Database table
- Create `lifestyle_stories` table to persist projects (user_id, brand_analysis, concepts, selected_concept, scenes, voiceover_url, music_url, video_url, status)

### 5. Video Production Pipeline
- Reuse existing infrastructure:
  - Scene image generation via `generate-scene-image` or `generate-premium-visual`
  - Video generation via `wavespeed-video` (Sora-2/VEO3)
  - Voiceover via `text-to-speech` (OpenAI TTS) or Google Cloud TTS
  - Background music via WaveSpeed music proxy
  - Stitching via Creatomate or canvas fallback
- Generate all scenes for selected concept sequentially
- Show progress indicator during generation

### 6. Timeline Editor Integration
- Reuse existing `TimelineEditor` component
- Load generated scenes into timeline tracks (Scenes, Voiceover, Music)
- Allow swap/trim/reorder while keeping alignment
- Re-stitch capability after edits

## Phase 2 — Polish (follow-up)
- Multiple concept batch generation
- Advanced brand analysis with Firecrawl branding format
- Export/download options
- Saved templates library
