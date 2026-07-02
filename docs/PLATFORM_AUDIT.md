# VideoAIPro.studio — Full Platform Audit & Redesign Plan

**Reviewed:** entire GitHub repo (`ai-video-tool-569bb9df`) — 31 pages, ~47,000 lines of page code, 76 Supabase edge functions, 71 database migrations, navigation, AI prompts, security config, and monetization surface.

**Verdict in one sentence:** you have an impressively broad feature set built on a real pipeline (WaveSpeed for generation, Creatomate for stitching, Vizard for clipping, Lovable AI Gateway for intelligence) — but the platform is currently **a demo that spends your money for free**, wrapped in **too many overlapping tools**, held together by **three unmaintainable mega-files**. The path to "worth millions" is not more features. It is: meter it, consolidate it, harden it, then polish it.

---

## PART 1 — CRITICAL FINDINGS (ranked by business risk)

### 🔴 P0-1: There is no credit system. At all.

This is the most important finding in the entire audit. The sidebar in your screenshot says "FREE PLAN — 0/600 credits — Upgrade," but in the repo:

- There is **no `credits` table** in any of the 71 migrations. No `subscriptions` table. No `usage_ledger` table.
- There is **no Stripe integration** anywhere — not in `package.json`, not in the edge functions, not in the frontend.
- There is **no deduction logic**. `wavespeed-video/index.ts` (the function that spends real money on every call) contains zero per-user metering. The only "credits" it knows about are *your own WaveSpeed account credits* — and when those run out, it tells your end users: *"Insufficient WaveSpeed credits. Please top up your account at wavespeed.ai."* Your users see your vendor's name and are told to go pay your vendor. This leaks your infrastructure and destroys trust in one error message.
- The "Upgrade" button leads nowhere that can take money.

**Consequence:** every signed-up user has unlimited free access to endpoints that cost you real dollars per call (video generation, image generation, TTS, Vizard clipping, Creatomate renders). One user with a script could drain your WaveSpeed and Lovable balances in an afternoon. You cannot launch, market, or sell this product until this exists.

**Fix:** I've built you a complete, production-ready credit system in the `credit-system/` folder next to this document — SQL migration (ledger-based, race-condition-safe, RLS-protected), a drop-in edge function middleware (`requireCredits()`), a React hook, and a premium sidebar credit meter component. Details in Part 3.

### 🔴 P0-2: An open, unauthenticated endpoint is burning your AI budget

`generate-content-strategy` has `verify_jwt = false` in `supabase/config.toml` **and** performs no auth check inside the function. Anyone on the internet who finds the URL can call it in a loop and spend your Lovable AI credits. `wavespeed-webhook` being open is correct (webhooks must be), but it should verify a signature/secret from WaveSpeed — right now anyone who guesses the URL can inject fake "completed" video results into your users' projects.

**Fix:** set `verify_jwt = true` on `generate-content-strategy` (or add an in-function `getUser()` check), and add a shared-secret check to both webhooks (`wavespeed-webhook`, `vizard-webhook`).

### 🔴 P0-3: Your GitHub repo is not your production app

The deployed site in your screenshot shows "Super Computer" in the nav and a credits widget. **Neither exists in this repo.** That means Lovable's live project and GitHub have drifted apart. This is dangerous: you can't audit, back up, or hand off code you can't see, and any engineer (or AI) you ask to improve the platform is working on stale code. Re-sync GitHub from Lovable before doing anything else, and turn on automatic sync.

### 🟠 P1-1: Three files are unmaintainable monoliths

- `Reels.tsx` — **8,398 lines**, 121 `useState` hooks in one component
- `ChatcutAI.tsx` — **6,938 lines**
- `MovieSceneCreator.tsx` — **5,681 lines**

This is why features feel buggy and why every change breaks something else. A component with 121 pieces of independent state cannot be reasoned about, re-renders constantly (slow UI), and can't be tested. Nothing in the "premium polish" bucket will stick until these are decomposed.

