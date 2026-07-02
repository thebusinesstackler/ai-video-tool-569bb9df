# Reels.tsx Decomposition Playbook
### From 8,398 lines / 121 useState → a feature module no file of which exceeds 400 lines

This playbook is written to be executed **inside Lovable, one prompt at a time**, because the #1 way refactors like this fail is asking an AI (or a human) to do it in one shot. Each phase below is independently shippable — the app works after every step, so you can stop anywhere and nothing is broken.

---

## The target architecture

```
src/features/reels/
├── reelStore.ts              ← provided (Zustand, 6 state slices)
├── useReelGeneration.ts      ← provided (all generate* side effects)
├── useReelLibrary.ts         ← saved/draft CRUD (load, save, delete, autosave)
├── ReelsPage.tsx             ← ~150 lines: layout + tab switching ONLY
├── create/
│   ├── BriefPanel.tsx        ← topic, mode, scene count/duration, podcast toggle
│   ├── HookPicker.tsx        ← hook generation + selection dialog
│   ├── CastPanel.tsx         ← character / twin / portrait / lip-sync
│   ├── AudioPanel.tsx        ← voice, pitch, upload, music
│   ├── IntroOutroPanel.tsx   ← templates + text
│   └── GenerateBar.tsx       ← the button + CostBadge + progress
├── output/
│   ├── SceneQueue.tsx        ← scene cards w/ per-scene status & retry
│   ├── SceneCard.tsx
│   ├── FinalVideoPanel.tsx   ← player, download, captions, send-to-ChatCut
│   └── TimelineView.tsx      ← wraps existing ReelSceneTimeline
└── library/
    ├── ReelLibrary.tsx       ← saved reels grid
    └── DraftList.tsx
```

Three laws that make this stick:

1. **Components never call `supabase` directly.** They call hooks. (Right now Reels.tsx has DB calls interleaved with JSX at 40+ places.)
2. **Components never hold business state.** They read the store slice they render and call its setter. `useState` is allowed only for truly local things (an input's draft text, a hover).
3. **The pipeline is data, not control flow.** `phase: idle → scripting → rendering_scenes → stitching → done|failed` in the store replaces the tangle of `isGenerating`/`progress`/`progressStatus`/`isManualStitching`/`videoError` booleans. Every UI element derives from `phase`.

Why Zustand over Context+useReducer: with 121 states in one component, **every keystroke in the topic field currently re-renders the entire 8,398-line tree** — that's the sluggishness you feel. Zustand subscriptions are per-slice, so `BriefPanel` re-renders on typing and nothing else does. It's a 2kb dependency: `npm i zustand`.

---

## Phase 0 — Safety net (do this first, 10 min)

Before touching anything, capture current behavior so you can verify nothing broke. You already have Playwright installed (`@playwright/test` is in package.json — currently unused). Prompt for Lovable:

> Create a Playwright smoke test at `tests/reels.spec.ts` that: logs in with a test account, navigates to /reels, verifies the topic input, scene-count selector, and Generate button render, types a topic, and verifies the button becomes enabled. Do not modify any application code.

Run it green. This is your tripwire for every phase below.

## Phase 1 — Move state (no visual changes)

**Prompt 1:**
> Install zustand. Create `src/features/reels/reelStore.ts` with this exact content: [paste reelStore.ts]. Do not modify Reels.tsx yet.

**Prompt 2 (repeat per slice — brief, cast, audio, pipeline, library, ui):**
> In `src/pages/Reels.tsx`, replace ONLY the following useState hooks with the reel store: `topic`, `selectedSceneCount`, `selectedSceneDuration`, `isPodcastMode`, `podcastDuration`, `hookStyle`, `selectedHook`, `transitionStyle`, intro/outro states. Read them via `useReelStore` and write via `setBrief`. Change nothing else — no JSX changes, no logic changes, no renames. The page must look and behave identically.

Doing this one slice per prompt keeps each diff reviewable and keeps Lovable from "helpfully" rewriting things you didn't ask about. Six prompts, ~100 of the 121 states migrated.

## Phase 2 — Move side effects

**Prompt 3:**
> Create `src/features/reels/useReelGeneration.ts` with this exact content: [paste useReelGeneration.ts]. Then in Reels.tsx, delete the local `generateScripts`, `generateVideo`, `generateAll`, `generateQuickMode`, and `generateQuickModeTest` functions and replace their call sites with `generateReel` / `generateScript` / `retryScene` from the hook. Keep `generateBackgroundMusic`, `generateHookOptions`, `generateCharacter`, and `generateThumbnail` where they are for now.

**Prompt 4:**
> Create `src/features/reels/useReelLibrary.ts`. Move all Supabase reads/writes for saved reels and drafts out of Reels.tsx into it: loading saved reels, loading drafts, saveReel, saveDraft, deleteReel, and the autosave currently in useReelDraftAutoSave. Expose `{ savedReels, draftReels, loadingLibrary, saveReel, saveDraft, deleteReel }`. Update Reels.tsx to consume the hook. No UI changes.

## Phase 3 — Extract components (one per prompt)

Order matters — extract leaves first, layout last. Template prompt:

> From `src/pages/Reels.tsx`, extract the [SECTION] into `src/features/reels/create/[Name].tsx`. The component must take zero props for business data — it reads the reel store and hooks directly. Only presentation props (className) are allowed. Move any JSX helpers used only by this section into the new file. Reels.tsx must shrink by the extracted lines; behavior identical.

Run it for, in order: `SceneCard` → `SceneQueue` → `FinalVideoPanel` → `BriefPanel` → `HookPicker` → `CastPanel` → `AudioPanel` → `IntroOutroPanel` → `GenerateBar` → `ReelLibrary` → `DraftList`.

**Final prompt:**
> Rename what remains of `src/pages/Reels.tsx` to a thin `src/features/reels/ReelsPage.tsx` that only composes the extracted components in the existing layout with the existing tab logic. Re-export it from `src/pages/Reels.tsx` so the route in App.tsx doesn't change. The file must be under 200 lines.

## Phase 4 — The payoff features (now trivially easy)

These were near-impossible in the monolith and become one-prompt features in the new structure:

- **Per-scene retry** — already wired in `useReelGeneration.retryScene`; just add a "Retry" button to failed `SceneCard`s. No more "one scene failed so regenerate everything" (and with the credit system, retrying one scene costs one scene).
- **Resumable pipeline** — persist `phase` + `scenes` to the draft row on every `updateScene`; on page load, if a draft has `phase: rendering_scenes`, offer "Resume where you left off." Users lose generations to tab closes today.
- **The paywall moment** — `useReelGeneration` dispatches `open-paywall` on a 402; mount one global `<PaywallDialog>` in Layout.tsx that shows the plan grid from BillingSettings. Insufficient credits becomes your best-converting screen instead of a dead error.
- **Reels Pro merge** — with brief/cast/audio as independent panels, "Pro" becomes a mode flag that reveals extra panels, not a separate 3,000-line page. Delete ReelsPro.tsx, redirect the route.

## What good looks like when you're done

`git diff --stat` should show Reels.tsx down from 8,398 lines to a ~15-line re-export, ~16 new files each under 400 lines, typing in any input re-renders only its panel (verify with React DevTools' highlight-updates), the Playwright smoke test still green, and — the real test — the next feature you ask Lovable to add lands in one file instead of rippling through eight thousand lines.

Then repeat the identical playbook for ChatcutAI.tsx (6,938 lines) and MovieSceneCreator.tsx (5,681). The store slices differ; the method doesn't.
