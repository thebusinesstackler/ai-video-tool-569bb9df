

# Fix Chatcut AI: Sidebar Jumping, Timeline Button Overlap, Collapsible Media Panel

## Issues

1. **Sidebar jumping during playback** — Navigation links use `transition-all duration-200` which animates *every* CSS property. When the video plays and triggers re-renders, any computed style change causes visible layout shifts.

2. **"Hide Timeline" button overlaps text** — The collapse toggle is absolutely positioned at `top-0 right-2` inside the timeline, sitting on top of the ruler ticks and other elements.

3. **Media panel can't be hidden** — The right "Media" panel is always visible with no toggle to collapse it.

## Changes

### File: `src/components/Navigation.tsx`
- Change `transition-all duration-200` on nav link items to `transition-colors duration-200` — only color changes need animating, not layout properties

### File: `src/pages/ChatcutAI.tsx`
- **Timeline toggle button**: Move it out of the absolute overlay position. Place it as a proper inline button in the timeline header bar (next to the ruler), so it doesn't overlap any text
- **Collapsible media panel**: Add a `mediaPanelVisible` state. Add a toggle button (e.g. a sidebar icon) in the media panel header. When hidden, the media `ResizablePanel` and its `ResizableHandle` are conditionally removed, giving the center panel full remaining width. Add a small floating button on the right edge to bring it back

### Summary

| File | Change |
|------|--------|
| `src/components/Navigation.tsx` | Replace `transition-all` with `transition-colors` on nav links |
| `src/pages/ChatcutAI.tsx` | Fix timeline toggle positioning; add media panel show/hide toggle |

