

# Fix Animate Statics Prompt Quality — Prevent Object Movement

## Problem
The AI video model (WaveSpeed Wan 2.5 i2v) interprets animation prompts too literally. When the analysis prompt suggests actions like "products float" or "elements slide," the video model moves products out of frame and shifts UI elements (bullet points, badges) away. The video model creates a single continuous shot — it cannot do "editing" moves like repositioning objects.

## Root Cause
The system prompt in `analyze-animate-image` allows suggestions like "Product Float" and movement-based animations. The video model treats these as physical motion instructions, causing products and text overlays to drift or exit the frame.

## Fix — Edge Function Prompt Rewrite

Update `supabase/functions/analyze-animate-image/index.ts` system prompt with strict constraints:

1. **Add explicit prohibition rules** to the system prompt:
   - NEVER suggest moving, floating, sliding, or repositioning any object in the image
   - NEVER suggest removing, hiding, or transitioning any element out of frame
   - All objects, text overlays, badges, and products must remain in their EXACT position throughout
   - Only allow: camera movement (zoom, pan, dolly), lighting changes, atmospheric effects (particles, bokeh, lens flare), and subtle environmental motion (background blur shift, light rays)

2. **Update the suggestion prompt field description** to reinforce:
   - "Must NOT include any instruction to move, float, slide, or reposition any object. Only describe camera movement, lighting shifts, and atmospheric effects applied OVER the static composition."

3. **Add a negative prompt pattern** — append to every generated prompt:
   - "All products, text, badges, and UI elements remain perfectly stationary in their original positions throughout the entire animation."

4. **Reduce suggestion types** to safe categories only:
   - Camera: Slow Zoom In, Slow Zoom Out, Gentle Pan, Orbit
   - Atmosphere: Bokeh Bloom, Light Rays, Particle Dust, Lens Flare
   - Lighting: Golden Hour Shift, Spotlight Sweep, Ambient Glow
   - Depth: Rack Focus, Background Blur Shift

### File Modified
- `supabase/functions/analyze-animate-image/index.ts` — rewrite system prompt with movement prohibitions and safe animation categories

