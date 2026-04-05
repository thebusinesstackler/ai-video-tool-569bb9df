

## Plan: Fix Remake/New Version Auto-Trigger + Clarify AI Analysis Labels

### Problems Identified

1. **"Project loaded" but nothing happens**: `remakeWithEdits` loads assets into the Create tab and shows a toast, but the user must manually type a prompt and send it. "New Version" does the exact same thing as "Remake" — neither auto-triggers the analysis.

2. **AI Analysis labeling is misleading**: The "AI Analysis" card shows the AI's script proposal (video prompts + narration), not an actual analysis of the reference or generated video. For failed projects, it shows what was *planned* to be created, which is confusing.

---

### Changes

#### 1. Auto-trigger analysis on Remake / New Version
**File:** `src/pages/VideoRepoPro.tsx`

- After `remakeWithEdits` loads assets and switches to the Create tab, auto-trigger the `handleSendMessage` flow (or a dedicated re-analysis function) so the AI immediately starts analyzing the reference video and generating a new script.
- Differentiate "Remake" (loads into Create tab for manual editing) from "New Version" (loads AND auto-triggers fresh analysis with existing prompt).
- For "New Version": set a flag like `autoTriggerAnalysis` that a `useEffect` picks up once the Create tab is active, then calls the analysis with the loaded reference video + product image + original prompt.

#### 2. Separate and clarify analysis labels in the detail view
**File:** `src/pages/VideoRepoPro.tsx`

- Rename the current "AI Analysis" card to **"AI Script Director"** — because it contains the two-segment video prompts and narration, not a video analysis.
- Add a clear label: "This is the script that was generated for production" (or "planned for production" if status is failed).
- For the **reference video**: label the prompt card as **"Your Prompt"** (already exists) — no change needed.
- For the **Video Script & Narration** card: keep as-is, this shows `video_prompt` which is the final production script.

#### 3. Add "Re-Analyze" button for failed projects
**File:** `src/pages/VideoRepoPro.tsx`

- On failed projects, show a **"Re-Analyze Video"** button in the detail view that re-runs analysis on the existing reference assets without needing to go back to the Create tab.

---

### Files to modify
1. **`src/pages/VideoRepoPro.tsx`** — All three changes above

### Technical detail
- The auto-trigger will use a `useEffect` watching a `pendingAutoAnalysis` ref/state. When set (by "New Version"), and the Create tab is active with loaded assets, it calls `handleSendMessage` with the original prompt.
- The "Remake" button keeps current behavior (manual editing).
- The "New Version" button sets the auto-trigger flag after loading assets.

