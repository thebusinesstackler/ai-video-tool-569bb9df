## Problem

At your current viewport (~739×455), ChatCut is broken in two ways:

1. **Below 768px wide**, the page swaps to a "mobile stub" that just says *"open on a larger screen"* — no editor, no timeline.
2. **Above 768px wide**, the Layout sidebar (`ml-64`) eats 256px, leaving only ~480px for the 3-panel editor. The center panel uses `flex-1` for the video, so the video grows to fill the height and pushes the timeline off-screen — the only way to see the timeline is to browser-zoom out.

## Fix

Three small, targeted changes — all visual/layout, no logic changes.

### 1. Lower the "full editor" breakpoint from `md` (768px) → `sm` (640px)

In `src/pages/ChatcutAI.tsx`:
- Line 4410: `hidden md:flex` → `hidden sm:flex`
- Line 6702: `md:hidden` → `sm:hidden`

Result: at 640px+ you get the real 3-panel editor instead of the stub. Your 739px viewport gets the full UI.

### 2. Auto-collapse the sidebar when on `/chatcut-ai`

ChatCut is a dense IDE-style page — the 256px nav sidebar is the biggest space thief. Add a small effect in `ChatcutAI.tsx` that sets `localStorage['sidebar-collapsed'] = 'true'` on mount (only on screens narrower than ~1280px so desktop users keep their preference), and dispatches the `sidebar-collapse-changed` event Layout already listens to. This frees ~192px of horizontal space immediately.

### 3. Cap the video preview height so the timeline is always visible

In the center `ResizablePanel` (line 4835-4839), the video uses `flex-1` + `min-h-[240px]`. Change it so the video stays bounded and the timeline always gets a fixed minimum:
- Wrap video region with `max-h-[55vh]` instead of unbounded `flex-1`
- Ensure the timeline section below has `flex-shrink-0` with its own scroll container (`overflow-y-auto`) so it remains accessible at any height

Also bump the outer container from `h-[calc(100vh-64px)]` to allow internal vertical scroll as a final fallback (`min-h-[600px]` so on very short viewports the page itself can scroll instead of crushing the timeline to zero).

## Files touched

- `src/pages/ChatcutAI.tsx` — breakpoint swap, sidebar auto-collapse effect, video panel height cap, timeline shrink guards.

## Out of scope

No changes to Marco logic, timeline behavior, B-roll generation, exports, or any data. Pure responsive-layout fix.
