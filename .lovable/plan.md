## Goal

Turn `/movie-scene-creator` into a true end-to-end AI movie pipeline: **Idea → Story Bible → Storyboard → Director Review (Claude as 39-year veteran) → Locked character keyframes → Continuous scene-to-scene video → Stitched film.** Today the building blocks exist but they are weakened by no real review gate, soft character consistency, no visual chain from one scene's end frame to the next scene's start frame, no transition prompting between clips, and no senior creative pass before the expensive video render.

## What to build

### 1. Storyboard Review Gate (new step, before any video renders)
- After scenes + start/end frames are generated, route the user into a new **Storyboard tab** that shows every scene as a 2-up card: **start frame | end frame**, with dialogue, characters present, location, mood, and camera notes underneath.
- Per-scene buttons: **Regenerate start**, **Regenerate end**, **Edit dialogue**, **Approve scene**.
- Master bar: progress (`12 / 18 scenes approved`), **Approve all**, then a single **Render movie** button, disabled until the Director Review (step 2) has run and ≥80% of scenes are approved.

### 2. AI Director Review Pass (Claude Sonnet 4.5, "39-year veteran director")
A new dedicated pass that runs once the storyboard exists, before any video render. This is the senior creative gate.

- New edge function `movie-director-review` that calls **Claude Sonnet 4.5** (already in project via `_shared/claude.ts`) in **multimodal mode** with:
  - The full Story Bible (logline, theme, 3-act structure, characters, arcs, wardrobe).
  - Every scene's start frame + end frame image URLs, dialogue, location, time of day, mood, camera angle, transition action.
- System prompt persona:  
  *"You are a 39-year veteran film director (think Spielberg / Villeneuve / Fincher pedigree). You are auditing this storyboard before we spend money on video generation. Your job is to make this feel like a real film, not AI slop."*
- Returns structured JSON via Claude tool-use:
  ```
  {
    overallVerdict: "ship" | "revise" | "block",
    overallScore: 1-10,
    storyNotes: string,        // pacing, arc, theme cohesion
    continuityIssues: [{ sceneNumber, issue, fix }],   // wardrobe, location, time-of-day, prop drift
    castingNotes: [{ characterName, issue, fix }],     // face/age/wardrobe consistency across frames
    sceneNotes: [{
      sceneNumber,
      score: 1-10,
      strengthens: string,
      weakens: string,
      recommendedKeyframeRewrite?: { startFrame?: string, endFrame?: string },
      recommendedDialogueRewrite?: string,
      recommendedCameraMove?: string,
      recommendedTransitionToNext?: string
    }],
    finalShootingOrder?: number[]   // optional re-ordering for emotional rhythm
  }
  ```
- UI: a new **Director's Notes** panel above the storyboard. Each scene card surfaces its own director note inline with a one-click **Apply director's fix** button per recommendation (auto-rewrites the keyframe prompt, dialogue, transition, or triggers a regenerate of just that frame).
- A top-level **"Re-review storyboard"** button re-runs the pass after fixes.
- Optional **Auto-apply all safe fixes** (dialogue + transition + keyframe prompt rewrites; never auto-deletes scenes) before render.

### 3. Character Identity Lock (applied to every keyframe + video prompt)
- New helper `buildCharacterLockBlock(storyBible, charactersInScene)` emitting:  
  `CHARACTER LOCK — {name}: {age}, {appearance}, wardrobe: {wardrobe}. Same face, same outfit, same hair across every shot.`
- Inject into `generate-scene-image` (start, end, regenerate) and `wavespeed-video` prompts in `generateVideoForScene` and the one-click loop.
- For characters with an assigned AI Twin, also pass the twin's first reference image as `imageUrls[0]` so Nano Banana / Wan keep the face.

### 4. End-frame → Next-start-frame visual chain (continuity)
- When `autoLinkScenes` is on and the previous scene has an `endFrame.generatedImage`, generating scene N's **start frame** calls `edit-scene-image` with the previous end frame as the source image and a prompt like *"Continue this exact moment. Same character, same wardrobe, same lighting. Now: {scene N start description}."* instead of fresh text-to-image.
- The current "copy previous end image into next start" (line ~2468) becomes a fallback only when the user opts out of regeneration.

### 5. Transition prompts between scenes (match-cut continuity)
- Use the existing `transitionAction` field (line 167, currently unused for video). When generating scene N's video, append:  
  `TRANSITION OUT: {transitionAction or "match-cut to next setting"}; final frame should mirror composition of scene N+1 opening.`
- Generate `transitionAction` once during scene generation by extending `generate-movie-outline`.

### 6. Dialogue → voice → lip-sync wiring (finish the half-built path)
- Scenes with a dialogue line and an assigned twin auto-trigger TTS via `gpt-4o-mini-tts`, then route the keyframe + audio through `wavespeed-ai/infinitetalk-hd` for foreground shots (close-up / medium). Wide shots stay on Wan/Sora silent + audio stitched at the end.
- Reuse the project's voice-locking hash so the same character keeps the same voice across all scenes.

### 7. One-click "Generate Movie" rewired
- The existing one-click flow (line 1478) is kept, but now stops at: **Storyboard → Director Review → user approval → Render**. Easy/Beginner mode auto-accepts the director's safe fixes and proceeds; Pro mode requires explicit approval.

## Order the user experiences it

```
Idea
  → Outline
  → Story Bible
  → Scenes + Start/End Frames (with Character Lock + End→Start chaining)
  → Storyboard Review Board
  → 🎬 AI Director Review (Claude, 39-yr veteran)
       → Director's Notes + per-scene fixes
       → Apply fixes / regenerate frames
  → Approve scenes
  → Render videos (with transition prompts + lip-sync)
  → Auto-stitch into final film
```

## Technical notes

- New edge function: `supabase/functions/movie-director-review/index.ts` — uses `_shared/claude.ts`, model `claude-sonnet-4-5`, multimodal (image + text), tool-use for structured JSON, `verify_jwt` via `getClaims` per project Edge Function Auth pattern. Falls back to `claude-3-5-sonnet` on 402/404.
- Edge functions touched: `generate-movie-outline` (add `transitionAction`), `generate-scene-image` (accept `characterLock` + `referenceImageUrl`).
- New components: `src/components/movie/StoryboardReviewBoard.tsx`, `src/components/movie/SceneApprovalCard.tsx`, `src/components/movie/DirectorNotesPanel.tsx`.
- New helper: `src/lib/movieCharacterLock.ts`.
- DB: extend the `scenes` JSON in `movie_projects` with `approved: boolean` and `directorNote` per scene, plus a top-level `directorReview` blob — stored inside the existing JSON columns, no migration required.
- Honors project memory: cinematic ≤180s per shot, voice via `gpt-4o-mini-tts`, lip-sync via `infinitetalk-hd`, never `avatar-omni-human-1.5`, end-frame chaining uses `google/gemini-3.1-flash-image-preview` (Nano Banana 2), Claude reasoning matches the existing premium-visual + scene-analysis patterns.

## Out of scope (not changing now)

- Sound design / music bed beyond `suggestedMusic` already present.
- Multi-language dubbing.
- The Story Bible editor UI itself (already exists).
