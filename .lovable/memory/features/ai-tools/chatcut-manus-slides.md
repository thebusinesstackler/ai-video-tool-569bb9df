---
name: chatcut-manus-slides
description: Manus API slide generator for Chatcut — async kickoff + poll, slides drop as static B-roll graphics under the PiP twin
type: feature
---
Chatcut AI can generate AI-designed slide decks via the Manus API and drop them on the B-Roll track as static graphics (the PiP AI Twin sits on top).

**Edge functions:**
- `generate-manus-slides` — POST `/v2/task.create` with `force_skills:["slides"]`, returns `taskId` immediately (async).
- `check-manus-slides` — Polls `/v2/task.detail`; on `completed` walks `/v2/task.listMessages` assistant attachments, keeps every `image/*`, re-hosts to `project-files/{userId}/manus-slides/{taskId}/slide-NN.png`, returns ordered `slideUrls[]`.

Both verify JWT via `auth.getClaims(token)`. Manus auth header is `x-manus-api-key`, base URL `https://api.manus.ai/v2`. Secret: `MANUS_API_KEY`.

**Client (src/pages/ChatcutAI.tsx):**
- `generateSlidesFromManus({ prompt, slideCount, style, perSlideDur, startAt, distribute })` kicks off, polls every 10s up to ~8 min, then for each slide URL calls `addBRollFromImage(url, label, prompt, slideStart, { staticOnly: true, duration })`. Distribution: `sequential` (back-to-back) or `evenly_across_video` (spread).
- "🎞 New Slide Graphic" quick-action button next to "⭐ Premium B-roll" opens a Dialog (topic textarea, slide count 2-15, per-slide duration, style, place from cursor or 0s).
- Marco action `add_slide_broll` (params: `prompt`, `slideCount`, `perSlideDur`, `start`, `distribute`, `style`) — defined in chatcut-director prompt section 6d.

**UX rules:** Manus is async (1-4 min typical). Cancel button sets `slidesPollRef.current.stop = true`. Toasts cover kickoff, completion, and failure. Slides land as static B-roll so the existing PiP overlay system renders the AI Twin on top automatically.
