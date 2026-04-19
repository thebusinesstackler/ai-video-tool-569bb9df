
## Plan: Make Marco a true creative director

The user wants Marco to think like a hybrid editor + motion designer + strategist + brand-aware storyteller. Most of the infrastructure exists (treatments, intents, placements, B-roll auto, animated graphics, platform aspect, brand context). What's missing is the **director-level prompt + a few visual-intelligence behaviors**.

### What I'll change

**1. Rewrite Marco's system prompt in `supabase/functions/chatcut-director/index.ts`**
Replace the current persona block with a director brief that codifies the user's spec:
- Core objective: every cut/graphic/b-roll must serve retention, clarity, engagement, visualization, polish, or platform-fit.
- Five-lens thinking (editor → motion designer → strategist → social marketer → brand storyteller).
- Pre-action checklist before placing graphics: "is there room beside the subject? should text go behind? should the actor shrink/mask? full-screen takeover? b-roll replacement?"
- Motion graphics: only add when the line needs emphasis/visualization/pattern-interrupt — otherwise default to "clarity over complexity" (cleaner on-screen text, full-screen card, b-roll + overlay, punch-in + caption).
- B-roll matching matrix (product demo / website scroll / UI walkthrough / lifestyle / problem-solution / abstract mood / social proof / feature illustration / environment / close-up detail) — Marco picks the closest category for the spoken line.
- Platform reframing: re-compose, never blind-crop. Keep faces/products/CTAs inside safe zones.

**2. Inject brand context into every Marco call**
Read the user's brand guidelines + product context (already stored — used by other generators) and prepend a "Brand Brief" block: tone, palette, typography mood, audience, offer, recurring phrases, premium/playful/medical/direct-response feel. This makes captions, motion graphic copy, and b-roll choices brand-consistent.

**3. Add a pre-flight "frame inspection" pass for graphics**
Before Marco emits an `add_motion_graphic` / `add_animated_graphic`, the prompt forces him to first declare (in his internal reasoning) where the speaker is and what the empty space looks like. Then choose `placement` + `subjectAction` from that. The director output stays the same shape — just better-grounded decisions.

**4. New action: `add_punch_in`**
Cheap, high-impact tool that zooms in on the speaker for a beat (no extra render cost). Marco uses this as the "clarity over complexity" fallback when motion graphics would feel forced. Implemented in `ChatcutAI.tsx` as a transform on the main video preview for the duration window.

**5. B-roll relevance scoring**
In `chatcut-director`, when Marco picks a saved Source Clip he must include a `matchType: 'literal' | 'metaphor' | 'mood'` field. If `mood` and the clip is older than 1 use, prefer generating fresh instead. This kills the "least-bad reuse" pattern.

### Files to edit
1. `supabase/functions/chatcut-director/index.ts` — new director system prompt (sections: Core Objective, Five Lenses, Visual Intelligence checklist, Motion Graphics Logic, B-Roll Matrix, Platform Reframing); accept brand context payload; require `matchType` on B-roll picks.
2. `src/pages/ChatcutAI.tsx` — pass brand context (from existing brand store) into every `chatcut-director` invoke; handle new `add_punch_in` action with a CSS transform on the preview video for the time window.
3. `src/components/chatcut/SmartOverlay.tsx` — no major changes; small tweak so `placement: 'behind_subject'` actually renders behind the video element (z-index swap) for masked text behind speaker.
4. `.lovable/memory/features/ai-tools/chatcut-director-creative-brief.md` — new memory documenting the director-level prompt + brand-context injection + punch-in action.

### Out of scope
- True person-segmentation matting for "text behind subject" (we fake it with mix-blend-mode + radial vignette as already implemented).
- Auto-extraction of brand tone from a fresh URL inside Chatcut (uses the brand context already saved in Settings; if none exists, Marco asks once and caches in the session).
- Per-frame computer-vision inspection (Marco reasons from the transcript + current overlay layout, not pixel analysis).
