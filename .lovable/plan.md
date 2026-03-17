

# Non-Functional Features Audit

After scanning the entire codebase, here are features that are **displayed in the UI but don't actually work** (or are misleading):

---

## Definitely Broken / No-Op

### 1. **Captions Toggle** (Reels Sidebar)
The "Captions" feature toggle in the sidebar is visible and clickable, but toggling it only sets `featureToggles.captions` to true/false. The value is passed as `addCaptions` to the `generate-reel-video` edge function, but there is **no caption rendering, styling, or overlay logic** on the client side. The `KaraokeCaption` and `CaptionStyleSelector` components exist as imports but are never used in the final output. Captions are not burned into the video.

### 2. **Video Upscaler** (Reels Sidebar)
The toggle shows an "Upscaler" panel with 2x/4x/AI Enhance options. The `VideoUpscaler` component calls the `upscale-video` edge function, but **there is no validation that the upscale actually completes or integrates back into the reel pipeline**. It's a standalone panel — upscaling a video doesn't replace the reel's video. It's disconnected from the production flow.

### 3. **"Projects" Nav Link** → Redirects to `/reels`
Navigation shows "Projects" under Manage, but `App.tsx` redirects `/projects` to `/reels`. The old Projects page still exists in code but is unreachable. Misleading nav item.

### 4. **Settings Page — "Coming Soon" Features**
Settings page displays a "Coming Soon" card listing: Background Music Generation, Brand Voice Configuration, Export Settings, Usage Analytics, Team Collaboration. None of these exist. Background Music was just added to Reels but isn't on the Settings page. The others are pure placeholder text.

### 5. **Settings Page — Voice Preview Uses Browser Speech**
The "Loop AI Director Voice" setting uses `window.speechSynthesis` (browser TTS) for preview, which sounds completely different from the actual WaveSpeed MiniMax TTS used in production. Users hear one voice, get a different one.

### 6. **Dashboard "Recent Activity" Card — Always Shows "Ready"**
The `recentProjects` array in Dashboard stats is always empty because `fetchProjectStats` counts rows but never assigns recent projects to the array. The card always falls through to the "Ready / Start creating" fallback.

### 7. **Dashboard Stats — Incomplete Count**
"Videos Created" only counts `projects` + `reels` + `movie_projects`. Doesn't include `testimonial_commercials`, `video_hooks`, or `ai_twins`. Understates the user's actual output.

### 8. **Podcast Mode** (Reels Sidebar)
"Podcast Mode" is selectable in the mode switcher. It sets `isPodcastMode = true` which changes some script generation parameters, but there is **no podcast-specific output format** — it just generates a standard reel with different prompts. No long-form audio, no podcast layout, no RSS integration.

### 9. **Cut Scenes Toggle**
The "Cut Scenes" toggle sets `enableCutScenes = true` and passes it to the script generator, which may add B-roll scene descriptions. But the actual **cut scene video generation** (generating separate B-roll clips and interleaving them) is not implemented in the video pipeline. The scenes are treated identically to regular scenes.

### 10. **Intro & Outro Templates**
The Intro/Outro toggle reveals a `TemplateSelector` component that lets users pick intro/outro styles and custom text. The config is passed to `generate-reel-video` as `introConfig`/`outroConfig`, but the edge function's actual handling of these is minimal — it doesn't generate separate intro/outro video clips with branding. The intro/outro scenes are just additional narrated scenes.

---

## Summary Table

| Feature | Location | Issue |
|---------|----------|-------|
| Captions toggle | Reels sidebar | No caption rendering in output |
| Video Upscaler | Reels sidebar | Disconnected from reel pipeline |
| Projects nav link | Navigation | Redirects to /reels, misleading |
| Coming Soon settings | Settings page | Pure placeholder text |
| Voice preview | Settings page | Wrong TTS engine (browser vs WaveSpeed) |
| Recent Activity | Dashboard | Always empty, shows "Ready" |
| Video count stats | Dashboard | Missing several content types |
| Podcast Mode | Reels sidebar | No podcast-specific output |
| Cut Scenes toggle | Reels sidebar | B-roll not actually generated separately |
| Intro/Outro templates | Reels advanced | No branded intro/outro video clips |

Want me to fix any of these? I'd recommend starting with the Dashboard stats and Recent Activity (quick wins), then tackling captions or the upscaler integration as larger efforts.

