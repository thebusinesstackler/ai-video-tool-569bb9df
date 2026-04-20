

## Add Google Flow (Veo 3) to Video Repo Pro

Bring Google Flow-style filmmaking to `/video-repo-pro` with a model picker for any new video AND a multi-shot "Flow Mode" that chains multiple Veo 3 clips into one long, consistent video — all with native Veo 3 audio + dialogue.

### What you'll see in the UI

On the Video Repo Pro create form, add a new **Engine** section above the Generate button:

```text
┌─ Engine ────────────────────────────────┐
│  ◯ Sora-2 (default)  ◉ Veo 3  ◯ Wan 2.5 │
│                                          │
│  [✓] Flow Mode (multi-shot)              │
│      Shots: [ 3 ]  Total: ~24s           │
│      Auto-stitch into one video          │
└──────────────────────────────────────────┘
```

- **Single Veo 3 shot**: 8s clip, native audio + dialogue (uses the rewriter we just built).
- **Flow Mode**: 2-6 shots × 8s each, character/setting locked across shots, auto-stitched into one final video saved to history.

### How Flow Mode works

1. **Script breakdown** — your script gets split into N beats (one per shot) by Lovable AI, each beat ≤ ~20 spoken words.
2. **Consistency lock** — a single "Character & Setting Bible" (wardrobe, location, lighting, voice tone) is generated once and prepended to every shot prompt so the actor and environment stay identical.
3. **Sequential generation** — N Veo 3 calls run in parallel via `wavespeed-video` (`google/veo3`), each with its own dialogue line + native audio.
4. **Auto-stitch** — when all clips finish, `creatomate-stitch` concatenates them into one MP4 and saves to `video_repo_projects` (with `segment_urls` populated so you can still re-roll any single shot).
5. **History card** — labelled `Veo 3 · Flow · 3 shots` with a small badge so you can spot Flow videos at a glance.

### Files to change

- `src/pages/VideoRepoPro.tsx` — add `<EngineSelector>` UI, `flowMode` + `flowShots` state, branch `generateVideo` into single-shot vs Flow Mode loop, save engine + `flow_mode` to DB.
- `src/components/VideoRepoEngineSelector.tsx` — new small component (radio + Flow toggle + shot count slider).
- `supabase/functions/generate-flow-bible/index.ts` — new edge function: takes script + N, returns `{ bible: {...}, shots: [{ prompt, dialogue }] }` using Lovable AI (gemini-3-flash-preview).
- `supabase/migrations/...` — add `engine TEXT` and `flow_mode BOOLEAN` columns to `video_repo_projects` for the badge + filtering.
- `.lovable/memory/features/video-repo/google-flow-mode.md` — log the feature.

### Technical notes

- All Veo 3 calls reuse the existing `wavespeed-video` edge function with `model: 'google/veo3'`, 8s, native audio always on (per your choice).
- The VEO3 prompt rewriter from the last change is reused per shot, but seeded with the shared Bible so dialogue + look stay consistent.
- Stitching reuses `creatomate-stitch` (no new infra). Background tasks tracked via `BackgroundVideoContext` so Flow runs survive page navigation.
- Cost guardrail: Flow Mode capped at 6 shots (48s) with a visible `~$X.XX` estimate before you hit Generate.

