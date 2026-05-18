# Video Repo — Option D + Duration & Script Fixes

Two things to ship together:
1. **Option D** — tabbed workspace so each step has the whole canvas
2. **Three prompt/preview fixes** — duration is now respected, script fills the whole clip with continuous talking, and the preview is readable

---

## 1. Tabbed workspace (Option D)

Replace the current left-composer / right-chat split with one full-width column and three top tabs:

- **Compose** — prompt, attachments (thumbnails), settings popover (duration / format / bulk / lock / use-my-script), Generate
- **Review Script** — large editable script card, word counter, "Approve & Generate Video" / "Rewrite" / "Cancel"
- **Results** — generated video(s) + iterate composer

Cross-tab behavior:
- After Generate succeeds in creating a script → auto-switch to **Review Script** and badge the tab "1"
- After Approve → auto-switch to **Results**, show progress and the final video(s)
- Settings (duration / format / bulk / lock / use-my-script) collapse into a single `⚙ Settings` popover to declutter Compose
- Rewrite/Enhance/Auto become one split-button (`Enhance ▾`)
- Tabs stay visible while generation runs; the active tab keeps a spinner in the badge

Mobile + 832px viewport: tabs stack horizontally as pill buttons; everything is single-column.

---

## 2. Duration is now respected (10s vs 20s)

**Current problem:** prompt reserves 3s silence at the start AND 3s at the end, so a 10s clip only allows ~7 spoken words → model produces one short line that doesn't feel like 10 seconds.

**Fix in `src/pages/VideoRepo.tsx`:**
- Change word cap from `(duration - 6) × 1.7` to **`(duration - 1) × 2.5`** → 22 words at 10s, ~47 words at 20s
- Replace the "ONE tight sentence for ≤10s" rule with: "The actor speaks **continuously** from ~0.5s to ~(duration − 0.5)s. No 3s silent buffers. The voiceover must fill the clip."
- Add an explicit duration banner at the top of the system instruction: `🎯 TARGET DURATION: ${duration}s — every timed beat, the ACTION MANIFEST, and the SHOT STRUCTURE must sum to exactly this number. Do NOT write a script that finishes early.`
- Apply the same updated cap + "speak continuously" rule to: the main `analyzeAndGenerate` prompt, the auditor pass (line 838), and the Rewrite/Enhance prompt (line 1865)
- Auditor pass already verifies word count — update its threshold to the new formula and add a "speaks continuously" check

**Truncation guard:** the auditor result sometimes gets cut off. Add `max_tokens: 4096` to the auditor edge-function call and detect `finish_reason === 'length'` — if so, surface a "Script may be truncated, regenerate" warning in the preview card instead of silently approving.

---

## 3. Script preview is readable

Today the preview is a single 220px mono `Textarea` showing the raw 200+ word Sora prompt — hard to scan and visibly cut off.

**Redesign the Script Preview card:**

- **Two stacked sections, each collapsible:**
  1. **🎤 Spoken Script** — extracted from the `AUDIO:` block, rendered as plain readable prose with quote marks, large font (`text-sm leading-relaxed`), editable inline. This is what the actor will say.
  2. **🎬 Full Sora Prompt** — the complete directive in a `min-h-[400px]` auto-resizing textarea, mono font, with a "Copy" button. Collapsed by default (open with chevron) so the spoken script is the focus.
- **Stats row** above:
  - Duration badge (10s / 20s)
  - Spoken word count `vs` cap, colored green/amber/red (`live`, updates as user edits)
  - Estimated speaking time (`words ÷ 2.5 wps`) so the user can see "9.2s of speech in a 10s clip" at a glance
  - Truncation warning chip if `finish_reason === 'length'`
- **Resizable**: the prompt textarea uses `resize-y` so the user can drag it open
- **Section parser** to split the prompt into named blocks (Reference Analysis, Scene Script, Action Manifest, Camera, Audio, Final Video Prompt) and show them as a checklist of "what's included" — helps spot when something is missing

---

## Files to change

- `src/pages/VideoRepo.tsx`
  - Replace 2-column layout with tabbed `<Tabs>` shell using existing shadcn `Tabs`
  - Move settings into a `<Popover>` triggered by a `⚙` button
  - Update the system prompt + auditor + enhance prompt with new duration rules
  - Rewrite the `scriptPreview` render block (around line 2670) into the new card with spoken script + collapsible full prompt + live counters
  - Add a small helper `extractSpokenLines(prompt)` that pulls quoted text from the `AUDIO:` block
- No backend / migration changes
- Memory: add a project memory note `Continuous-speech pacing — Sora clips speak from ~0.5s to (duration − 0.5)s, ~2.5 wps, no 3s silence buffers.` so the rule survives future rewrites

---

## Out of scope (ask if you want any of these too)

- Saving multiple script drafts side-by-side for A/B comparison
- A "Read script aloud" preview button that runs the spoken text through TTS so you can hear pacing before approving
- Auto-snap word count by re-running the auditor when the user edits past the cap

Approve this plan and I'll implement it as one pass.
