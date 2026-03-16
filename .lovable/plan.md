

## Plan: Embed Winning Commercial Case Studies into Loop AI's Training Prompt

**Goal**: Inject the Dollar Shave Club and Old Spice strategic breakdowns directly into the system prompt as reference examples, so Loop AI learns from proven winners and applies those patterns when creating commercials.

### What Changes

**1. Add "Case Study Library" section to the system prompt** (`supabase/functions/generate-commercial-strategy/index.ts`)

Insert a new `## 🏆 WINNING COMMERCIAL CASE STUDIES` section into `buildSystemPrompt()` (after the Golden Rules, before the segment context). This section includes:

- **Dollar Shave Club** — Pattern-interrupt hook via directness + humor, PAS through calling out overpriced razors → absurd features → simple $1/month solution, single authentic founder as consistent character, warehouse walk-through as continuous B-roll, benefit-driven CTA
- **Old Spice** — Fourth-wall-breaking hook addressing the *purchaser* (not the user), aspirational PAS (your man isn't this → but he could smell like this), seamless scene transitions as visual velocity, implicit CTA via memorable punchline

Each case study is distilled into ~8-10 lines covering: Hook technique, PAS execution, Emotional lever, Pacing style, CTA approach, and a **"Apply This When..."** directive telling Loop AI when to use each pattern.

**2. Add "Strategic Patterns" reference table**

A concise lookup that maps common commercial types to the best-fit case study pattern:

- **Disruptor/startup product** → Dollar Shave Club pattern (humor + directness + price comparison)
- **Brand revitalization / aspirational** → Old Spice pattern (fourth-wall break + aspiration + absurdist pacing)
- **Tech/productivity SaaS** → Hybrid (DSC directness + Old Spice visual velocity)
- **Luxury/lifestyle** → Old Spice emotional aspiration + cinematic slow reveals

**3. Reinforce in the JSON generation instructions**

Add a line in the storyboard JSON section: "Before generating, identify which winning pattern (DSC-disruptor, OldSpice-aspirational, or hybrid) best fits this product and audience, then apply that pattern's hook style, PAS cadence, and CTA approach."

### Files Modified
- `supabase/functions/generate-commercial-strategy/index.ts` — add ~60 lines to system prompt with case studies + pattern matching directive

### What This Achieves
Loop AI will reference real-world proven strategies when building storyboards, producing commercials that mirror the structural and emotional techniques of billion-dollar campaigns rather than generic template output.

