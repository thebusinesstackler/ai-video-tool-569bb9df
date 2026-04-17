
The user reports the main app sidebar flashes/jumps occasionally. Let me investigate.

Looking at `src/components/Layout.tsx`: the main content margin is controlled by `isCollapsed` state, which is initialized from `localStorage` (`SIDEBAR_COLLAPSED_KEY`). The `<main>` uses `${isCollapsed ? 'ml-16' : 'ml-64'}` with `transition-[margin] duration-300`.

Need to check `Navigation.tsx` to see how the sidebar itself manages collapse state and whether they're in sync.
