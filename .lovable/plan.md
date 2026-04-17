
## Plan: GPT-5.4 powers the new Commercial Director, GPT-5-mini handles support tasks

Build on the previous approved plan (Marco → Commercial Director with `add_motion_graphic`, layered SmartOverlay, paired subject treatments) and lock in the model routing you just specified.

### 1. Model routing in `chatcut-director` edge function
- **Director brain (GPT-5.4)** — `openai/gpt-5.2` via Lovable AI Gateway is our latest reasoning tier; once `gpt-5.4` is available on the gateway we swap the model id in one constant. Used for: scene-by-scene shot decisions, the new `add_motion_graphic` action, placement/treatment/subjectAction choices, and multi-tool orchestration (premium b-roll + overlays + cuts in one pass).
  - Enable `reasoning: { effort: "medium" }` for direction passes; `"high"` for the full-timeline "Direct this scene" command.
  - Keep tool-calling schema (`add_motion_graphic`, `add_premium_broll_auto`, `add_overlay`, `add_broll`, `cut`, etc.) so the brain orchestrates them.
- **Support brain (GPT-5-mini)** — `openai/gpt-5-mini`. New lightweight calls:
  - Headline variations for a chosen overlay
  - Caption cleanup / filler-word trim suggestions
  - Hook alternatives for the opening 6 seconds
  - Short metadata (title, description, hashtags)
  - "Make this graphic punchier" rewrites
- Both routed through the existing AI Gateway pattern — no direct OpenAI calls.

### 2. Vision + audio inputs to the director
- Extend `chatcut-director/index.ts` to accept and forward multimodal content parts:
  - **Frames**: sample 4–6 keyframes from the current video (already extracted for transcription) and pass as `image_url` parts so the director can see composition, negative space, where to place text, when to push in.
  - **Audio context**: pass the existing transcript + segment timing as text (cheaper, deterministic). Reserve raw audio input for a future pass — flagged as out of scope to keep cost predictable.
- This lets the director actually honor the "if background has negative space → place headline there" and "if frame is too tight → reframe" rules from your prompt.

### 3. New support endpoints (GPT-5-mini)
Add small actions to `chatcut-director` (or a sibling `chatcut-support` function — leaning sibling for clarity):
- `rewrite_overlay_text` — punchier headline variations for a selected overlay
- `suggest_hooks` — 3 hook rewrites for the first 6s
- `clean_captions` — strip filler words from the SRT-style transcript
- `generate_metadata` — title/desc/hashtags from the final timeline

Wire UI affordances in `ChatcutAI.tsx`:
- Right-click an overlay → "Rewrite headline (3 options)"
- Quick-action chip "✨ Punch up hook"
- Quick-action chip "🧹 Clean captions"
- Export panel button "Generate title & description"

### 4. Files touched (combined with prior approved plan)
- `supabase/functions/chatcut-director/index.ts` — model constants (DIRECTOR_MODEL, SUPPORT_MODEL), reasoning config, multimodal frame input, new Commercial Director system prompt, `add_motion_graphic` schema
- `supabase/functions/chatcut-support/index.ts` (new) — GPT-5-mini endpoints for rewrites/hooks/captions/metadata
- `src/components/chatcut/SmartOverlay.tsx` — new treatments (masked_typography, kinetic_headline, stat_card, side_notes, bullet_stack, cta_lockup, lower_third_pro, floating_note) + placement engine + subject-treatment hooks
- `src/pages/ChatcutAI.tsx` — `add_motion_graphic` executor, paired video-transform tweens, intent badges, "🎬 Direct this scene" / "✨ Punch up hook" / "🧹 Clean captions" quick actions, frame sampling before director calls
- `mem://features/ai-tools/chatcut-ai-smart-graphics.md` — updated with model routing + decision engine + layer model

### Honest call-outs
- `gpt-5.4` isn't yet a published id on Lovable AI Gateway; we'll use `openai/gpt-5.2` (current top-tier with reasoning + tool calling) and flip the constant the moment 5.4 lands. No app code changes needed beyond that one string.
- True person-segmentation for "text behind the speaker" still uses CSS blend-mode + vignette as a fake-depth treatment. Real matting (MediaPipe Selfie Segmentation in-browser, or a Replicate matting model) is a follow-up if you want a true cutout.
- Raw audio-as-input to the director is deferred — transcript + timestamps deliver 95% of the value at a fraction of the cost.
