

# Chatcut AI Layout Redesign — Resizable Panels, Chat at Bottom

## Overview
Restructure the Chatcut AI page to match the reference: resizable 3-panel layout with the chat pinned to the bottom-left, video filling its space, and the right media panel draggable smaller.

## Changes (all in `src/pages/ChatcutAI.tsx`)

### 1. Use Resizable Panels
Import `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` from `@/components/ui/resizable`. Replace the fixed `flex` 3-column layout with a horizontal `ResizablePanelGroup` so all three columns (chat, video+timeline, media) can be resized by dragging handles.

### 2. Layout Structure
```text
┌──────────────┬─────────────────────────────┬──────────┐
│              │                             │          │
│   AI Chat    │      Video Preview          │  Media   │
│  (scrollable │                             │  Panel   │
│   messages)  ├─────────────────────────────┤ (resize- │
│              │  Transport + Timeline       │  able)   │
│──────────────│  (V3, V2, V1, A1 tracks)   │          │
│  Chat Input  │                             │          │
│  (pinned     │                             │          │
│   bottom)    │                             │          │
└──────────────┴─────────────────────────────┴──────────┘
```

- **Left panel** (~30% default, min 20%): AI/Transcript tabs with scrollable messages; chat input form pinned at the absolute bottom
- **Center panel** (~50% default): Video preview on top taking available space, transport bar, then multi-track timeline at bottom
- **Right panel** (~20% default, min 10%): Media sections (Videos, Audios, Motion Graphics) — can be dragged smaller

### 3. Add V3 Track
Reference shows 4 tracks: V3, V2, V1, A1. Add a V3 track for motion graphics overlay (currently overlays are on V2). Shift V2 to show the main video thumbnails and V1 to show additional overlay/marker content matching the reference layout.

### 4. Visual Polish
- Drag handles styled as thin vertical lines between panels
- Chat messages use full `prose` markdown rendering with table support (reference shows a table with Time/Word/Moment columns)
- Video fills center panel without excess padding
- Dark backgrounds match reference

### Files Modified
- `src/pages/ChatcutAI.tsx` — replace flex layout with ResizablePanelGroup, add V3 track, pin chat input to bottom

