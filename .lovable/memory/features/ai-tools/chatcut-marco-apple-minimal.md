---
name: chatcut-marco-apple-minimal
description: Marco's hard "Apple-minimal" overlay rules (R1-R8) — verbatim text only, ≤1 onscreen, max 4 per 30s, 2.5s min, never cover subject
type: feature
---
Hard override prepended to Marco's system prompt in `supabase/functions/chatcut-director/index.ts` (right after the persona line). Eight rules — they explicitly WIN any contradiction with older guidance below them.

## The 8 rules
- **R1 Default zero overlays** — start position is "add nothing"; only place if (a) ≤6-word quotable phrase, (b) literally needed to understand the line (number/list/URL), or (c) user asked.
- **R2 Hard cap** — ≤1 overlay onscreen at any moment, ≤4 per 30s, 1 CTA, 1 hook.
- **R3 Verbatim text** — `text` field MUST be word-for-word from transcript or a literal stat/brand asset. No paraphrasing, no "Key Insights", no invented headlines. If no verbatim phrase fits → don't add.
- **R4 Timing sacred** — min duration 2.5s (3s for lists), 1.5s gap between overlays, snap start within ±0.15s of spoken word when wordTimings available.
- **R5 Never cover subject** — read `vision.currentFrame` first. Subject left → overlay right; centered → top_banner/lower_third only. NEVER center_takeover/behind_subject/masked_typography on centered talking-head.
- **R6 Treatment palette** — preferred: clean_caption, stat_card, lower_third_pro, cta_lockup, quote_pop. Avoid: kinetic_headline (1 max), masked_typography, center_takeover, full_card, bullet_stack >3, anything filling >50% of frame.
- **R7 Punch-in over graphics** — `add_punch_in` is the first instinct for energy, not a graphic.
- **R8 No hallucinations** — no invented stats, no meta text ("Hook", "Section 1"), no "Watch this".

## Cleanup behavior
On user complaints ("fix overlays" / "cluttered" / "garbage" / "redo graphics"): audit `context.currentOverlays`, REMOVE every overlay violating R1–R8 (paraphrased, <2.5s, overlapping, covers face, generic header), then add back ≤3–4 minimal verbatim overlays at true hero beats, and tell the user count + reason.

## Why
Older sections of the prompt encouraged "5–8 hero animations per 30s reel", lots of treatments, and never required verbatim transcript text — which produced cluttered, paraphrased, mistimed, face-covering overlays. The override block sits at the top so the LLM treats it as the dominant style instruction.
