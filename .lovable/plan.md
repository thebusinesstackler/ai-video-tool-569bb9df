
## Plan — Content Archetype Engine for Video Repo Pro

The user wants to stop generating "ads" and start generating **7 distinct content archetypes**, each with its own pacing, camera, acting style, script structure, and product integration. This is a Style Selector System layered on top of the existing performance-grade scripting upgrades.

### File to edit
- `src/pages/VideoRepo.tsx` — add archetype state, picker UI, and archetype-aware prompt assembly inside `analysisInstruction`.

### What to build

**1. New state + UI: Content Archetype Picker**
- Add `contentStyle: 'auto' | 'documentary' | 'ugc' | 'cinematic' | 'educational' | 'story' | 'asmr' | 'contrarian'` state.
- Render a horizontal pill picker at the top of the composer (above the prompt textarea), styled like the existing StylePicker pattern. Default = `auto` (Marco picks the best fit based on product + intent).
- Each pill shows: icon + label + 1-line vibe (e.g. "ASMR — sensory, no talking").

**2. Archetype Prompt Library (new constant in VideoRepo.tsx)**
A `CONTENT_ARCHETYPES` object where each archetype defines 6 dimensions injected into the system prompt:
- `scriptStructure` (e.g. Documentary = "no hook, start mid-thought, soft/no CTA")
- `voiceRules` (Documentary = pauses, breaths, imperfections; UGC = interruptions, jump-cut energy; Cinematic = minimal/voiceover-only; ASMR = no dialogue)
- `cameraDirection` (Cinematic = sliders + push-ins + slow-mo; UGC = handheld chaotic; Documentary = locked-off natural; ASMR = macro shots)
- `actingDirection` (Contrarian = intense eye contact, high confidence; Documentary = eyes drift, soft; UGC = casual, slightly messy)
- `productIntegration` (Cinematic = product is felt not shown; Educational = product as tool; Story = product as turning point; ASMR = product is the hero visual)
- `bannedPatterns` (e.g. Documentary BANS: hooks, CTAs, ad language, "this changed my life")

**3. Archetype-aware system prompt assembly**
When generating, inject the chosen archetype's 6 dimensions BEFORE the existing PRODUCT FIDELITY / ACTION MANIFEST / Performance Direction blocks. Add an explicit override:

> "ARCHETYPE LOCK: This is a [X] piece, NOT an ad. Follow the [X] rules above. If they conflict with the default ad-structure instincts, the archetype wins."

**4. Archetype-specific overrides to existing blocks**
- **ASMR / Story / Cinematic** → skip the spoken-script Voice rules, replace with sound-design + visual-texture directives.
- **Documentary** → disable the Distinctive Hook Bank (no hook allowed) and disable the CTA quality bar (no CTA).
- **Contrarian** → force opening line to be a contrarian statement; ban gentle/empathetic openers.
- **Educational** → require ONE teachable fact in the body; product appears only in last third.
- **Story** → force 3-scene structure (struggle → discovery → transformation), allow zero talking-head.

**5. Auto mode logic**
When `contentStyle = 'auto'`, prepend an instruction telling Gemini 2.5 Pro to first pick the best archetype for the product/intent, name it in the response, then write to that archetype's rules. This keeps current behavior usable without forcing a choice.

**6. UI feedback**
- Selected archetype shows a small badge in the chat status during generation: "🎬 Generating as: Documentary (no CTA, real-story mode)".
- Tooltip on each pill explains the use case (e.g. "Cinematic — brand authority, Apple/Nike feel").

### Out of scope
- New edge functions, new models, DB changes.
- Multi-archetype generation in one render.
- Automatic archetype A/B testing (could be a follow-up).

### Why this works
The existing prompt always biases toward "ad" because the structure (problem → product → benefit → CTA) is hardcoded. By making archetype the **top-level lock** and letting it override the ad structure, the same generator can produce a silent ASMR macro reel, a contrarian talking-head, or a 3-scene mini-story from the same product input.