**Fix pattern (apply to all three):** extract each visual section into its own component under `src/features/reels/`, move all generation state into a single `useReducer` or a small Zustand store per feature, and move every Supabase call into custom hooks (`useReelGeneration`, `useSceneQueue`). Target: no file over 400 lines. This is 2–3 focused days per page in Lovable if you instruct it section by section ("Extract the scene timeline from Reels.tsx into src/features/reels/SceneTimeline.tsx with a props interface, no behavior change") rather than asking for a big-bang rewrite.

### 🟠 P1-2: Feature sprawl is your biggest competitive weakness

You have **31 routed pages** and your nav lists ~20 tools, most tagged "Beta." Count the overlap:

| What the user wants | Tools that claim to do it |
|---|---|
| Short-form social video | Reels & Stories, Reels & Stories Pro, Lifestyle Stories, Video Repo, Video Repo Pro |
| Clip a long video | ChatCut AI, Vizard, AI Video Repurposer |
| Talking person on camera | Podcast Talking Head, AI Spokesperson, AI Twins, Testimonial Ads |

Higgsfield, Runway, and OpusClip win because a new user knows exactly what to click in 5 seconds. On your platform, a new user faces five nearly-identical short-form tools and can't tell Repo from Repo Pro from Reels Pro. "Pro" as a tool suffix is especially confusing — users read it as a *pricing tier*, not a different tool.

**Fix — consolidate to 6 flagship products:**

1. **Create** (merge Reels, Reels Pro, Lifestyle Stories, Video Repo, Video Repo Pro) — one entry point, with a template/mode picker inside: *Faceless Reel · Lifestyle Story · Product Ad · UGC Style*. Advanced options revealed progressively, not as separate products.
2. **Cinema Studio** (Movie Scene Creator + Movies + Super Computer) — the Higgsfield competitor. One cinematic pipeline: concept → script → storyboard frames → shots → final video.
3. **Presenter** (AI Spokesperson + Podcast Talking Head + Testimonial Ads + AI Twins as the avatar source) — the HeyGen competitor. Pick/clone an avatar → script → voice → scene → render.
4. **ChatCut** (ChatCut AI + Repurposer + Vizard, merged) — the OpusClip/Captions competitor. Upload once; the agent cuts, captions, clips, and reformats.
5. **Assets** (Characters, Products, B-Roll, Voices, Gallery, Hooks) — one library with tabs, not six nav items.
6. **Animate** (Animate Statics) — keep as a utility.

This one change does more for "premium feel" than any amount of CSS. The old URLs should 301-redirect into the new tools (you already do this pattern for `/videos` → `/reels` — extend it).

### 🟠 P1-3: The model powering "cinematic intelligence" is a budget model

`_shared/claude.ts` is named Claude but actually routes everything to `google/gemini-2.5-flash` via the Lovable gateway. Flash is fine for captions and metadata; it is a quality ceiling for the things you're selling as premium — cinematic scene direction, movie outlines, ChatCut's editing judgment. Meanwhile `chatcut-director` requests Claude-style `thinking` parameters against a Gemini model and sends its system prompt as a `user` role message — both are silent quality bugs.

**Fix:** route by task tier. Cheap/fast (captions, hooks, hashtags) → keep flash. Creative direction (movie scenes, ChatCut director, Super Computer, spokesperson scripts) → `google/gemini-2.5-pro` or `anthropic/claude-sonnet-4-5` through the same gateway. Fix the system-role bug in `chatcut-director`. Also fix the mojibake in that prompt ("Marco â", "ð") — the file was saved with broken encoding, and those bytes are literally being sent to the model.

### 🟡 P1-4: Mobile is effectively unsupported

ChatCutAI has 17 responsive utility classes across 6,938 lines; Reels has 27 across 8,398. These pages will be broken on phones — for a *short-form social video* product whose users live on their phones. After consolidation (P1-2), make the Create flow and library genuinely mobile-first; it's acceptable for ChatCut's timeline to be desktop-only, but it should show a graceful "open on desktop" screen on mobile rather than a broken layout.

### 🟡 P1-5: Committed `.env` and CORS wildcards

