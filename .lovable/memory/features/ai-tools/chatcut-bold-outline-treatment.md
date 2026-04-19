---
name: chatcut-bold-outline-treatment
description: Chatcut's `bold_outline` motion-graphic treatment — heavy white display sans with thick black text-shadow stroke, word-stacked. Default for hooks/headlines.
type: feature
---
New SmartOverlay treatment `bold_outline` matches the on-screen text style Video Repo paints onto motion-video keyframes (e.g. "MY / MORNING / SECRET" in `user-uploads://image-167.png`).

## Visual recipe
- Heavy white (`#fff`) display sans, weight 900, uppercase, line-height 0.92.
- Thick black stroke faked via 8-direction layered `text-shadow` (3px each) + a soft 0/6/12 black drop-shadow. Avoids unreliable `-webkit-text-stroke` at large sizes.
- Each word renders on its own line as an `inline-block` with a 70ms staggered pop-in (`smartOvBoldOutlinePop`).
- Sizing: `clamp(38px, 11cqw, 128px)` against the container-query video frame.

## Wiring
- Component: `BoldOutline` in `src/components/chatcut/SmartOverlay.tsx` (added to `CommercialTreatment` union and the `switch (treatment)` block).
- ChatcutAI executor: `treatment` union extended in `src/pages/ChatcutAI.tsx`; `wrapperWidthByTreatment.bold_outline = 'min(70%, 560px)'`; `halfWidthByTreatment.bold_outline = 35` for position clamping.
- Director: in `supabase/functions/chatcut-director/index.ts`, `intent:"hook"` default treatment changed from `kinetic_headline` → `bold_outline`. Treatment list and example payload updated.

## Marco's rule
`bold_outline` is the DEFAULT for any hook / on-screen headline. Use `kinetic_headline` only when an animated word-by-word reveal is explicitly desired; use `masked_typography` for the giant-brand-colour-behind-speaker moment.
