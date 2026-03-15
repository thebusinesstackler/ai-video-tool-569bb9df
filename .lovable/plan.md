

## Plan: Fix Edge Function Errors, Enhance Voice Generation, Add Per-Angle Regeneration, and Background Change Support

### Issues Identified

1. **Edge function error on product change**: The `generate-scene-image` CORS headers are missing newer Supabase client headers (`x-supabase-client-platform`, etc.), causing preflight failures.
2. **Voice preview is too simple**: Currently uses a generic `Friendly_Person` voice ID for all characters. Should map voice type to appropriate WaveSpeed MiniMax voice.
3. **No per-angle regeneration**: When angles are generated, users cannot regenerate a single bad angle -- they must redo all.
4. **Background change prompts not handled properly**: When the user says "change the background to X", the system needs to use the reference image and rewrite the prompt to focus on background replacement.

### Changes

#### 1. Fix CORS Headers in `generate-scene-image` Edge Function
Update the `corsHeaders` in `supabase/functions/generate-scene-image/index.ts` to include all required Supabase client headers:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

#### 2. Smarter Voice Preview in `AICharacterCreator.tsx`
Map the AI-suggested `voiceType` (e.g. `professional-female`, `casual-male`) to actual WaveSpeed MiniMax voice IDs:
- `professional-female` -> `English_compelling_lady1`
- `casual-male` -> `Casual_Guy`
- `energetic-female` -> `English_radiant_girl`
- etc.

Pass the mapped voice ID to `text-to-speech` instead of hardcoded `Friendly_Person`. Also do the same in `ActorProfilePanel.tsx`.

#### 3. Per-Angle Regeneration in `AICharacterCreator.tsx`
In the `save` step (where all angles are shown), add a click-to-select interaction on each angle image. When selected, show a "Regenerate This Angle" button with an optional prompt field. This calls `generate-scene-image` with the approved main image as reference plus the angle-specific prompt, and replaces only that index in `angleImages`.

#### 4. Background Change Support in `ActorProfilePanel.tsx`
Enhance `handleGenerateFromReference` to detect background-related prompts (keywords like "background", "setting", "environment", "scene"). When detected, rewrite the prompt to explicitly instruct the AI to keep the person identical but change only the background/environment. The edge function already supports reference images, so this is a prompt engineering change on the client side.

#### 5. Also Fix CORS in `ActorProfilePanel` Reference Generation
The same CORS fix applies since it calls the same edge function.

### Files to Modify
- `supabase/functions/generate-scene-image/index.ts` -- CORS fix
- `src/components/AICharacterCreator.tsx` -- voice mapping, per-angle regeneration UI
- `src/components/ActorProfilePanel.tsx` -- voice mapping, background-aware prompt rewriting

