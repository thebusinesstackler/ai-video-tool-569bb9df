
Root cause I found:
1) `supabase/functions/ai/index.ts` currently assumes every AI response contains `choices[0].message.content` (text).
2) In image/multimodal calls (used by AI Spokesperson and Commercial Creator), the model can return images with little/no text content, so the function throws `{"error":"No response from AI"}` and returns 500.
3) Frontend consumers are inconsistent: some read `data.response`, others read `data.choices...images`, so the current edge response shape is not reliably compatible.

Plan to fix (step-by-step):
1) Harden the `ai` edge function response parser (primary fix)
   - Keep existing text behavior, but stop treating “no text” as an automatic failure.
   - Detect and extract:
     - text from `message.content` (string or content parts),
     - image output from `message.images` and content parts.
   - Return a unified payload that is backward-compatible:
     - `response` (text when present),
     - `imageUrl` (when present),
     - `choices` / original gateway fields for advanced callers.
   - Only return 500 when neither text nor image output exists.

2) Improve error propagation and observability in `ai` function
   - Add explicit 402 and 429 passthrough handling.
   - Include safer debug context (keys/finish_reason/model, truncated) when output is empty.
   - Expand CORS allow-headers to match web client headers consistently.

3) Normalize frontend AI parsing in AI Spokesperson
   - Add small local extractor helpers (`extractText`, `extractImageUrl`) and use them in:
     - Easy-mode “Enhance with AI”
     - “Refine” action
     - Script generation
     - Image generation step
   - For image generation, parse `imageUrl` first, then fallback to `choices` shape.
   - Keep graceful fallback to twin reference image so generation continues even if image generation fails.

4) Align other callers with the same contract
   - `src/pages/CommercialStudio.tsx`: read `imgData.imageUrl || imgData.choices...`.
   - `src/components/ai-twin/TwinSpeaker.tsx`: read `data.response` first, then legacy paths.
   - This removes hidden breakpoints from mixed response parsing patterns.

5) Verification checklist (end-to-end + targeted)
   - Text call to `ai` returns 200 with `response`.
   - Multimodal/image call to `ai` returns 200 with `imageUrl` and no “No response from AI” 500.
   - AI Spokesperson easy mode: generate script → generate video path completes without runtime crash.
   - Enhance and refine actions still work.
   - Commercial image generation path still works.

Technical details:
- Files to update:
  - `supabase/functions/ai/index.ts` (core)
  - `src/pages/AISpokesperson.tsx`
  - `src/pages/CommercialStudio.tsx`
  - `src/components/ai-twin/TwinSpeaker.tsx`
- No database migration needed.
- No auth schema changes needed.
- Backward compatibility strategy:
  - Preserve `response` for existing text consumers.
  - Also expose raw choice/image fields so current multimodal consumers keep working.

Expected outcome:
- The specific runtime error (`Edge function returned 500 ... No response from AI`) is eliminated for valid multimodal responses.
- AI Spokesperson easy mode becomes resilient instead of failing when the model returns image-only or non-standard text content.