`.env` is committed to the repo. The values in it are the Supabase anon key (designed to be public), so this is not a leak today — but the pattern is how a real secret eventually gets committed. Add `.env` to `.gitignore`. All 76 functions use `Access-Control-Allow-Origin: *`; lock this to `https://videoaipro.studio` (plus your Lovable preview domain) before launch.

---

## PART 2 — FEATURE-BY-FEATURE REVIEW

### 1. Super Computer
Not in the repo (see P0-3), so I can only judge from the screenshot and its position in nav. Recommendation regardless: don't make it another standalone generator. Make it the **conversational front door to Cinema Studio** — a Higgsfield-style flow where the user types an idea and the system responds with a visual concept board (style frames, camera language, palette, 3 scene thumbnails) and a single "Generate this" action. The magic of Higgsfield is *camera control presets* (crash zoom, dolly-in, FPV, 360 orbit). You already have `CameraAngleSelector.tsx` — elevate camera moves to first-class, thumbnail-previewed presets the user taps, and inject the exact camera grammar into the WaveSpeed prompt.

### 2. Movie Scene Creator
The pipeline exists (`generate-movie-outline`, `generate-movie-scenes`, `generate-scene-image`, `movie-director-review` — the director-review pass is genuinely good design). The problems are packaging: it's a 5,681-line page with too many simultaneous decisions, and scenes don't come out "generation-ready." Fix by making each scene card a **complete, self-contained shot spec** with exactly these fields, always filled: *Start frame (image), End frame (image), Shot type, Camera move, Lens, Character(s) + blocking, Setting, Lighting/tone, Action beat, Dialogue/VO, Final video prompt (the assembled string that goes to WaveSpeed), Duration.* One "Generate video" button per card, one "Generate all" for the sequence. The rewritten master prompt for this is in `prompt-upgrades.md`.

### 3. Reels & Stories (+ Pro, + Lifestyle)
The script generator prompt is actually decent (12 hook archetypes, per-scene camera angles — good bones). The problems: three overlapping products (merge per P1-2), an 8,398-line page, and the flow front-loads every decision. Restructure to a 3-step wizard: **(1) Idea + platform + goal → (2) AI proposes 3 complete concepts (hook, script, shot list, caption+hashtags) as swipeable cards → (3) pick one, tweak, generate.** Platform selection should actually change output: 9:16 vs 1:1, caption style, pacing, hashtag conventions per platform. Add "Remix" on every finished reel (same structure, new topic) — that's the retention feature OpusClip and Captions users love.

### 4. Podcast Talking Head
The podcast mode in `generate-reel-script` targets word counts correctly, and `generate-podcast-from-content` exists for repurposing uploads. Two gaps: **long-form chunking** — a 10-minute talking head must be generated as chained segments with consistent avatar/voice and stitched via Creatomate, with a visible segment queue and per-segment retry (your `VideoQueue.tsx` is the right foundation — surface it here); and **the repurpose loop** — after a long video renders, a one-click "Send to ChatCut → make me 5 clips" handoff (you already have `SendToChatcutDialog.tsx`; make it the default next step, not a buried option).

### 5. AI Spokesperson
Merge into **Presenter** (P1-2). The single highest-impact upgrade: the output spec should always bundle *script + voice direction (pace, emotion per line) + scene setup + wardrobe + framing* as one coherent package, and preview voice before render (you have `VoiceSelector` and TTS functions — add a "hear this line" button on the script). Add 5 conversion-tested script frameworks as starting templates (PAS, AIDA, testimonial, demo, founder story) — buyers of spokesperson videos are marketers; speak their language.

### 6. Video Repo / Video Repo Pro
Merge into **Create** as the "Product Ad / Offer" mode. The one-click promise is right; deliver it as: paste a product URL or pick from Product Library → `analyze-product` (exists) extracts everything → AI produces a complete, platform-formatted ad with hook, scenes, VO, captions, CTA → single generate button. Kill the Repo/Repo Pro split.

