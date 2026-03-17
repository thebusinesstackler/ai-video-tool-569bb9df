

## Problem
The "Save All Changes" banner exists at the top of the `TwinDetailPanel`, but because the dialog content scrolls (`overflow-y-auto`), it scrolls out of view. The user expects it to remain visible — specifically above the Character Description card.

## Plan

### File: `src/components/ai-twin/TwinDetailPanel.tsx`

1. **Make the save banner sticky** — Add `sticky top-0 z-10` classes to the save banner div so it stays pinned at the top of the scrollable dialog as the user scrolls down. This keeps it always visible above the Character Description and all other sections.

That's it — one class change on the existing banner div at line 828. No structural moves needed since it's already the first element in the component.

