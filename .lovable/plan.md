

## Problem Analysis

Two issues with the Script Generator → Reels import flow:

**Issue 1: Character description used as voiceover text**
In `ScriptGenerator.tsx` (line 1074-1077), the "Use in Reel" button maps `scene.description` to both `narration` and `visualDescription`. But `scene.description` comes from the "clean script" which the `generate-script` edge function explicitly produces as visual-only descriptions (character appearance, actions, camera angles). The actual spoken narration exists in the `detailedScript` but is never parsed out separately.

**Issue 2: Can't generate voiceover with a different voice before preview**
After importing scenes to Reels, users are locked to their AI Twin's default voice. There's no way to select a standalone TTS voice/model to generate and preview voiceovers per-scene before committing to video generation.

---

## Plan

### 1. Update `generate-script` edge function to return structured scenes
Modify the prompt to request a third output format: a JSON array of scenes, each with separate `narration` (spoken text) and `visualDescription` (video generation prompt). Update the response to include a `scenes` array.

```
{ detailedScript: "...", cleanScript: "...", scenes: [
  { narration: "What you hear", visualDescription: "What you see" }, ...
]}
```

### 2. Fix ScriptGenerator scene parsing and "Use in Reel" mapping
- When `data.scenes` array exists from the edge function, use it directly instead of `parseScriptIntoScenes`.
- Display both narration and visual description separately in the Scene Preview tab (two textareas per scene).
- Map correctly on "Use in Reel": `narration` → `narration`, `visualDescription` → `visualDescription`.

### 3. Add voice selector in the Scene Scripts review section on Reels
After scenes are imported (before video generation), add a voice control strip that lets users:
- Pick a TTS voice (independent of AI Twin) from existing `VoiceSelector` component
- Generate a voiceover preview per-scene with a play button
- This gives users control over the voice before hitting "Make My Reel"

### Files to change
- **`supabase/functions/generate-script/index.ts`** — update prompt for structured scene output with separate narration + visual
- **`src/components/ScriptGenerator.tsx`** — parse structured scenes, show dual fields, fix "Use in Reel" mapping
- **`src/pages/Reels.tsx`** — add voice selector + per-scene TTS preview in the scene review step

