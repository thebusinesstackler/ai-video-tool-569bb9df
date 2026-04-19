---
name: Chatcut Vision, PiP Layouts & Safety UX
description: Marco vision (gemini-2.5-flash keyframe analysis), TikTok PiP scene layouts, hold-to-delete, square aspect, brand-from-URL, motion-graphic fallback to DOM cards
type: feature
---

Six upgrades to Chatcut AI:

1. **Hold-to-delete** — `src/components/ui/hold-to-delete.tsx`. 700 ms press-and-hold with circular progress ring around the trash icon. Replaces every destructive button on the timeline (clips, B-roll, music, overlays, motion graphics, transitions, punch-ins). Releasing early cancels.

2. **Smart aspect system** — `targetPlatform` now includes `square` (1:1) alongside tiktok/reels/shorts/youtube/youtube-landscape. Each platform has its own `PLATFORM_SAFE_ZONES` rectangle list. When source aspect ≠ target, Marco picks a per-scene reframe via `set_scene_layout` instead of blind cropping.

3. **TikTok-native PiP layouts** — new director action `set_scene_layout({ start, duration, layout, actorScale?, actorPosition? })` with layouts: `pip_actor_bottom_circle | pip_actor_bottom_strip | pip_actor_floating_card | fullscreen_actor | fullscreen_broll`. Renderer applies CSS transform on the main `<video>` so the speaker shrinks to the bottom band while B-roll fills the top region. No render cost.

4. **Graphic fallback to DOM** — when VEO 3.1 / animated graphic generation FAILS (timeout, empty url), the failed entry is auto-downgraded to a clean DOM `cta_lockup` / `full_card` treatment so the timeline never has a broken visual. Marco prompt also says: if the line lacks emphasis-worthy phrasing, default to `treatment: 'full_card' | 'clean_caption' | 'screenshot_callout'` instead of forcing weak motion.

5. **Brand-from-URL analyzer** — Settings page has an "Analyze my website" input (Firecrawl scrape → Gemini 2.5 Flash). Stores `profiles.brand_url` (text) + `profiles.brand_analysis` (jsonb: tone, audience, palette, fonts, key benefits, recurring phrases, CTA style). Auto-injected into Marco's brand-context payload.

6. **Marco vision (medium tier)** — new `analyze-frame-vision` edge function (Gemini 2.5 Flash multimodal). On video load: 4-6 keyframes → cached in `chatcut_drafts.timeline_state.visionAnalysis`. Per Marco edit: 1 frame at the playhead → `context.currentFrameVision`. Marco's pre-flight rule: if subject is left → text right; if frame is busy → use `full_card` instead of overlay; if negative space is bottom → lower-third placement. Returns subjects[] (face/product/text/logo bboxes), occlusions[] (which overlay covers what), contrast[] (low/med/high readability), summary stats.

Cost guard: vision is capped at 4 frames per call; only triggered on draft load + on Marco invocation, not every playhead change.
