

## Plan: Remove Auto-Play on Hover & Project Assessment

### 1. Remove Auto-Play on Hover (TimelinePreview.tsx)

**Problem:** When hovering over timeline segments, voiceovers auto-play (and even trigger TTS generation). This is disruptive when making edits.

**Fix:** Convert the hover-to-play behavior into a click-to-play toggle instead.

- Remove `onMouseEnter` and `onMouseLeave` handlers from timeline segment items
- Remove `handleHoverStart` and `handleHoverEnd` callbacks
- Add a small play/pause button on each segment that triggers audio playback on click
- Keep `hoverAudioRef`, `playingId` state for click-based playback
- Clean up unused state: `hoverVoiceId`, `isLoadingVoice`

### 2. Project Assessment — What's Still Needed

Based on codebase review, here's what's functional vs. what needs work:

**Working:**
- Commercial strategy generation via Loop AI
- Scene/B-roll segment management with drag-and-drop timeline
- Character image generation and reference image uploads
- Storyboard preview with playback controls
- Loop AI Director chat with TTS voice responses
- Voice preset settings

**Gaps / Next Steps:**

| Area | Status | What's Needed |
|------|--------|---------------|
| **Final Video Generation** | Partial | The `generateCommercial` function exists but the full stitching pipeline (Creatomate) needs API key setup and testing |
| **Music/Audio** | Paused | Background music generation deferred (ElevenLabs key not added yet) |
| **Video Export/Download** | UI exists | Needs end-to-end testing once video generation works |
| **B-Roll Image Generation** | Partial | `onGenerateBrollPreview` referenced but implementation needs verification |
| **Voice Generation per Segment** | Partial | TTS calls exist but bulk voice generation for all segments needs testing |
| **Product Swap in B-Roll** | New | Logic added but needs end-to-end testing with actual image generation |
| **Saved Commercials** | Works | Load/save to database functional |
| **Mobile Responsiveness** | Needs work | The editor layout with chat + timeline + scenes is complex at 785px viewport |

These are areas to prioritize based on your goals — the core editing workflow is solid, and the main gaps are in the final production pipeline (stitching scenes into a downloadable video).

