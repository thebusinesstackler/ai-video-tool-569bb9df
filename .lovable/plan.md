
Diagnosis from code + logs:
- The failing calls are image-generation requests to `ai` using `google/gemini-3.1-flash-image-preview`.
- Edge logs show the model returned `choices[0].message.content = null` (with reasoning metadata), and the function treated this as fatal, returning 500 `"No response from AI"`.
- This means the parser is still too strict for some valid multimodal/image responses (or empty-but-nonfatal outputs).

Implementation plan:
1) Harden `supabase/functions/ai/index.ts` output parsing
- Expand extraction to support more image payload shapes:
  - `message.images[*].image_url.url`
  - `message.images[*].url`
  - `message.images[*].b64_json` / `base64` / `data` (convert to `data:image/png;base64,...` when needed)
  - content-part types beyond current ones (`output_text`, `output_image`, etc.).
- Keep text extraction robust for string and part-based content.

2) Make empty-output handling modality-aware (critical fix)
- If request includes image modality/model and no text is returned:
  - do not return 500 immediately;
  - return a safe 200 payload with `response: ""`, `imageUrl: null`, `choices`, and `warning: "empty_ai_output"`.
- Keep 500 for true hard failures (gateway non-OK, malformed upstream response, exceptions).

3) Keep API contract backward-compatible
- Continue returning:
  - `response`
  - `imageUrl`
  - `choices`
- Add optional diagnostics fields (`warning`, compact `debug`) without breaking existing callers.

4) Frontend resilience updates
- In `AISpokesperson.tsx` and `CommercialStudio.tsx`:
  - check `error` from function calls consistently;
  - if `warning: "empty_ai_output"` or no `imageUrl`, fall back to reference image and continue pipeline (no crash).
- Keep existing `data.response`-first parsing in text flows.

5) Ensure latest function deployment is active
- Redeploy `ai` function and verify requests are hitting the newest deployment version (to avoid stale behavior from older runtime versions).

Verification checklist:
- Reproduce previous failing flow (AI Spokesperson image step) and confirm no 500 from `/functions/v1/ai`.
- Confirm image call returns either usable `imageUrl` or warning payload with graceful fallback.
- Confirm text-only calls (enhance/refine/script) still return `response`.
- Confirm rate/credit errors (429/402) still surface correctly in UI.
- End-to-end test: Beginner mode message → script → image step → lip-sync video completes without blank-screen runtime error.

Technical details:
- Files to update:
  - `supabase/functions/ai/index.ts` (primary)
  - `src/pages/AISpokesperson.tsx` (fallback + warning handling)
  - `src/pages/CommercialStudio.tsx` (fallback + error handling consistency)
- No database/auth schema changes required.
