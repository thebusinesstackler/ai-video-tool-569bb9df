

# Logo Resize + New Chatcut AI Page

## 1. Make logos 2x smaller

**Landing page (`src/pages/Landing.tsx`)**: Change `h-60 max-w-[600px]` → `h-30 max-w-[300px]`

**Auth page (`src/pages/Auth.tsx`)**: Change `w-[480px]` → `w-[240px]`

## 2. Create Chatcut AI page

A new page at `/chatcut-ai` with a chat-based video editing interface. The user uploads raw footage, and the AI analyzes it to automatically detect and remove filler words ("um", "uh", "like") and suggest scene cuts.

### Core features
- Chat interface with message history (user/assistant bubbles, markdown rendering)
- Video upload dropzone (drag & drop or click to upload raw footage)
- Video player to preview uploaded footage
- "Auto-Clean" button that triggers analysis: transcribes the video, detects filler words and awkward pauses, and returns a list of suggested cuts
- Cut list displayed as timeline markers the user can approve/reject
- Export button to apply cuts and download the cleaned video

### Implementation
- **New file**: `src/pages/ChatcutAI.tsx` — full page with chat UI + video upload + processing flow
- Uses existing `transcribe-video` edge function for transcription
- New edge function `chatcut-director` that takes the transcript + user chat messages and returns cut suggestions (filler words, dead air, scene boundaries) as structured JSON actions
- Chat messages sent to `chatcut-director` with full conversation history + transcript context
- Video upload via Supabase Storage (`raw-footage` bucket)

### Navigation & routing
- **`src/components/Navigation.tsx`**: Add `{ name: 'Chatcut AI', href: '/chatcut-ai', icon: Scissors, beta: true }` under the "AI Tools" group
- **`src/App.tsx`**: Add route `<Route path="/chatcut-ai" element={<ProtectedRoute><ChatcutAI /></ProtectedRoute>} />`

### Files modified/created
- `src/pages/Landing.tsx` — logo size
- `src/pages/Auth.tsx` — logo size
- `src/pages/ChatcutAI.tsx` — new page
- `src/components/Navigation.tsx` — add nav item
- `src/App.tsx` — add route
- `supabase/functions/chatcut-director/index.ts` — new edge function for chat-based cut analysis
- Database migration: create `raw-footage` storage bucket with RLS

