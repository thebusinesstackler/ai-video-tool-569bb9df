

# Chatcut AI — Draft System, Smart Editing, B-Roll Generation & Motion Graphics

## Overview
Add project save/new functionality, upgrade the AI agent to intelligently analyze video content for edits and B-roll, generate real B-roll images, and render motion graphics with proper AI models.

---

## 1. Draft Save / New Project System

**What**: Add "New" and "Save Draft" buttons to the top bar. Drafts persist to the database so users can resume later.

- Create a `chatcut_drafts` database table: `id`, `user_id`, `name`, `video_url`, `transcript`, `timeline_state` (JSONB — clips, cuts, music, overlays, b-roll, caption settings), `chat_history` (JSONB), `created_at`, `updated_at`
- Add RLS policies for user-owned rows
- Top bar gets: **New Project** button (confirms discard, resets all state), **Save** button (upserts to DB), and a draft name input
- Auto-save on significant actions (add music, add cuts, etc.)
- On page load, if a draft exists, show a "Resume draft?" prompt

**File**: `src/pages/ChatcutAI.tsx`, new migration

---

## 2. AI Agent — Video-Aware Editing (Cut Pauses, Review Timeline)

**What**: Marco can analyze the transcript to find and cut pauses/dead air, not just filler words. The system prompt already supports `cut` actions — the upgrade is sending richer context so the AI can make smarter decisions.

- When the user says "cut pauses" or "clean up", send the full transcript with word-level timestamps to the AI, plus the current timeline state (what's already on each track)
- Update the `chatcut-director` system prompt to include instructions for detecting pauses (gaps > 0.8s between words) and dead air
- Add a new `review_timeline` action: Marco receives the full timeline state (clips, music, overlays, b-roll) and suggests improvements
- Send timeline state as a system message alongside transcript so Marco can reference what's already there

**Files**: `supabase/functions/chatcut-director/index.ts`, `src/pages/ChatcutAI.tsx`

---

## 3. B-Roll — Context-Aware Generation with Real Images

**What**: When Marco adds B-roll, he analyzes the transcript to determine what visual would fit that moment, then generates a real image using the existing `generate-scene-image` edge function (which uses Claude prompt enhancement + DALL-E/GPT Image-1).

- Update `add_broll` action handler in ChatcutAI to call `generate-scene-image` with the AI-generated prompt
- Add `imageUrl` and `status` fields to the `BRollClip` interface
- Show a loading state on the B-roll clip in the timeline while generating
- Once generated, display the B-roll image on the video preview (replacing the current "B-ROLL" badge) when the playhead is over that clip
- The AI prompt in `chatcut-director` already instructs Marco to provide contextual prompts — just need to connect to the generation pipeline

**Files**: `src/pages/ChatcutAI.tsx`

---

## 4. Motion Graphics — Proper AI Model

**What**: Motion graphics (lower thirds, animated text, title cards) currently render as static text overlays. Upgrade to use Gemini image generation (`google/gemini-3.1-flash-image-preview`) via the Lovable AI Gateway to create actual styled motion graphic frames.

- For `add_overlay` with type `motion_graphic` or `animated_text`, call a new edge function or use `generate-scene-image` with a motion-graphics-specific prompt (e.g., "Professional lower third graphic with text 'Product Name', dark glass background, modern sans-serif font, broadcast quality")
- Store the generated image URL on the `OverlayItem` interface
- Render the generated image as an overlay on the video instead of plain text
- Fall back to text rendering if generation fails

**Files**: `src/pages/ChatcutAI.tsx`, `supabase/functions/chatcut-director/index.ts`

---

## 5. Enhanced System Prompt

Update the `chatcut-director` system prompt to:
- Instruct Marco to analyze pause gaps in word-level transcripts (gaps > 0.8s)
- When adding B-roll, require Marco to write prompts that match the video's subject/product/context from the transcript
- Include current timeline state in the context so Marco can review and suggest holistic improvements
- Add a `review` action type where Marco can describe what he sees and recommend changes

**File**: `supabase/functions/chatcut-director/index.ts`

---

## Technical Details

| Component | Model / Service |
|-----------|----------------|
| AI Director (chat) | `google/gemini-3-flash-preview` via Lovable AI Gateway |
| B-Roll image generation | `generate-scene-image` edge function (Claude + GPT Image-1) |
| Motion graphic generation | `google/gemini-3.1-flash-image-preview` via Lovable AI Gateway |
| Music generation | Existing `generate-music` edge function |
| Transcription | Existing `transcribe-video` edge function |

### Database Migration
```sql
CREATE TABLE public.chatcut_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  video_url TEXT,
  transcript JSONB,
  timeline_state JSONB NOT NULL DEFAULT '{}',
  chat_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chatcut_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts" ON public.chatcut_drafts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_chatcut_drafts_updated_at
  BEFORE UPDATE ON public.chatcut_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Files Modified
- `src/pages/ChatcutAI.tsx` — draft save/load, B-roll image generation, motion graphic rendering, timeline state context
- `supabase/functions/chatcut-director/index.ts` — enhanced system prompt with pause detection, timeline review, contextual B-roll

