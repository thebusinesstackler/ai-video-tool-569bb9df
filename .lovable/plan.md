## Goal

Add a new **Reels & Stories Pro** page where a Claude agent (via Lovable AI Gateway) plans the script, picks the AI Twin, generates voice, drives InfiniteTalk HD lip-sync, and stitches the final reel — all through a chat interface. Optimized for talking-head long-form (no 20s Sora cap).

## Why InfiniteTalk HD only

- No 20s segment limit (Sora's biggest pain point in current Reels)
- One twin → one continuous performance, perfect lip-sync
- Reuses the working `gpt-4o-mini-tts` + `wavespeed-ai/infinitetalk-hd` pipeline already in `generate-reel-video` and `generate-talking-head-from-audio`

## New page: `src/pages/ReelsPro.tsx`

Chat-first layout (AI Elements-compliant), single conversation per session, no thread sidebar:

```text
┌──────────────────────────────┬─────────────────────┐
│  Marco Pro Chat              │  Live Plan Panel    │
│  (AI Elements)               │  - Topic            │
│  - tool calls render inline  │  - Selected Twin    │
│  - shows script drafts,      │  - Script (editable)│
│    voice previews, video     │  - Voice preview    │
│    progress                  │  - Final video      │
└──────────────────────────────┴─────────────────────┘
```

Route added in `src/App.tsx`; nav entry in `src/components/Navigation.tsx` under "Reels Pro".

## Backend: new edge function `reels-pro-agent`

Streaming AI SDK route using `streamText` against `google/gemini-3-flash-preview` for cheap orchestration, **with Claude (`anthropic/claude-3.5-sonnet` via gateway) as the planning model** when the user explicitly requests "high quality" (toggle in UI). Default = Gemini Flash for cost.

Tools exposed to the agent (all `tool()` with Zod schemas, `stopWhen: stepCountIs(50)`):

| Tool | Wraps | Purpose |
|---|---|---|
| `list_twins` | RPC `get_twins_summary` | Show available AI Twins for talking head |
| `draft_script` | calls existing `generate-reel-script` | Produce hook + body + CTA, pacing-aware (~2.5 wps, max 300s) |
| `refine_script` | inline Claude/Gemini | Edit a specific line based on user feedback |
| `synthesize_voice` | `text-to-speech` (twin clone → gpt-4o-mini-tts fallback) | Returns audio URL for preview |
| `generate_talking_head` | `generate-talking-head-from-audio` (InfiniteTalk HD) | Returns wavespeed taskId |
| `poll_video_task` | `wavespeed-video` | Returns video URL when ready |
| `add_captions` | `creatomate-stitch` with caption template | Optional karaoke captions |
| `save_to_library` | inserts into existing reels table | Persist the final reel |

Tool deferral not needed (only ~8 tools), register eagerly.

### Agent system prompt (key points)
- Always confirm topic + select twin + show script before generating video
- Enforce hook rules (6+ seconds, 15–25 words, psychological trigger) from existing memory
- Cap total duration at 300s (InfiniteTalk HD long-form ceiling)
- Never invent a voice — must pick from `list_twins` or default to twin's `voice_cloning_key`
- Show streamed progress (tool parts open by default during generation, collapse after)

## Frontend wiring

- `useChat` from `ai-sdk/react` against `/functions/v1/reels-pro-agent`
- Install AI Elements: `bun x ai-elements@latest add conversation message prompt-input tool shimmer`
- Custom tool renderers:
  - `generate_talking_head` → progress bar + live preview thumbnail
  - `draft_script` → editable script card with "Approve" / "Refine" buttons that send canned follow-up messages
  - `save_to_library` → success card with link to Reels library
- Reuse `BackgroundVideoContext` so generations persist if the user navigates away

## Files

**New**
- `src/pages/ReelsPro.tsx`
- `src/components/reels-pro/PlanPanel.tsx`
- `src/components/reels-pro/tool-renderers/` (script, voice, video, save)
- `supabase/functions/reels-pro-agent/index.ts`
- `supabase/functions/_shared/ai-gateway.ts` (Lovable AI Gateway provider helper, if not already present)

**Edited**
- `src/App.tsx` — add `/reels-pro` route
- `src/components/Navigation.tsx` — nav entry
- `package.json` — add `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `zod` (if missing)

## Out of scope
- Cinematic Sora/Wan models (this Pro mode is talking-head only by user choice)
- Multi-speaker conversation (already in standard Reels via ConversationBuilder)
- B-roll cutaways during the talking head (could be a v2)
- Threaded chat history (single conversation per session, optional localStorage)

## Verification
1. Open `/reels-pro` → chat appears with empty state
2. "Make a 60s reel about magnesium for sleep using my female twin" → agent calls `list_twins` → `draft_script` → renders editable script
3. User approves → `synthesize_voice` plays preview → `generate_talking_head` shows progress → final video appears in plan panel
4. "Save it" → `save_to_library` confirms; reel appears in main Reels library
5. Refresh page mid-generation → background task continues, video shows up when ready
