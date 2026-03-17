

## Plan: Persistent WaveSpeed Task Tracking

### Problem
When a WaveSpeed video task is created but the browser tab closes or polling fails, the task ID is lost forever. There's no way to recover the completed video.

### Solution
Create a `video_tasks` table to log every WaveSpeed task at creation time, then update it when status changes. Add a recovery UI to retry lost tasks.

### 1. Create `video_tasks` table (migration)

```sql
CREATE TABLE public.video_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'pending',
  video_url text,
  source text, -- 'reel', 'movie', 'spokesperson', 'hook'
  source_id uuid,
  scene_number integer,
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies (user-scoped CRUD)
CREATE POLICY "Users can view own tasks" ON public.video_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.video_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.video_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.video_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

### 2. Update `wavespeed-video/index.ts` edge function
- After successful `create` response (line ~557), use the service role Supabase client to insert a row into `video_tasks` with `task_id`, `model`, `status: 'pending'`, and metadata from the request (prompt, source info passed via new optional params `userId`, `source`, `sourceId`, `sceneNumber`).
- After successful `status` check that returns `completed` or `failed`, update the matching `video_tasks` row with the new status and `video_url`.

### 3. Update `src/lib/wavespeed.ts`
- Extend `createWaveSpeedVideo` params to accept optional `source`, `sourceId`, `sceneNumber` and pass them through to the edge function.

### 4. Update `src/pages/Reels.tsx`
- Pass `source: 'reel'` and scene metadata when calling `createWaveSpeedVideo`.
- Add a "Recover Videos" button in the My Reels section that:
  - Queries `video_tasks` for rows where `status` is not `completed` and not `failed`
  - Re-polls each task ID via `getWaveSpeedVideoJob`
  - Updates the DB row and shows recovered videos to the user

### Files to change
- **New migration** -- `video_tasks` table + RLS
- **`supabase/functions/wavespeed-video/index.ts`** -- log create + update status
- **`src/lib/wavespeed.ts`** -- pass source metadata
- **`src/pages/Reels.tsx`** -- pass metadata + recovery UI button

