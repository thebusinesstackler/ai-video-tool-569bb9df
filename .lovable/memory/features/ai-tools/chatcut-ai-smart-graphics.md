---
name: chatcut-ai-smart-graphics
description: Brand-aware DOM-rendered motion graphics (SmartOverlay) for Chatcut AI replacing PNG buttons; full-coverage scenes; image fallback via Nano Banana 2
type: feature
---
Chatcut AI's motion graphic system uses `<SmartOverlay>` (src/components/chatcut/SmartOverlay.tsx) to render crisp brand-coloured overlays directly in the DOM — no PNG, no transparency artifacts. Marco picks from a rich type catalog: stat_callout, benefit_chip, benefit_list, numbered_list, feature_grid, comparison, quote_pop, lower_third, cta_button, title_card. Two new actions `add_text_card` (compact on-video) and `add_full_coverage` (take-over scene that replaces the video for ~3-4s) handle most cases. Each OverlayItem has `renderMode: 'dom' | 'image'`, `items[]`, `subtext`, `fullCoverage` flags. Marco's prompt includes a DECISION TREE matching script beats (numbers→stat_callout, lists→benefit_list, take-over→numbered_list/feature_grid). The legacy image path uses `google/gemini-3.1-flash-image-preview` (Nano Banana 2) with a stricter transparency prompt and is reserved for genuine illustrations only.
