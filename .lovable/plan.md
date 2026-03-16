

## Problem

Loop AI Director gives generic, overly positive feedback ("looks solid!") instead of identifying specific issues in the timeline. The root cause is **two-fold**:

1. **Insufficient data sent to the AI**: The frontend sends metadata flags (`hasImages: true/false`, `hasAudio: true/false`) but omits critical details like actual reference image URLs, audio URLs, video URLs, word count vs duration mismatches, and whether characters are consistent across scenes.
2. **System prompt lacks a "diagnostic audit" instruction**: The prompt tells Loop to be proactive but doesn't force it to run a structured diagnostic checklist when it receives segments. It defaults to being encouraging rather than critical.

## Plan

### 1. Enrich segment data sent to the AI (LoopAIDirector.tsx)

Add these fields to the `currentSegments` payload (lines 717-741):
- `wordCount` — computed from script, so the AI can check if words match duration
- `expectedDuration` — calculated from word count at 2.5 words/sec
- `durationMismatch` — boolean flag when script is too long/short for the duration
- `characterReferenceImageUrls` — first 1-2 actual image URLs so the AI can reason about whether images exist
- `audioUrl` — actual URL (truncated) so the AI knows audio was generated
- `videoUrl` — actual URL (truncated) so the AI knows video exists
- `missingAssets` — a computed list like `['no character images', 'no audio', 'no video']`
- `scriptPreview` — send full script instead of 200-char truncation

### 2. Add a computed "issues" summary to the payload (LoopAIDirector.tsx)

Before sending to the edge function, compute a `timelineIssues` array:
- Scenes with no character description
- Scenes with no reference images
- Scenes with no audio
- Duration/word-count mismatches (script too long or too short)
- B-roll scenes with no preview images
- B-roll scenes with no voiceover text
- Consecutive same-type segments (3+ speaking in a row)
- Missing transitions variety
- Total duration vs target duration mismatch

Send this as a top-level `timelineIssues` field in the request body.

### 3. Update the edge function system prompt (generate-commercial-strategy/index.ts)

Add a new section to `buildSystemPrompt` after the segment context:

**"TIMELINE DIAGNOSTIC PROTOCOL"** — when the user has segments AND asks for review/feedback/help OR when `timelineIssues` is non-empty:
- ALWAYS start by listing specific problems found, referencing scene numbers
- NEVER say "looks solid" or "looking great" if there are missing assets or issues
- Use the `missingAssets` field to call out exactly what's missing per scene
- Use `durationMismatch` to flag pacing problems
- After listing issues, offer to fix them with action blocks

### 4. Update `buildSegmentContext` in the edge function

- Accept and display `timelineIssues` in the context string
- Show word count and expected duration alongside each scene
- Send full scripts (remove the `.slice(0, 200)` truncation)
- Add a "⚠️ ISSUES DETECTED" section when issues exist, forcing the AI to address them

### Files to modify
- `src/components/testimonial/LoopAIDirector.tsx` — enrich payload with computed diagnostics
- `supabase/functions/generate-commercial-strategy/index.ts` — update `buildSegmentContext` and system prompt to enforce diagnostic behavior

