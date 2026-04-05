

# Fix: AI Video Repurposer - callClaude signature mismatch

## Problem
The `analyze-repurpose-video` edge function passes `callClaude(systemPrompt, userPrompt, { thinkingBudget })` — three positional arguments. But `callClaude` expects a single object: `{ messages: any[], system?: string, thinkingBudget?: number }`. This causes `messages is not iterable` because the first string arg gets treated as the options object.

## Fix (1 file)

**`supabase/functions/analyze-repurpose-video/index.ts`** — Update both `callClaude` calls to use the correct object signature:

```typescript
// Before (broken):
const result = await callClaude(systemPrompt, userPrompt, { thinkingBudget: 8000 });

// After (fixed):
const result = await callClaude({
  messages: [{ role: "user", content: userPrompt }],
  system: systemPrompt,
  thinkingBudget: 8000,
});
```

Both the "analyze" and "repurpose" action branches need the same fix. The `callClaude` return type is `{ text, thinking }`, so we also need to extract `.text` from the result before doing the JSON parse.

## Additional note
The Anthropic API key has low credits (logs show "credit balance is too low"), but the `ai` edge function has an OpenAI fallback. Since `analyze-repurpose-video` calls Claude directly, it will fail if credits are exhausted. As a secondary improvement, we could switch to using the Lovable AI supported models (e.g. `google/gemini-2.5-flash`) instead, which require no API key. However, the primary fix is the signature mismatch.

