

## AI Spokesperson: Show Twin Selector Immediately Instead of Auto-Loading

### Problem
The page fetches all twins (including heavy `reference_images` arrays) and auto-selects the first one, making the user wait. The user wants to pick the twin themselves for a faster start.

### Changes

**`src/pages/AISpokesperson.tsx`**

1. **Switch to lightweight `get_twins_summary` RPC** — Replace the direct `ai_twins` table query (line 212-216) with `supabase.rpc('get_twins_summary', { _user_id: user.id })`. This returns only metadata + a single thumbnail, loading much faster.

2. **Remove auto-select** — Delete lines 223-226 that auto-select the first twin. The selector starts empty, user picks.

3. **Remove loading spinner gate** — Instead of showing "Loading twins..." and blocking the UI (line 2312-2315), show the twin selector immediately once data arrives. Since the RPC is fast, the spinner will barely flash.

4. **Lazy-load full images on selection** — When the user picks a twin, fetch the full `reference_images` from the table only for that twin (needed for video generation). Store it on the selected twin object.

### What stays
- Twin selector UI (grid of twin cards + dropdown)
- Draft restoration of `selectedTwinId`
- All video generation logic unchanged

