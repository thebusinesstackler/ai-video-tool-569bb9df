

## Problem

The script generator creates visually impressive but **topic-disconnected** scene descriptions. When generating a reel about "Ghost Marketer Strategy," every scene shows a person holding a bottle because:

1. The prompt tells the AI to show "people with CLOSED MOUTHS... posing, or doing activities" but never says **which** activities — so the AI defaults to generic stock-photo visuals
2. There's no instruction linking `visualDescription` to `narration` content
3. The character templates and placeholder examples all mention "holding a bottle," biasing the AI model
4. The example JSON template in the prompt shows a generic `SUBJECT: [pose, expression]` without tying it to the topic

## Plan

### 1. Add visual-narrative alignment rules (`generate-reel-script/index.ts`)

Insert a new `VISUAL-NARRATIVE ALIGNMENT (CRITICAL)` section into the system prompt that mandates:
- The `visualDescription` MUST visually represent what the `narration` is about
- If narration discusses marketing → show marketing-related visuals (laptop with analytics, whiteboard with strategy)
- If narration discusses fitness → show gym, workout, supplements
- Validation check: "If someone watched this scene on mute, would they understand the topic?"
- NEVER default to generic "person holding a product" unless the topic IS about a product

### 2. Fix the "closed mouths" instruction to be topic-aware

Update line ~319 to replace the generic "doing activities" guidance with:
- "Show the character performing actions DIRECTLY RELATED to the narration topic"
- Add examples: topic about cooking → character in kitchen; topic about business → character at desk with relevant props
- Keep the closed-mouth rule but make the poses/actions match the script content

### 3. Update the example JSON template

Change the `SUBJECT` field in the example (line ~381) from generic `[pose, expression]` to:
- `SUBJECT: [exact character description performing action RELATED to the narration content]`
- Add a note: "The action/props must reflect the topic, not generic stock photography"

### 4. Remove bias from placeholder examples

Update `AICharacterCreator.tsx` placeholder text (line ~56 and ~646) to use diverse examples instead of always "holding a bottle":
- Mix examples: "presenting at a whiteboard," "typing on a laptop in a modern office," "cooking in a bright kitchen"

### Files to modify
- `supabase/functions/generate-reel-script/index.ts` — Add visual-narrative alignment rules, fix activity guidance, update example JSON
- `src/components/AICharacterCreator.tsx` — Diversify placeholder examples to remove bottle bias