### 7. ChatCut AI ⭐ (your most defensible feature)
You already have the hard parts: `transcribe-video`, `detect-scenes`, `chatcut-director` (the Apple-minimal overlay rules with hard caps and verbatim-text constraints are *excellent* prompt engineering — genuinely better than most shipping products), timeline components (ruler, waveform, split, snap guides), and Creatomate for rendering. What's missing to fulfill the promise:

- **Filler-word & silence removal as a one-click op**: you have word-level transcripts; add a pass that flags "um/uh/like/you know" + silences >0.7s, shows them as red segments on the timeline, and offers "Remove all (saves 0:42)". This is *the* Captions/Descript magic moment and you're one function away from it.
- **Text-based editing**: render the transcript as the primary editing surface — select sentences, hit delete, timeline updates. The timeline becomes the verification view, not the editing view. Beginners edit text; pros drag on the timeline. That's how you get "simple for beginners, powerful for pros" in one UI.
- **Undoable agent actions**: every AI edit should appear as a proposed change set ("Cut 3 sections, added 4 captions — Apply / Review each / Undo"), not silently mutate the timeline. Trust is the product here.
- **Fix the director bugs** (system prompt sent as user role; thinking params on a non-thinking model; mojibake — P1-3).
- Fold **Vizard and Repurposer** in as ChatCut's "Clips" tab so long-video → shorts lives in the same place as editing.

### 8. AI Twins
Pipeline exists (`generate-twin-angles`, `clone-voice`, `analyze-face-similarity`, `migrate-twin-images`). Two production-readiness gaps: **(a) Consent & likeness safeguard** — before any twin is created, require an explicit consent step confirming the user owns the likeness (checkbox + face-match between selfie and uploaded set via your existing `analyze-face-similarity`). This isn't just ethics; every serious avatar platform (HeyGen, Synthesia) gates on this and enterprise buyers will ask. **(b) Quality gate before saving** — after angle generation, show a review grid ("Do these look like you? Regenerate weak angles") instead of silently saving mediocre twins that then produce disappointing videos forever. A twin created badly poisons every downstream feature.

### 9. Credit System
Doesn't exist (P0-1). Full implementation delivered in `credit-system/`. Design principles baked into it: single ledger table as source of truth (auditable, race-safe via row-level locking function); **reserve → settle** pattern (credits are held when a job starts, refunded automatically on failure — users deeply resent paying for failed generations, and refund-on-failure is a trust feature your competitors get wrong); every tool shows its cost *on the button* ("Generate · 25 ⚡") before the click; the meter never says "Running low" at 0/600 with "600 per generation" — the copy your screenshot shows is mathematically saying "free plan = one generation," which should instead be an honest "You've used your free generation — plans start at $X."

### 10. Dashboard & Design System
The dashboard is the healthiest file in the repo (448 lines, real data). Upgrades: the stat cards ("15 videos", "32 characters") are trophies, not tools — replace with a **"Continue where you left off"** row of resumable project cards with thumbnails and a progress state ("Script ready → Generate video"), which is what drives return usage. The rotating promo box ("get a website, flyer, logo…") advertises things this platform doesn't do — cut it; it makes the product feel like a reseller. Design-system-wise the foundation (shadcn + Tailwind tokens) is right; premium feel will come from: one accent (your purple) used *sparingly* on a near-black neutral scale instead of purple-on-purple-on-purple; consistent 8px spacing grid; real video thumbnails everywhere a video exists (nothing says "unfinished" like text rows for a video product); skeleton loaders shaped like the content; and empty states that are mini-onboarding ("No reels yet — here's a 20-second example, make yours →") rather than blank cards. Remove "Beta" from everything you charge for — 9 Beta badges in one nav reads as "nothing here is finished."

