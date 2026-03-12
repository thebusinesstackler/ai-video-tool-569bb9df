

# Redesign Movie Scene Creator as a Step-by-Step Wizard

## Problem
The current page is a 4000-line vertical scroll with everything visible at once — movie idea, character selection, story bible, outline, locations, scenes, and export all stacked on top of each other. It's overwhelming and hard to follow.

## Solution
Reorganize the UI into a **numbered stepper/wizard layout** using tabs with clear step indicators. Each step focuses on one task, making the workflow intuitive and scannable.

## Steps Layout

```text
┌──────────────────────────────────────────────────────┐
│  Step 1        Step 2        Step 3       Step 4     │
│  ● Concept     ○ Story       ○ Outline    ○ Scenes   │
│  ─────────     Bible         & Locations  & Export   │
└──────────────────────────────────────────────────────┘
```

### Step 1: Concept & Cast
- Pete AI Assistant (movie idea input)
- Quick Start sample buttons
- Movie Length selector
- Character/Twin selection panel
- "Generate Complete Movie" one-click button
- "or step by step" divider with Story Bible / Outline buttons

### Step 2: Story Bible
- Story bible card (characters, three-act structure, wardrobe, voice assignments)
- Only accessible once story bible is generated
- "Next: Outline" button at bottom

### Step 3: Outline & Locations
- Editable outline textarea
- Location Manager
- "Generate Scenes from Outline" button
- "Next: Scenes" button

### Step 4: Scenes & Export
- Scene timeline
- Keyframe scene cards with coverage/blocking tools
- Regenerate dialogue / Stitch videos buttons
- Stitched video player and download

## Implementation

### File: `src/pages/MovieSceneCreator.tsx`

1. **Add step state**: `const [currentStep, setCurrentStep] = useState(0);`

2. **Add a stepper header component** at the top (below the page title) showing 4 numbered steps with labels, highlighting the active one and marking completed ones with checkmarks.

3. **Wrap each section group** in conditional renders based on `currentStep`:
   - `currentStep === 0`: Pete AI, Quick Start, Character Selection, Movie Idea card with generate buttons
   - `currentStep === 1`: Story Bible card (full expanded view)
   - `currentStep === 2`: Outline textarea + Location Manager
   - `currentStep === 3`: Scenes list, timeline, stitch, export

4. **Add Next/Back navigation buttons** at the bottom of each step. Auto-advance to next step when key actions complete (e.g., after story bible generates, move to step 1; after scenes generate, move to step 3).

5. **Simplify the header**: Remove the 6 feature highlight badges (they clutter). Keep the title, project name, and action buttons (template selector, storyboard export, transfer to reels, save/load).

6. **Move project action buttons** (New, Load, Save) into the header row instead of a separate section.

7. **Move the "How It Works" info card** into Step 1 as a collapsible helper, rather than sitting at the very bottom.

8. **Step indicators show completion state**: Step gets a checkmark when its data exists (movie idea → step 1 done, story bible → step 2 done, outline → step 3 done, scenes → step 4 done). Users can click any completed step to go back.

### Auto-navigation triggers
- `generateStoryBible` success → `setCurrentStep(1)`
- `generateOutline` success → `setCurrentStep(2)`
- `generateScenes` success → `setCurrentStep(3)`
- `generateAll` success → `setCurrentStep(3)`

This keeps the existing 4000 lines of logic untouched — only the JSX render section (~lines 2890-4006) gets restructured with step conditionals and the stepper UI.

