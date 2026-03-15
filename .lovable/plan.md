

## Plan: Loop AI Auto-Recognizes New Projects

**Problem**: When the user clicks "New" to start a fresh video ad, Loop AI Chat retains its old conversation from `localStorage` and doesn't acknowledge the new project. It should detect the reset and proactively greet the user to help build the new commercial.

### Changes

**1. `src/pages/TestimonialCommercial.tsx`** — Clear Loop AI chat on "New" click
- When the "New" button is clicked (lines 262-269), also clear the `loop-ai-director-chat` localStorage key so the AI conversation resets alongside the project state.

**2. `src/components/testimonial/LoopAIDirector.tsx`** — Detect empty project and auto-greet
- Add a `useEffect` that watches `segments.length`. When segments become empty (new project) and the chat history is also empty (just cleared), automatically inject a welcome message from the assistant like: *"Fresh canvas! What are we building? Tell me the product, audience, and vibe — I'll create your full storyboard."*
- This gives the user an immediate prompt to start describing their new ad without needing to type a question first.

### Technical Detail
- The welcome message is purely a local UI injection (no API call needed).
- A `prevSegmentsRef` tracks transitions from non-empty to empty segments to avoid re-triggering on mount with an already-empty project.
- The localStorage key `loop-ai-director-chat` is the single source of chat persistence — clearing it on "New" is sufficient.

