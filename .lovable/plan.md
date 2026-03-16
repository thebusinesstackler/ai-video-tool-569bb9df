

## Plan: Character-First Flow + Voice Auto-Fill for Both Beginner and Advanced Modes

### Problem
The approved plan to merge character generation and voice selection (character first, then voice with auto-populated description) was only applied to beginner mode. The advanced mode still has voice selection separate from character context, and the "Generate Voice for Character" dialog doesn't receive the character description automatically.

### Changes

**1. Pass `characterDescription` and `characterGender` to VoiceSelector** (`VoiceSelector.tsx`)
- Add optional props: `characterDescription?: string` and `characterGender?: 'male' | 'female'`
- When the "Generate Voice for Character" dialog opens, auto-populate `generateDescription` and `generateGender` from these props
- This means clicking "Generate Voice" immediately shows the character info ready to go

**2. Update Advanced Mode voice section to pass character context** (`Reels.tsx`)
- In the advanced mode VoiceSelector (around line 3577), pass `characterDescription` and detected gender as props
- This ensures that when a user generates/selects a character in advanced mode, clicking "Generate Voice" auto-fills the character description

**3. Merge voice selection into beginner Step 3** (`Reels.tsx`)
- Move VoiceSelector + Preview Voice button into Step 3 below the character generation section
- Remove Step 4 as a separate step — the "Make My Reel" button stays in Step 3 after both character and voice are set
- Update step count from 4 to 3 in the step indicator
- Update step navigation logic (next/back buttons, step labels)

### Files Modified
- `src/components/VoiceSelector.tsx` — add `characterDescription` and `characterGender` props, auto-fill generate dialog
- `src/pages/Reels.tsx` — collapse beginner Steps 3+4 into one, pass character context to VoiceSelector in both modes

