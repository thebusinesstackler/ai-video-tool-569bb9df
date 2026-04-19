---
name: chatcut-director-creative-brief
description: Marco's creative-director system prompt (5 lenses, visual-intelligence pre-flight, B-roll matchType, add_punch_in action, brand-context injection)
type: feature
---
Marco (`supabase/functions/chatcut-director/index.ts`) now operates as a full creative director, not a tool-caller.

## Five-lens thinking
Every decision passes through: short-form editor · motion-graphics designer · creative strategist · social-media performance marketer · brand-aware visual storyteller. Edits MUST serve at least one of: ↑retention · clarity · engagement · visualization · polish · platform-fit.

## Visual-intelligence pre-flight checklist
Before emitting any `add_motion_graphic` / `add_animated_graphic`, Marco silently answers: where is the speaker? · empty space side? · will text cover face? · should subject shrink/shift/cutout-mask? · hero beat (animated) or supporting (DOM)? · or is the cleanest move b-roll/punch-in/clean caption — no graphic at all? Then chooses `placement` + `subjectAction` + `treatment` from those answers — never blind `lower_third` defaults.

## Motion graphics: clarity over complexity
Add a graphic ONLY when the line needs emphasis/visualization/pattern-interrupt. Otherwise default to: cleaner caption · single full-screen card · b-roll + overlay · `add_punch_in` + caption · UI/screenshot callout.

## B-roll matchType (NEW required field)
Every `add_broll` (saved or fresh) must include `matchType`: `"literal"` (best, prefer) | `"metaphor"` (good) | `"mood"` (lowest — generate fresh instead of reusing a saved mood clip). Categories Marco picks from: product demo · website scroll · UI walkthrough · lifestyle · problem/solution · abstract mood · social proof · feature illustration · environment · close-up detail.

## New action: `add_punch_in` (zero render cost)
Cheap "clarity over complexity" tool. CSS `transform: scale(...)` on the main `<video>` for a window. Params: `start`, `duration` (default 2s), `scale` (1.05–1.4, default 1.15), `reason`. Paired `remove_punch_in` accepts `{id}` or `{at}`. Implemented in `src/pages/ChatcutAI.tsx`: state `punchIns`, derived `activePunchIn` via useMemo, transform applied inline on the main video element with smooth 0.5s cubic-bezier transition.

## Brand context (already injected)
The director endpoint already receives `brandGuidelines` (PDF text), `brandSettings` (color/font/logo/website), `productLibrary`, and `brandVocabulary` from `ChatcutAI.tsx` and prepends them as system messages. The new persona prompt explicitly tells Marco to ASK ONCE for vibe (premium/playful/clinical/direct-response) when brand context is weak and lock it in for the session.

## SmartOverlay behind_subject z-index fix
`placementStyle('behind_subject')` in `src/components/chatcut/SmartOverlay.tsx` now returns `zIndex: 0` so masked typography truly sits BEHIND the speaker layer (combined with existing mix-blend-mode in MaskedTypography for the see-through illusion).

## Out of scope
- True person-segmentation matting (faked with mix-blend + radial vignette).
- Per-frame computer-vision inspection (Marco reasons from transcript + currentOverlays/currentBRoll context, not pixel analysis).
- Auto-extracting brand tone from a fresh URL inside Chatcut (uses Settings-stored brand context).
