

## Problem

When the user resizes the screen while using the product swap feature in Quick/Easy mode, the product swap state is lost and the UI resets. This happens because:

1. **`ProductSwapPanel` stores all state locally** — `selectedProductUrl`, `productPrompt`, `isSwapping`, `showLibrary` are local state inside the component. When the parent re-renders due to `isMobile` changing at the 768px breakpoint, the component can unmount/remount and lose this state.

2. **Layout shift on resize** — The main content area switches between `p-0 pb-24` (mobile) and `p-6 pb-24` (desktop), and the sidebar conditionally renders/hides, causing the content to reflow and potentially confuse users.

3. **No state persistence** — The product swap workflow has no mechanism to preserve mid-operation state across re-renders.

## Plan

### 1. Lift product swap state to Reels.tsx parent
**File**: `src/pages/Reels.tsx`

- Add parent-level state for active product swap: `activeSwapProductUrl`, `activeSwapPrompt`
- Pass these as props to `ProductSwapPanel` so they persist across re-renders
- When the user selects a product in the swap panel, update parent state

### 2. Make ProductSwapPanel controlled
**File**: `src/components/ProductSwapPanel.tsx`

- Accept optional `initialProductUrl` and `initialPrompt` props
- Initialize local state from props so state survives parent re-renders
- Add `onProductSelected` callback to sync selection back to parent

### 3. Stabilize layout on resize
**File**: `src/pages/Reels.tsx`

- Use CSS `transition-all` on the main content wrapper so layout changes are smooth rather than abrupt
- Ensure the Quick mode card and its children don't unmount when `isMobile` toggles — currently the Quick mode sections don't depend on `isMobile`, but verify no intermediate wrapper causes remounting

### 4. Prevent useIsMobile flash
**File**: `src/hooks/use-mobile.tsx`

- Initialize `isMobile` state with a synchronous check (`window.innerWidth < 768`) instead of `undefined` to prevent the initial `false → true` flash that causes an extra re-render on mobile devices
- This eliminates one unnecessary unmount/remount cycle on page load

### Technical Details

- **`use-mobile.tsx`**: Change `useState<boolean | undefined>(undefined)` to `useState(() => window.innerWidth < MOBILE_BREAKPOINT)` — this removes the initial undefined state and the double-render
- **`ProductSwapPanel.tsx`**: Add `selectedProductUrlProp?: string | null` and `onProductChange?: (url: string | null) => void` props. Use `useEffect` to sync prop → local state only on mount, keeping local state as source of truth during interaction
- **`Reels.tsx`**: Add `swapPanelProductUrl` state. Pass to all `ProductSwapPanel` instances. This state persists across `isMobile` toggles since it lives at the page component level

