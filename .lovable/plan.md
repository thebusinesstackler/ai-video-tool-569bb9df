
The user wants Marco to receive a richer payload so he can be the best possible director. Right now Marco gets transcript + overlays + b-roll + overlap data. Let's identify what's missing.

## Current Marco payload (from ChatcutAI.tsx sendMessage)
- Transcript (cleaned/raw)
- currentOverlays (id, text, start, duration, position, scale, placement, treatment, overlaps)
- currentBRoll (id, name, start, duration, audioEnabled, overlaps)
- currentMotionGraphics
- thumbnail
- brandSettings
- context.overlapping ids

## What's missing — high-impact additions

### 1. Video / playback intel
- `videoDurationSec` + current `playheadSec` — Marco can suggest "at 12s the energy dies, add a stat card"
- `aspectRatio` (9:16 / 16:9 / 1:1) — affects safe zones for placement
- `pipLayer` info if a PiP background video is loaded
- `skipRanges` (silent/dead-air segments already auto-skipped) — Marco can recommend permanent cuts

### 2. Audio intel
- Background music: title, BPM if known, volume, energy curve
- Voice clarity score / detected filler words from cleaned transcript diff
- Per-word timings (already in transcript) → expose `wordsPerMinute` average + per-segment WPM so Marco can flag rushed/slow sections

### 3. Visual / brand intel
- `brandVocabulary` (already partially passed) → ensure ALL brand names + product names go in
- `brandColors` palette (primary/secondary/accent) — Marco should reference for new overlays
- `fontStack` from brand settings
- `safeZones` for current aspect ratio — explicit no-go rectangles (face area from face-detection if available, caption strip area)

### 4. Caption / typography state
- Current caption style (Karaoke/Word Pop/none), font, color, size, position
- Whether captions are enabled — Marco should not stack overlays on caption strip

### 5. Strategic / KPI context
- Hook window status: is first 2s strong? (count overlays in 0–2s, hook overlay text)
- CTA presence: is there a CTA overlay in the last 15%? if not, Marco should suggest one
- Pacing analysis: scenes/edits per 10s window
- Asset reuse opportunities: list of generated overlays/b-roll already in user's library matching transcript topics

### 6. Recent action history
- Last 5 actions Marco took (or user took) → prevents Marco from undoing himself or repeating suggestions
- User-pinned items (don't touch list)

### 7. User intent signals
- `creatorMode` (beginner/pro)
- Vertical (TheraNovex healthcare vs Lifecykel wellness — already in core memory but not passed)
- Target platform (TikTok/Reels/Shorts/YouTube) — affects pacing, captions, hook length

## Plan — implement payload enrichment

### Files to edit
1. **`src/pages/ChatcutAI.tsx`** — `sendMessage` payload builder
   - Add `playback` block: `{ durationSec, playheadSec, aspectRatio, pipActive, skipRanges }`
   - Add `audio` block: `{ musicTitle, musicVolume, hasNarration, avgWPM, perSegmentWPM }`
   - Add `brand` block: `{ vocabulary, colors, fontStack, vertical }`
   - Add `captions` block: `{ enabled, style, position, font, color }`
   - Add `safeZones` array (caption strip + face if known)
   - Add `kpis` block: `{ hookStrength, ctaPresent, editsPer10s, openingOverlayCount }`
   - Add `recentActions` (last 5 from history)
   - Add `pinnedItemIds` (don't-touch list)
   - Add `targetPlatform` + `creatorMode`
   - Add `assetLibrarySuggestions` (lazy: top 5 reusable assets matching transcript keywords)

2. **`supabase/functions/chatcut-director/index.ts`** — system prompt
   - Document each new payload section so Marco actually USES them
   - Add directives:
     - "Reference brand colors/fonts when adding overlays"
     - "Never place overlays on safeZones"
     - "If hookStrength < 6 in first 2s, prioritize improving the hook"
     - "If ctaPresent=false and we're past 80% duration, suggest a CTA"
     - "Match WPM target ~150 for narration; flag segments outside 120-180"
     - "Never modify pinned items"
     - "Use targetPlatform to tune pacing (TikTok=fast, YouTube=slower)"

3. **`.lovable/memory/features/ai-tools/chatcut-marco-update-actions.md`** — update memory doc

### Out of scope (future)
- Real face-detection for safe zones (use a static "center 30% bottom" assumption for now)
- Computing actual hook strength via AI subcall (use heuristic: overlay present + word count in first 2s)
- Asset library semantic search (use simple keyword match for v1)

### Answer to user
Yes — we'll add 7 new payload sections (playback, audio, brand, captions, safeZones, kpis, recentActions/pinned/platform) and teach Marco to act on each.
