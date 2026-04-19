---
name: chatcut-marco-vision-phase1
description: Marco's vision pipeline — analyze-frame-vision edge function detects subjects (product/face/text/logo), occlusions, and contrast per overlay so Marco can fix coverage problems autonomously
type: feature
---
Phase 1 of "Marco's eyes". Adds a server-side vision pass that runs in parallel with each Marco message so he knows what's actually on screen and which overlays are covering what.

## Edge function: `analyze-frame-vision`
Input: `{ frames: [{time, dataUrl}], overlays: [{id, type, text, start, end, position, scale, treatment}], aspectRatio, captionStripActive }`.

Pipeline:
1. **Subject detection** — sends up to 4 keyframes to Gemini 2.5 Flash with a strict JSON-only schema. Returns per-frame `subjects[]` with label (`product | face | text | logo | hands | other`), bbox (x,y,w,h in % of frame), and confidence.
2. **Occlusion compute (deterministic, no AI cost)** — for each overlay active at a frame's timestamp, compute its on-screen rect via `overlayBBox(o)` (38% × 14% baseline scaled by `scale`, bigger for full-coverage types). Intersect with each detected subject. Emit `{ overlayId, time, subjectLabel, overlapPct, severity: low|med|high, suggestion }`. Severity bands: ≥40% high, ≥18% med, ≥8% low (under 8% ignored).
3. **Contrast flag** — coarse luminance proxy from the jpeg dataURL byte mean (0–1). >0.78 or <0.22 → low contrast (white-on-white or black-on-black risk).
4. Returns `{ ok, subjects, occlusions, contrast, summary: { framesAnalyzed, occlusionCount, highSeverityOcclusions, lowContrastCount, worstOcclusion } }`.

Fails open: any error returns `{ ok: false }` and Marco still works without vision.

## Wiring (`src/pages/ChatcutAI.tsx` sendMessage)
Right after `extractKeyframesFromElement`, calls `supabase.functions.invoke('analyze-frame-vision', ...)` only when there are ≥2 frames AND ≥1 overlay (avoids wasted calls). Caps at 4 frames for cost.

Result attached to Marco's payload as `context.vision = { subjects, occlusions, contrast, summary }`.

## Director prompt (`supabase/functions/chatcut-director/index.ts`)
New `VISION INTEL` section in the director-intel system message. Lists all occlusions with the specific suggestion field, all low-contrast overlays with luminance.

New directive #8 (VISION RULES):
- **a.** Every high-severity occlusion → IMMEDIATELY emit `update_overlay` / `update_motion_graphic` with the suggested position. Don't wait for the user.
- **b.** Med severity → mention + offer one-tap fix.
- **c.** Low-contrast → switch to solid-card treatment OR reposition to calmer zone.
- **d.** Always cite overlay id + timestamp when reporting.
- **e.** NEVER add a new overlay where a face or product is detected.

## Suggestion logic (server-side, in `suggestionForOcclusion`)
- **face occlusion**: if overlay center y<40 → drop to lower_third (y≈82); else move to top_banner (y≈14).
- **product occlusion**: shift to opposite side panel (x≈22 or x≈78).
- **text/logo**: move to opposite half to avoid double-text collision.

## Files
- `supabase/functions/analyze-frame-vision/index.ts` — new
- `src/pages/ChatcutAI.tsx` — vision call + `context.vision` payload
- `supabase/functions/chatcut-director/index.ts` — VISION INTEL section + directive #8
