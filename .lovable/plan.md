

## Problem

Two issues:

1. **Loop AI hallucinates about script content** — The conversation history includes old assistant messages that describe previous versions of scripts (e.g., from the initial strategy). When the user edits scripts in the UI, the `currentSegments` payload sends the updated data, but the AI also reads its own old messages that reference the original scripts. The old messages "win" because the AI trusts its own prior conversation over the structured segment data.

2. **No way to see what Loop AI sees** — Users can't verify whether the data payload matches their timeline, making it impossible to debug mismatches.

## Plan

### 1. Fix stale context: Inject a "current state override" system message (LoopAIDirector.tsx)

Before sending the `messages` array to the edge function, prepend a system message that explicitly says:

```
"IMPORTANT: The following is the LIVE current state of the timeline. Ignore any previous descriptions of scripts or scenes from earlier in this conversation — they may be outdated. ONLY reference the data in currentSegments."
```

This goes into the `messages` array as the last system-role message before the user's new message, so the AI prioritizes it over stale history.

### 2. Add a "Show AI Context" debug toggle (LoopAIDirector.tsx)

Add a small button (e.g., 👁️ icon or "What Loop sees") near the chat header that, when clicked, renders a collapsible panel showing:

- **Project Dashboard** — the `projectSummary` object (segment counts, durations, readiness)
- **Per-scene data** — a compact list showing each scene's script preview, duration, word count, missing assets, and status (matching exactly what gets sent to the AI)
- **Issues detected** — the `timelineIssues` array

This uses the same computation logic already in `handleSendWithMessage` but displays it in the UI. Extract the payload-building logic into a reusable function (`buildPayloadForAI()`) that both the send handler and the debug panel call.

### 3. Extract payload builder (LoopAIDirector.tsx)

Refactor the inline payload computation (lines 1003-1127) into a standalone function:

```typescript
function buildAIPayload(segments, targetDuration) {
  return { projectSummary, currentSegments, timelineIssues };
}
```

Both `handleSendWithMessage` and the debug panel use this same function, ensuring what the user sees matches exactly what the AI receives.

### Files to modify
- `src/components/testimonial/LoopAIDirector.tsx` — Extract payload builder, add override system message, add debug panel UI

