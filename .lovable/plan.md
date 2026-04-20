

## Fix blank black tiles in Video Library

Those tiles ARE videos (real `.mp4` files from Sora/Veo/Wan CDNs) — they just aren't rendering a preview frame. The `#t=0.5` media-fragment trick and the `currentTime = 0.1` fallback both fail silently on cross-origin CDN videos because the browser refuses to decode a frame from a tainted source without `crossOrigin="anonymous"`, and many of these CDNs don't return permissive CORS headers. Result: a black `<video>` element sitting on top of the gradient + Film icon placeholder, hiding it.

### What I'll change (single file: `src/pages/VideoRepoPro.tsx`)

**1. Generate a real thumbnail on first render, cache it in component state**

Add a `libraryThumbs: Record<string, string>` state (keyed by project id → data URL). For each Library card without a thumbnail yet, run a `captureThumbnail(url)` helper that:

- Creates a hidden `<video crossOrigin="anonymous" muted preload="auto">`, seeks to 0.5s, draws the frame to a canvas, returns a JPEG data URL.
- If the canvas draw throws `SecurityError` (CORS-tainted), falls back to: `fetch(url)` → `blob()` → `URL.createObjectURL(blob)` → load that into the video (same-origin blob URL, decodes cleanly) → draw frame.
- If the fetch also fails (rare CORS-blocked CDN), resolves to `null` and the card keeps the gradient + Film placeholder + the existing video tag (no regression).

Run this lazily, max 4 in parallel, only for currently-visible Library cards.

**2. Persist the thumbnail so it doesn't regenerate every visit**

Add a `thumbnail_url TEXT` column to `video_repo_projects` via a migration. After a successful canvas capture, upload the JPEG to the existing `project-files` Supabase Storage bucket at `thumbnails/{projectId}.jpg` and save the public URL on the row. On subsequent loads the card uses `project.thumbnail_url` as the `<img>` poster instantly — no video decode needed.

**3. Replace the broken preview `<video>` with an `<img>` when a thumbnail exists**

```text
Card preview area:
  if (isPlaying)          → full <video controls autoPlay>
  else if (thumbnail)     → <img src={thumbnail}> + hover Play button
  else                    → gradient + Film icon + hover Play button
                            (kick off captureThumbnail in background)
```

This eliminates the black-video-on-top-of-placeholder problem entirely.

**4. Keep existing behavior intact**

- Hover-to-play, Favorite, Review, Download, Delete buttons unchanged.
- Same fix is NOT needed in History tab (it uses the same pattern but isn't what the user reported); I can apply it there too if you want — flag below.

### Files touched

- `src/pages/VideoRepoPro.tsx` — new `captureThumbnail` helper, `libraryThumbs` state, thumbnail-first render in Library cards, background upload to storage.
- `supabase/migrations/<new>.sql` — `ALTER TABLE video_repo_projects ADD COLUMN thumbnail_url TEXT;`
- (Auto-regenerated) `src/integrations/supabase/types.ts`.

### What this fixes vs. doesn't

- ✅ Fixes: blank black tiles for any video whose CDN allows fetch-as-blob (covers Sora, Veo, Wan, Creatomate — all tested previously in this codebase).
- ⚠️ Edge case: a CDN that blocks both canvas decoding AND fetch CORS → tile shows the Film icon placeholder (still better than a black square) and the video plays normally on hover/click.

