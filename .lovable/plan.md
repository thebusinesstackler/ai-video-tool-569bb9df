

## UI Improvements for the Character + Voice Flow

After reviewing the current Reels page across both Beginner and Advanced modes, here are the key UX issues and proposed fixes:

### Issues Found

1. **Step 3 is overloaded** -- It crams AI Twin picker, character generation, angle shots, product swap, voice selection, voice preview, AND the "Make My Reel" button into one dense screen. Users have to scroll through everything.

2. **Duplicate voice sections in beginner Step 3** -- When a character is generated, there's a voice preview button *inside* the character card AND a separate "Character Voice" card below it. Redundant and confusing.

3. **No visual feedback during character generation** -- The button says "Generating 5 shots..." but the area where shots will appear is empty. A skeleton/placeholder grid would reduce uncertainty.

4. **AI Twin grid is cramped on mobile** -- 4-column grid with tiny thumbnails is hard to tap on small screens. Advanced mode uses 3 columns which works better.

5. **Advanced Lip Sync section is a wall of content** -- AI Twin picker, generate character, manual upload, character description, model selection, voice -- all in one collapsible. No visual grouping.

6. **"Skip" path is unclear** -- The beginner says "leave blank to skip" but the Make My Reel button doesn't visually indicate you can proceed without a character.

### Proposed Changes

**A. Clean up duplicate voice UI in beginner Step 3** (`Reels.tsx`)
- Remove the inline "Preview Voice" button and badge from inside the character-ready card (lines ~3052-3069)
- Keep only the standalone "Character Voice" card below (lines ~3163-3196) as the single voice section
- This eliminates confusion about which voice control to use

**B. Add skeleton placeholders during character generation** (`Reels.tsx`)
- When `isGeneratingCharacter` is true, show a 5-cell skeleton grid (pulsing gray boxes) in place of the angle shots area
- Gives users immediate visual feedback that shots are being created

**C. Use 3-column grid for AI Twin picker in beginner mode** (`Reels.tsx`)
- Change from `grid-cols-4` to `grid-cols-3` to match advanced mode and give faces more space
- Add the voice badge indicator like advanced mode has

**D. Add tab grouping inside Advanced Lip Sync** (`Reels.tsx`)
- Group the lip sync content into two visual sections with clear headers:
  - "Character" section (AI Twin picker + generate + upload)
  - "Voice & Model" section (voice selector + lip sync model)
- Use subtle bordered sub-sections instead of one flat list

**E. Add a "Skip Character" shortcut button** (`Reels.tsx`)
- In beginner Step 3, add a secondary "Skip → Make My Reel" button below the character generation area
- Makes it obvious that character selection is optional

### Files Modified
- `src/pages/Reels.tsx` -- all changes are in this single file

