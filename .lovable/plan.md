

# Fix: Friendly Error Messages for AI Credit / Edge Function Failures

## Problem

The edge function logs show three distinct billing/credit failures happening right now:
1. **OpenAI billing limit reached** — `"Billing hard limit has been reached"` (400)
2. **OpenAI quota exceeded** — `"You exceeded your current quota"` (429)  
3. **Anthropic credit balance too low** — `"Your credit balance is too low"` (400)

These raw errors bubble up as generic "Generation Failed" toasts with technical error messages. Users on the live site see confusing messages instead of a friendly explanation.

## What Will Change

### 1. Centralized error classifier utility
Create `src/lib/errorClassifier.ts` — a small helper that inspects error messages and returns a user-friendly title + description. It will detect patterns like:
- Billing/credit/quota keywords → "Our AI services are temporarily at capacity. Please try this feature again later."
- Rate limit (429) → "Too many requests. Please wait a moment and try again."
- Timeout → "This is taking longer than expected. Please try again."
- Generic fallback → "Something went wrong. Please try again later."

### 2. Update the `ai` edge function to return friendly errors
In `supabase/functions/ai/index.ts`, catch OpenAI billing errors (400 with `billing_hard_limit_reached` or 429 with `insufficient_quota`) and return a structured error with a `userMessage` field like `"Our AI services are temporarily unavailable. Please try again later."` instead of raw API errors.

### 3. Update the `_shared/claude.ts` helper
When Claude returns a credit-related 400 error, wrap it with a friendly message before throwing, so all functions using `callClaude` get the friendly error automatically.

### 4. Update AI Spokesperson error handlers
In `src/pages/AISpokesperson.tsx`, update the ~5 main catch blocks (script generation, video generation, preview generation, version B) to use the error classifier so toasts show friendly messages instead of raw `err.message`.

### 5. Apply same pattern to other pages that call edge functions
Update error handlers in:
- `src/components/ai-twin/TwinCreationWizard.tsx`
- `src/components/ScriptGenerator.tsx`
- Any other component directly invoking edge functions with raw error toasts

## Technical Details

**Error classifier** (new file):
```typescript
// src/lib/errorClassifier.ts
export function getFriendlyError(error: any): { title: string; description: string } {
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  
  if (msg.includes('billing') || msg.includes('quota') || msg.includes('credit') || msg.includes('insufficient')) {
    return { title: 'Service Temporarily Unavailable', description: 'Our AI services are at capacity. Please try this feature again later.' };
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return { title: 'Too Many Requests', description: 'Please wait a moment and try again.' };
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { title: 'Request Timed Out', description: 'This is taking longer than expected. Please try again.' };
  }
  return { title: 'Something Went Wrong', description: 'Please try this feature again later. If the issue persists, contact support.' };
}
```

**Edge function changes** — the `ai/index.ts` function will parse OpenAI error bodies for `billing_hard_limit_reached` and `insufficient_quota` codes, returning `{ error: "...", userMessage: "..." }` with a 503 status instead of 500.

**Claude helper** — `callClaude` will detect the "credit balance is too low" message and throw a `ClaudeError` with a friendly message.

**Files to modify:**
- `src/lib/errorClassifier.ts` (new)
- `supabase/functions/ai/index.ts`
- `supabase/functions/_shared/claude.ts`
- `src/pages/AISpokesperson.tsx`
- `src/components/ai-twin/TwinCreationWizard.tsx`
- `src/components/ScriptGenerator.tsx`

