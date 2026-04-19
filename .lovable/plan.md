
## Plan — Fix Sora product fidelity, motion accuracy, and audio quality

### Problem analysis (3 issues)

1. **Product image not reaching Sora correctly** — Sora 2 / Sora 2 Pro accept an image input, but Video Repo currently passes only the *script's text description* of the product. The actual product image URL from the Product Library isn't being injected as a strong reference into the video generation call, so Sora invents its own version of the product.

2. **Motions are off (e.g., "two drops" rendered as one)** — The script-level instructions like "place 2 drops in the water" get summarized away in the 180–280 word prompt. Sora doesn't get a tight, literal **action manifest** of countable beats, so it improvises.

3. **Voice / audio quality** — Sora 2 (non-Pro) generates lower-bitrate native audio. Sora 2 **Pro** has noticeably cleaner broadcast-grade audio. Right now T2V already routes to Pro, but **image-to-video (the main flow)** still defaults to plain Sora 2 unless the user manually toggles "Pro." That's why audio sounds off.

### Files to change
- `src/pages/VideoRepo.tsx`
- `supabase/functions/wavespeed-video/index.ts` (verify image is passed through cleanly to Sora 2 Pro I2V — already supported, no change expected)

### Changes

#### 1. Always pass the persistent product image URL to Sora as an image reference
In `analyzeAndGenerate`, when `persistentImageUrl` exists and we're routing to a Sora model (sora-2 or sora-2-pro), continue to pass `imageUrls: [persistentImageUrl]` (already happens). Add a log + UI status confirming "🔒 Locking product to: <image>".

Add a stronger **visual-fidelity directive** to the script prompt when a product image is attached:

> "PRODUCT FIDELITY: The attached image is the EXACT hero product. Sora MUST keep label text, color, bottle/box shape, and proportions pixel-identical to the reference. Do NOT redesign, restyle, or invent variants."

#### 2. Add a literal "Action Manifest" to the script template
Update the analysis instruction so the script returns, in addition to timed beats, a concrete **bullet list of countable physical actions** that the video generator must execute literally. Example output:
```
ACTION MANIFEST (Sora must execute exactly):
- Hand picks up dropper from bottle
- Squeeze dropper TWO times over water glass (count: 2 drops)
- Liquid swirls clockwise
- Hand lifts glass to camera
```
Then enforce in the video-prompt block: "Follow the ACTION MANIFEST literally — counts (e.g. 'two drops') are non-negotiable."

#### 3. Auto-upgrade I2V to Sora 2 Pro for audio quality
When a product image is attached AND the user hasn't already turned on Product Lock (which uses Wan 2.5), auto-route to **`sora-2-pro` at 1080p** (instead of plain `sora-2`) so audio is broadcast-grade. Update the chat status message to say "⭐ Auto-upgraded to Sora 2 Pro for broadcast-grade audio + product fidelity."

Keep the manual `useSoraPro` toggle so the user can still force it; just no longer require the toggle to get Pro when an image is present.

#### 4. Pass image cleanly via URL (no base64 needed)
The existing pipeline already uploads the product to Supabase Storage and passes a public URL to Sora — that's the correct path. No base64 conversion needed (Sora API takes the URL directly). Verify by ensuring `persistentImageUrl` is the storage URL, not a `blob:` URL (already guarded).

### Out of scope
- Changing the Wan 2.5 / "Product Lock" path (already pixel-accurate).
- Multi-shot storyboards.
- Voice cloning — still uses Sora's native audio.
