---
name: Chatcut Premium B-Roll
description: Marco's add_premium_broll_auto action scans transcript phrases and queues 6-10 cinematic 3s Wan 2.5 i2v clips at exact word timestamps
type: feature
---
Marco (Chatcut AI) supports a "Premium B-Roll" pass triggered by phrases like "add premium b-roll", "premium broll where it makes sense", "make it cinematic". The `add_premium_broll_auto` action returns `clips:[{phrase,start,prompt,broll_type}]` mapping the most visually evocative phrases (sensory verbs, transformations, product/ritual moments) to literal-visualization Wan 2.5 prompts. The client expands each into a 3-second `add_broll` call marked `premium:true`, generated in the background via the existing image→Wan 2.5 i2v pipeline. UI: ⭐ badge in the Media panel; toast "⭐ N Premium B-Rolls queued". Defaults: 6–10 phrases, 3s each, evenly spread, skips windows already covered by existing b-roll (2s buffer). No new API key — uses existing `WAVESPEED_API_KEY`.
