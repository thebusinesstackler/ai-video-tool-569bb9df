## Problem

The Video Repo page is injecting "Lifecykel" branding (mushroom extracts, Lion's Mane, Reishi, etc.) into AI generation prompts even when the logged-in user's profile has no relation to that brand.

## Root Cause

In `src/pages/VideoRepo.tsx` (lines 1180–1182), the `autoGenerateMotionVideo` function builds a `brandLine` for the AI prompt:

```ts
const brandLine = brandProfile
  ? `Brand: ${brandProfile.company_name || 'Lifecykel'}${...}. ${brandProfile.brand_description || ''}`
  : 'Brand: Lifecykel — premium mushroom extract drops (Lion\'s Mane, Reishi, Cordyceps, Chaga, Turkey Tail, Tremella). Wellness ritual, feminine, bright daylight.';
```

Two leaks:
1. If `brandProfile` exists but `company_name` is empty → falls back to the literal string `'Lifecykel'`.
2. If `brandProfile` is null entirely → falls back to a fully Lifecykel-themed paragraph.

Either path silently brands every motion video generated on accounts that haven't filled out their profile (e.g. your current account).

A similar but lighter mention exists in `src/pages/VideoRepoPro.tsx` line 1926 ("TheraNovex healthcare & Lifecykel wellness") inside the AI Reel Director system brief — also a hardcoded brand reference that should be made generic.

## Fix

### 1. `src/pages/VideoRepo.tsx` — replace brand fallback with neutral, profile-driven text

Replace the hardcoded `brandLine` with a generic version that uses whatever profile data exists, and falls back to a brand-neutral instruction when nothing is set:

- If `brandProfile.company_name` exists → use it verbatim, no fallback name.
- If `brandProfile` has a `brand_description` → use it.
- If neither exists → emit a neutral line like `"Brand: (no brand profile set — keep visuals product-focused and generic; do not invent a brand name or category)."`
- If `productName` is known, weave that in instead of assuming "mushroom extract drops".

Also rewrite the `productHint` "Subject: a premium dropper bottle of mushroom extract..." default (line 1190) to a neutral subject line that uses `productName` when available, otherwise just says `"Subject: the product provided by the user."`

### 2. `src/pages/VideoRepoPro.tsx` line 1926 — neutralize the director brief

Change `"a high-performance UGC ad platform (TheraNovex healthcare & Lifecykel wellness)"` to `"a high-performance UGC ad platform"` — those two brand names should not bleed into every user's prompt.

### 3. Sanity sweep (no edits needed, just verifying)

- `supabase/functions/podcast-director/index.ts` — already correctly gated behind a `/lifecykel/i` check on `brandName`/`userEmail`/`websiteUrl`. Won't trigger for unrelated accounts. ✅
- `supabase/functions/generate-hooks/index.ts` — uses Lifecykel only as a one-line "EXAMPLE PRODUCT" inside the system prompt. Low risk but I'll genericize it to "EXAMPLE PRODUCT: a wellness supplement brand" so it can't bias outputs.
- `supabase/functions/chatcut-director/index.ts` — references Lifecykel as a spelling/vocab guard (only activated when brand vocabulary actually contains it) and one example payload. Safe to leave; not leaking into unrelated accounts.

## Files to edit

- `src/pages/VideoRepo.tsx` (brand fallback + product subject default)
- `src/pages/VideoRepoPro.tsx` (director brief intro line)
- `supabase/functions/generate-hooks/index.ts` (genericize example product line)

No database, no schema, no new dependencies.