### 11. Reliability
Patterns to standardize across all features: every long job goes through the background queue with resumability (your `useVideoQueue` + `BackgroundJobIndicator` are good — several tools bypass them); every vendor error is translated by `errorClassifier` into user language and *never* names WaveSpeed/Creatomate/Vizard; every generation failure auto-refunds credits (built into the middleware I wrote); add Sentry (or Lovable's error reporting) — right now failures die in `console.log` inside edge functions and you have no visibility into what's breaking for users.

### 12. Strategic Suggestions (what actually moves revenue)

1. **Brand Kit as the spine** — you have `brands`, `analyze-brand-website`, `brand-guidelines-chat`, logos, voices. Unify: user pastes their site once → colors, fonts, tone, logo extracted → *every* tool defaults to on-brand output. This is the #1 driver of team-plan upgrades in this category.
2. **Watermark on free tier** — the classic growth loop (free exports carry "made with VideoAIPro"), and it makes the paid upgrade self-explanatory.
3. **Template marketplace, not more tools** — your growth surface should be templates ("Real-estate listing reel", "SaaS demo ad", "Podcast clip pack") inside the 6 flagship tools. Templates are cheap to add, SEO-indexable as landing pages, and don't add nav clutter.
4. **Public gallery → landing page** — you built `PublicLibrary` and per-user share pages; feature real user output on the landing page. Video products sell on proof, not feature lists.
5. **Ship an API later, not now** — resist it until the 6 core tools are solid.

---

## PART 3 — WHAT I BUILT FOR YOU (in `credit-system/`)

| File | What it is |
|---|---|
| `01_migration_credit_system.sql` | Complete schema: plans, subscriptions, credit ledger, tool costs table, race-safe `reserve_credits` / `settle_credits` / `refund_credits` Postgres functions, RLS policies, monthly-grant function, and seeded costs for every tool in your platform. |
| `02_shared_credits.ts` | Drop-in middleware for edge functions: `requireCredits(req, 'reel_video')` — verifies the JWT, reserves credits, returns a settle/refund handle. Three lines to protect any endpoint. Includes the exact patch for `wavespeed-video`. |
| `03_useCredits.ts` | React hook: live balance (realtime subscription), cost lookup per tool, `canAfford()`, formatted plan info. |
| `04_CreditMeter.tsx` | The premium sidebar widget: balance, animated usage bar, per-plan copy that never insults the user at zero, upgrade CTA, and a cost badge component (`<CostBadge tool="reel_video" />`) to put on every Generate button. |
| `prompt-upgrades.md` | Rewritten master prompts: Movie Scene Creator (generation-ready shot specs), the Create wizard's 3-concept generator, and Presenter script+direction bundle — plus the two chatcut-director bug fixes. |

Deploy order: run the SQL in Supabase → drop `02` into `supabase/functions/_shared/` → patch `wavespeed-video`, `creatomate-stitch`, `generate-scene-image`, `vizard-api`, and the TTS functions with the 3-line guard → add the hook + meter to `Navigation.tsx` → connect Stripe (Lovable has a native Stripe integration; wire `checkout.session.completed` and `invoice.paid` webhooks to the `grant_monthly_credits` function).

---

## PART 4 — THE 30-DAY EXECUTION ORDER

**Week 1 — Stop the bleeding (P0s).** Re-sync GitHub ↔ Lovable. Ship the credit system + Stripe. Close `generate-content-strategy`. Add webhook secrets. Lock CORS. Remove vendor names from every user-facing error.

**Week 2 — Consolidate.** Collapse 20 nav items into the 6 flagship products with redirects. Rewrite nav + dashboard around them. Remove Beta badges. Add cost badges to every Generate button.

**Week 3 — ChatCut to "wow".** Filler-word/silence one-click removal, text-based editing surface, proposed-change-sets with undo, director bug fixes, Vizard folded in as the Clips tab. This becomes your demo video and your homepage hero.

**Week 4 — Polish pass.** Decompose the three monolith pages (at least Reels and ChatCut). Thumbnails everywhere. Empty states as onboarding. Mobile-first Create flow. Skeletons. Then record the new demo and update the landing page with real output.

Do these four weeks and the platform stops being "31 beta tools" and becomes "6 products that take money, don't lose it on failed jobs, and have one feature (ChatCut) that's genuinely best-in-class." That's what a premium AI video platform is.
