

## Problem Analysis

Three issues identified:

1. **Closing scene script is generic** — The last scene prompt says "Deliver the payoff, conclusion, or call-to-action" but gives no guidance on writing a proper spoken CTA that ties back to the topic. The outro template system (`getDefaultOutroText`) returns static text like "Follow for more!" with zero connection to the content.

2. **Outro video is not creative** — The Sora 2 outro prompt (line 669-677) is generic: *"Elegant slow zoom out with atmospheric lighting"*. It doesn't reference the topic, the character, or the CTA text. The visual description from `getOutroVisualDescription` just describes abstract icons (animated follow buttons, share arrows) — not an actual video-worthy visual tied to the content.

3. **Hook scene doesn't use video-extend** — Intro scenes are routed to Sora 2 (line 644-660) with a generic zoom-in prompt. They skip the video-extend pipeline entirely, missing the cinematic AI super-prompted motion that narrator scenes get. The hook — the most critical scene — gets the least creative video treatment.

## Plan

### 1. Fix closing scene script generation (`generate-reel-script/index.ts`)

Update the last scene (CLOSE) instructions to write a **spoken CTA** that:
- Wraps up the topic naturally (not just "Follow for more!")
- Ties back to the hook promise ("Remember when I said X? Here's what to do next...")
- Includes the actual call-to-action woven into natural speech
- If an outro template is selected, the closing narration should set up a natural transition to it

Update `getDefaultOutroText()` to generate topic-aware outro text instead of static strings. Pass the `topic` parameter and write CTAs like: *"If you want more strategies like this... hit that follow button—"*

### 2. Make outro video creative (`generate-reel-video/index.ts`)

Update the Sora 2 outro prompt (lines 662-677) to:
- Include the topic and character description in the prompt
- Reference the CTA text so the visual matches (e.g., if it's a "follow" CTA, show the character gesturing invitingly)
- Use the same AI super-prompt technique as video-extend scenes — call the AI gateway to generate a cinematic motion prompt specific to this outro
- Pass character description so the outro features the same person, not abstract icons

### 3. Route hook/intro scenes through video-extend (`generate-reel-video/index.ts`)

When lip sync is enabled and `videoModel === 'wan-2.5-video-extend'`, route intro scenes through the same two-step pipeline (base video + video-extend with AI super prompt) instead of Sora 2. This gives the hook scene:
- The same cinematic motion quality as content scenes
- Character consistency (uses the portrait image)
- AI-generated motion prompts specific to the hook content

Keep Sora 2 as fallback for non-lip-sync intros.

### 4. Topic-aware outro visual descriptions (`generate-reel-script/index.ts`)

Update `getOutroVisualDescription()` to accept `topic` and `characterDescription` parameters so the generated image prompt shows the character in a closing pose relevant to the topic, not abstract social media icons.

### Files to modify
- `supabase/functions/generate-reel-script/index.ts` — Topic-aware closing scripts, outro text, and outro visuals
- `supabase/functions/generate-reel-video/index.ts` — Creative outro prompts with character/topic context, video-extend routing for hook scenes

