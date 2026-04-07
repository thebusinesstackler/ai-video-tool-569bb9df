

# Fix Text Garbling in Animate Statics Prompts

## Problem
The AI video model (WaveSpeed Wan 2.5 i2v) cannot reliably render text. When given any prompt, it regenerates text from scratch and misspells it (e.g., "One drop. Three mushrooms." becomes "Sne soft imgluct pwcath."). The current prompts don't explicitly instruct the model to leave text untouched — they only say elements should "remain frozen," which the video model interprets as keeping position, not preserving the actual rendered characters.

## Root Cause
AI video models are notoriously bad at generating text. The `[PRESERVE EXACTLY: ...]` prefix lists objects but doesn't specifically tell the model to **not regenerate or alter any text/lettering**. The model sees text areas and attempts to re-render them each frame, resulting in garbled output.

## Fix

### 1. Edge function prompt update (`supabase/functions/analyze-animate-image/index.ts`)

Add a dedicated **TEXT PRESERVATION** section to the system prompt:
- Add rule: "The video model CANNOT accurately regenerate text. All prompts MUST instruct the model to treat text areas as static textures — do NOT re-render, redraw, or alter any lettering, words, or characters."
- Add to every prompt format: "All text, lettering, and typography in the image must be treated as a fixed texture — do not regenerate, redraw, or alter any characters."
- In the objects list instruction: "For every text element, transcribe the EXACT wording (e.g., 'Text: One drop. Three mushrooms. All for her.')"

### 2. Preservation anchor update (`src/pages/AnimateStatics.tsx`)

Update `buildFinalPrompt()` to extract text-specific objects from the analysis and add a stronger text-freeze instruction:
- Filter `analysis.objects` for items starting with "Text:" and build a separate text anchor
- Append: `[TEXT FREEZE: All visible text and lettering must remain exactly as shown — treat as fixed texture, do not regenerate any characters.]`

### Files Modified
- `supabase/functions/analyze-animate-image/index.ts` — add text preservation rules to system prompt and tool descriptions
- `src/pages/AnimateStatics.tsx` — enhance `buildFinalPrompt()` with text-freeze anchor

