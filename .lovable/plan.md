

## Fix Mobile Navigation and Add Scroll-to-Top

### Problems
1. Mobile header bar uses `bg-sidebar-background` which is near-black in dark mode — text/icons invisible
2. Mobile header shows a generic sparkle icon + "VideoAI Pro" text instead of the actual logo
3. Pages don't scroll to top on route change
4. Mobile slide-out drawer also has dark background issues

### Changes

**1. ScrollToTop component** — `src/components/ScrollToTop.tsx`
- New component using `useLocation` to call `window.scrollTo(0, 0)` on every pathname change
- Add it inside `BrowserRouter` in `src/App.tsx`

**2. Mobile header bar** — `src/components/Navigation.tsx` (lines 260-280)
- Change header background from `bg-sidebar-background` to `bg-white dark:bg-gray-900` for solid, visible backgrounds in both themes
- Replace the sparkle icon + "VideoAI Pro" text with the actual logo images (`logoLight`/`logoDark`), sized appropriately (e.g. `h-8`)

**3. Mobile slide-out drawer** — same file, line 269
- Update `SheetContent` background to `bg-white dark:bg-gray-900` to ensure readability in dark mode

### Files to create/edit
- **Create**: `src/components/ScrollToTop.tsx`
- **Edit**: `src/App.tsx` — import and add `<ScrollToTop />` inside router
- **Edit**: `src/components/Navigation.tsx` — fix mobile header background, replace icon with logo, fix drawer background

