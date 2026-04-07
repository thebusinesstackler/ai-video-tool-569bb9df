

# Save Brand Analysis as Draft on Lifestyle Stories

## What Changes

When a brand URL is analyzed, immediately save a `lifestyle_stories` record with `status: 'draft'`. On page load, fetch existing drafts so the user can resume from where they left off. Each subsequent step (concepts generated, concept selected) updates the same record rather than creating a new one.

## Plan

### 1. Save draft after brand analysis
In `analyzeBrand()`, after receiving the analysis, insert a new `lifestyle_stories` row with `status: 'draft'`, `brand_url`, `brand_analysis`, and `title` (brand name). Store the returned row ID in state (`storyId`).

### 2. Update draft on subsequent steps
- In `generateConcepts()`, update the existing row with concepts, duration, and selected video types.
- In `selectConceptAndGenerate()`, update the existing row instead of inserting a new one (remove the current insert, use update with `storyId`).

### 3. Load existing drafts on page load
- Add a `useEffect` that fetches the user's `lifestyle_stories` ordered by `updated_at DESC`.
- Show a "Recent Drafts" section on the URL step with cards showing brand name, URL, and date.
- Clicking a draft restores `brandAnalysis`, `editedProductType`, `concepts`, `url`, and navigates to the appropriate step.

### 4. UI additions
- Small "Saved Drafts" list on the first step (URL entry) showing recent brand analyses.
- Each draft card shows brand name, URL snippet, and last updated time.
- A "Resume" button that loads the draft state and jumps to the analysis or concepts step.

### File Modified
- `src/pages/LifestyleStories.tsx` — add `storyId` state, draft save/load logic, drafts UI section

