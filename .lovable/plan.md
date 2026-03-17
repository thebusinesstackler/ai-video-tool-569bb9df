

# Fix Broken Scripts: Truncated Text, Trailing Commas, Bloated Prompts

## Root Causes Found

### 1. `formatScriptForTTS` creates trailing commas (THE main bug)
Line 667: `.replace(/\.(\s|$)/g, ',$1')` converts ALL sentence-ending periods into commas. So a perfectly fine narration like `"He is walking down the street."` becomes `"He is walking down the street,"` — ending mid-thought with a dangling comma. This is why scripts look incomplete.

### 2. `getDefaultIntroText` truncates topics mid-word
Line 682: `topic.split(' ').slice(0, 5).join(' ')` blindly takes the first 5 words. If the topic is "How to build a successful business in 2024", it becomes "How to build a successful" — an incomplete fragment. Combined with the trailing comma bug above, the intro reads like garbage.

### 3. `getDefaultOutroText` still uses em dashes
Lines 708-725: Every default outro template contains em dashes (`—`) which get converted to commas by `formatScriptForTTS`, producing double commas and awkward endings like `"follow along, there's a lot more coming,"`.

### 4. Visual description prompts are absurdly complex
Lines 338-345 (system prompt) + line 397 (user prompt): The template demands lens mm, f-stop, camera brand names, bokeh particles, volumetric light, color grade labels — the image model gets overwhelmed and ignores the important parts (character facing camera, topic-relevant action).

### 5. No post-parse validation on narration
After JSON parse (line 494-502), narration is only run through `formatScriptForTTS`. There's no check for incomplete sentences, trailing articles ("the,"), or fragments.

---

## Implementation Plan

### Fix 1: Rewrite `formatScriptForTTS` (line 653-677)
- **Remove** the period-to-comma replacement entirely (line 667). Periods are fine for TTS — they create natural pauses.
- Keep the em dash, ellipsis, and smart quote replacements.
- Add: trim trailing commas/prepositions from the final result.

### Fix 2: Rewrite `getDefaultIntroText` (line 680-699)
- Replace `topic.split(' ').slice(0, 5)` with smart truncation: if the topic is under 60 chars, use it whole. Otherwise, find the last natural break (comma or word boundary) before 60 chars.
- Ensure all template strings end with complete thoughts, not fragments.

### Fix 3: Rewrite `getDefaultOutroText` (line 702-727)
- Remove all em dashes (`—`) from template strings. Replace with commas or complete sentences.
- Ensure every outro ends with a complete sentence, not a dangling connector.

### Fix 4: Simplify visual description prompts
- **System prompt (lines 338-345):** Replace the "PREMIUM CINEMATOGRAPHY" block with a simpler directive:
  ```
  VISUAL STYLE: Describe each scene simply:
  - SUBJECT: Who/what, their action, expression, pose
  - SETTING: Location and key props
  - MOOD: Lighting quality and color tone (2-3 words)
  Do NOT include lens mm, f-stop, camera brand names, or particle effects.
  ```
- **User prompt (line 397):** Replace the massive template string with:
  ```
  "visualDescription": "SUBJECT: [character description, action]. SETTING: [location]. MOOD: [lighting, color tone]"
  ```

### Fix 5: Add narration validation after parse (after line 498)
- After `formatScriptForTTS`, check if narration ends with a trailing article/preposition (`a`, `the`, `an`, `of`, `in`, `to`, `for`, `with`, `on`, `at`, `by`). If so, trim the trailing word.
- Check if narration ends with a comma — if so, replace with period or remove.
- Log a warning for any scene that had to be trimmed.

### File
- `supabase/functions/generate-reel-script/index.ts` — all five fixes in one file, auto-redeploys.

