

# Fix: AI Twin Auth and Image Loading Issues

## Problem Summary
Two issues are causing the user's problems:

1. **Auth bypass masks missing session**: The `isDevPreview` flag (`src/lib/devBypass.ts`) auto-bypasses authentication on `*.lovableproject.com` domains. This lets the user into the app without a real Supabase session, so `user` is `null`. Every component that calls `supabase.auth.getUser()` or reads `user.id` from context fails silently — uploads say "Please log in," and AI Twins return empty because `user.id` is undefined.

2. **Reference images excluded from twin listing**: In `src/pages/AITwin.tsx` line 111, the SELECT query omits `reference_images`, then line 120-123 hardcodes `reference_images: []` for every twin. The `TwinCard` component relies on `reference_images[0]` for the thumbnail, so all cards appear blank.

## Plan

### 1. Remove the dev preview bypass
**Files**: `src/lib/devBypass.ts`, `src/App.tsx`, `src/pages/Index.tsx`, `src/pages/Auth.tsx`, `src/components/Dashboard.tsx`

- Change `isDevPreview` to always be `false` (or remove the bypass logic entirely)
- This forces real authentication on preview domains, ensuring `user` is populated and all data queries work

### 2. Include `reference_images` in the twin list query
**File**: `src/pages/AITwin.tsx`

- Add `reference_images` to the SELECT statement on line 111
- Remove the hardcoded `reference_images: []` mapping on lines 120-123, using the actual data from the database instead

### Why this fixes both issues
- With real auth required, the user logs in and gets a valid session. All `user.id` checks pass, uploads work, and RLS-protected queries return data.
- With `reference_images` included in the query, twin cards display their thumbnails and the image count badge shows correctly.

### Risk note on reference_images
The `reference_images` column was previously excluded to avoid JSON truncation from large base64 data. Since images have been migrated to storage URLs, re-including the column should be safe. If any twins still have base64 images, the existing migration banner will surface them.

