import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { movieIdea, characterDescription } = await req.json();
    
    if (!movieIdea) {
      return new Response(
        JSON.stringify({ error: 'Movie idea is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Claude API key checked by shared helper

    console.log('Generating story bible for movie idea...');

    const systemPrompt = `You are a veteran story editor + production designer crafting a STORY BIBLE for a short cinematic film. Your bible must produce a story that *feels like one cohesive movie* — not disconnected vignettes — with consistent characters, escalating stakes, and visually specific scenes that a video model can render reliably.

REQUIREMENTS:

1. STORY STRUCTURE
   - Logline (one sentence)
   - Theme (single emotional truth)
   - 3-act breakdown (setup / confrontation / resolution) — each 2-3 sentences with a clear turning point
   - Emotional arc as 3-6 beats (e.g., "curiosity → doubt → defiance → triumph")
   - A "central question" the audience is asking through the film

2. CHARACTERS (lock identity for visual consistency)
   - name, role (protagonist | deuteragonist | antagonist | supporting)
   - gender ("male" | "female") — REQUIRED for voice casting
   - age (range)
   - appearance — hair, skin, eyes, build, distinguishing features (specific, image-promptable)
   - wardrobe — exact outfit worn THROUGHOUT every scene (colors, materials, accessories). This will be injected into every image prompt.
   - voiceStyle — tone, pace, accent, mannerisms
   - personality — 2-3 core traits + motivation
   - arc — how they change start → end

3. WARDROBE & VISUAL CONTINUITY NOTES
   - One paragraph summarizing wardrobe + signature props that MUST stay identical across all scenes.
   - Color palette (3-5 hex/named colors) for the whole film.

4. SCENE PLAN (sceneDialogueMap) — 5-8 scenes, each rich enough to render visually:
   For EACH scene provide:
   - sceneNumber, title, location, timeOfDay
   - charactersPresent (array of names — only from the cast above)
   - mood (1 word: tense, romantic, melancholic, triumphant, mysterious, peaceful, comedic, etc.)
   - conflict (1 sentence — what's at stake in THIS beat)
   - startFrame: 2-3 sentences describing the FIRST visible frame (camera framing, blocking, lighting, key props, character expressions). Be specific enough that an image model could render it.
   - endFrame: 2-3 sentences describing the LAST visible frame, distinct from start, that sets up the NEXT scene visually (a match-cut object, a look, a reveal). Always different from startFrame.
   - transition: 1 sentence describing how endFrame visually hands off to the next scene's startFrame (e.g., "push-in on phone screen dissolves to laptop screen of next scene").
   - dialogueFlow: ordered array of { character, action } describing back-and-forth. Each "action" should include the gist of the line and the emotion behind it.

CRITICAL RULES:
- Every scene's endFrame MUST be visually distinct from its startFrame and MUST set up the next scene's startFrame.
- Stories must have a clear opening image and a closing image that mirror or contrast each other.
- No new characters appear that aren't in the cast.
- Wardrobe stays identical — characters do not change clothes between scenes unless the story explicitly requires it (state when).

OUTPUT — return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "logline": "...",
  "theme": "...",
  "centralQuestion": "...",
  "emotionalArc": ["...", "..."],
  "colorPalette": ["...", "..."],
  "threeActStructure": { "setup": "...", "confrontation": "...", "resolution": "..." },
  "characters": [
    {
      "name": "...", "role": "protagonist", "gender": "female", "age": "mid-30s",
      "appearance": "...", "wardrobe": "...", "voiceStyle": "...",
      "personality": "...", "arc": "..."
    }
  ],
  "wardrobeNotes": "...",
  "sceneDialogueMap": [
    {
      "sceneNumber": 1,
      "title": "...",
      "location": "...",
      "timeOfDay": "...",
      "charactersPresent": ["..."],
      "mood": "tense",
      "conflict": "...",
      "startFrame": "...",
      "endFrame": "...",
      "transition": "...",
      "dialogueFlow": [
        { "character": "...", "action": "what they say + emotion" }
      ]
    }
  ]
}`;

    // Extract character names from the description to enforce strict matching
    const extractCharacterNames = (desc: string): string[] => {
      if (!desc) return [];
      // Split by double newlines to get each character block
      const blocks = desc.split(/\n\n+/);
      const names: string[] = [];
      for (const block of blocks) {
        // Try to extract name from first line or "Name:" pattern
        const nameMatch = block.match(/^([A-Z][a-zA-Z\s]+?)(?:\s*[-–—:]|\n)/);
        if (nameMatch) {
          names.push(nameMatch[1].trim());
        }
      }
      return names;
    };

    // Count how many characters were provided
    const providedCharacterCount = characterDescription 
      ? (characterDescription.match(/\n\n/g)?.length || 0) + 1 
      : 0;
    
    const characterNames = extractCharacterNames(characterDescription || '');
    const characterNamesList = characterNames.length > 0 ? characterNames.join(', ') : '';
    
    const userPrompt = `Create a complete story bible for this movie concept:

${movieIdea}

${characterDescription ? `
=== MANDATORY CAST LIST - USE THESE EXACT CHARACTERS ONLY ===
${characterDescription}
=== END OF CAST LIST ===

CRITICAL CASTING RULES:
- The story MUST feature ONLY these ${providedCharacterCount} characters: ${characterNamesList}
- DO NOT create any new characters
- DO NOT add extras, supporting roles, or background characters
- DO NOT invent family members, friends, colleagues, or any other people
- If the story needs someone else mentioned, have the existing characters refer to them without showing them
- The "characters" array in your JSON MUST contain EXACTLY ${providedCharacterCount} entries
` : ''}

Requirements:
${providedCharacterCount >= 2 
  ? `- EXACTLY ${providedCharacterCount} characters in the story: ${characterNamesList}
- NO additional characters whatsoever - this is a ${providedCharacterCount}-person story
- Every scene features ONLY these ${providedCharacterCount} characters interacting`
  : providedCharacterCount === 1 
    ? `- The provided character is the sole protagonist
- Add 1-2 supporting characters ONLY if absolutely essential`
    : `- Create 2-4 characters as needed for the story`}
- Each character needs a SPECIFIC wardrobe that stays consistent throughout
- Plan for 6-10 scenes with clear dialogue assignments
- Create CONVERSATIONS between the provided characters (back-and-forth dialogue)
- Each scene should have distinct character interactions between the named characters only
- Different characters should have clearly different speaking styles

Return ONLY the JSON, no markdown.`;

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        thinkingBudget: 16000,
      });

      let generatedContent = result.text;
      if (!generatedContent) throw new Error('No content generated');

      console.log('Raw story bible response length:', generatedContent.length);

      // Extract JSON from markdown code blocks if present
      const jsonMatch = generatedContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) generatedContent = jsonMatch[1];

      const objectMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (objectMatch) generatedContent = objectMatch[0];

      let storyBible;
      try {
        storyBible = JSON.parse(generatedContent);
      } catch (parseError) {
        console.log('Initial JSON parse failed, attempting cleanup...');
        let cleaned = generatedContent
          .replace(/^\uFEFF/, '')
          .replace(/[\x00-\x1F\x7F]/g, (char: string) => {
            if (char === '\n' || char === '\r' || char === '\t') return ' ';
            return '';
          })
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2')
          .trim();

        try {
          storyBible = JSON.parse(cleaned);
        } catch {
          cleaned = cleaned.replace(/\n/g, ' ').replace(/\r/g, ' ');
          try {
            storyBible = JSON.parse(cleaned);
          } catch (thirdError) {
            console.error('All JSON parse attempts failed:', thirdError);
            throw new Error('Failed to parse AI response as JSON.');
          }
        }
      }

      if (!storyBible.characters || !Array.isArray(storyBible.characters)) {
        throw new Error('Invalid story bible - missing characters array');
      }

      console.log(`Generated story bible with ${storyBible.characters.length} characters`);

      return new Response(
        JSON.stringify({ storyBible }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      if (error instanceof ClaudeError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error in generate-story-bible:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate story bible' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
