

# Reduce Sidebar Navigation — Combined Approach

## Strategy: Spacing reduction + collapsible groups

With 13 nav items at 701px viewport height, both approaches together will definitively eliminate the scrollbar.

### 1. Reduce spacing (same as before)
- Nav items: `py-3` → `py-2`, `space-y-2` → `space-y-1`
- Logo: `mb-8` → `mb-4`
- Usage stats: `p-4` → `p-3`, `mt-4` → `mt-2`
- Sign-out: `mt-4` → `mt-2`

### 2. Group items under collapsible sections
Organize the 13 items into logical groups using `Collapsible` from Radix (already installed):

**Create** (default open if any child is active route)
- Movie Scene Creator
- Movies
- Script Generator
- Reels & Stories

**AI Tools** (collapsible)
- AI Twin
- AI Spokesperson
- Testimonial Ads
- Commercial Studio

**Manage** (collapsible)
- Image Gallery
- Characters
- Projects

**Dashboard** and **Settings** stay as standalone top/bottom items (not grouped).

Each group header is clickable to expand/collapse, showing a chevron. The group containing the active route auto-expands. This reduces visible items from 13 to ~5-7 at any time.

### Files changed
- `src/components/Navigation.tsx` — restructure nav items into groups, reduce spacing, add collapsible wrappers

