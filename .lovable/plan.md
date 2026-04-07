

# Fix Animate Statics: Resilient Polling for Video Generation

## Problem
The animation generation fails mid-polling because the `while (!done)` loop in `startGeneration` has zero error tolerance. A single network hiccup during any of the status polling calls causes the entire generation to abort with "Generation failed", even though the WaveSpeed task is still processing successfully in the background.

The edge function logs confirm the task (id: `eb3d9e43...`) is actively `processing` — it's the client-side polling that breaks.

## Fix

### 1. Add retry logic to polling loop (`src/pages/AnimateStatics.tsx`)
- Wrap `getWaveSpeedVideoJob(taskId)` in a try/catch inside the while loop
- Allow up to 3 consecutive failures before giving up
- Reset the failure counter on any successful poll
- Increase poll interval slightly (5s instead of 4s) to reduce edge function pressure
- Add a maximum poll duration (5 minutes) to prevent infinite loops

### 2. Add retry logic to the status helper (`src/lib/wavespeed.ts`)
- In `getWaveSpeedVideoJob`, catch the `FunctionsFetchError` and retry once after a 2-second delay before throwing
- This makes polling resilient across all pages that use this function, not just Animate Statics

## Changes

**`src/lib/wavespeed.ts`** — Add single retry with delay in `getWaveSpeedVideoJob` for transient network errors.

**`src/pages/AnimateStatics.tsx`** — Add consecutive failure counter (max 3) and 5-minute timeout to the polling loop. On transient failure, continue polling instead of aborting.

