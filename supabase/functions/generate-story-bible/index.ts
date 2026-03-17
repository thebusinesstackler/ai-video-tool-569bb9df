import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating story bible for movie idea...');

    const systemPrompt = `You are an expert story development consultant and production designer specializing in creating comprehensive story bibles for short-form video content (1-3 minutes).

Your task is to create a complete STORY BIBLE that ensures total consistency throughout the film:

1. **STORY STRUCTURE**
   - Logline: One sentence describing the entire story
   - Theme: Core message or emotion
   - Three-Act Structure: Setup, Confrontation, Resolution
   - Emotional Arc: How the audience should feel at each point
   - Scene Flow: How each scene connects to the next

2. **CHARACTER PROFILES** (Define 2-4 characters)
   Each character MUST have:
   - name: Character's name
   - role: "protagonist" | "deuteragonist" | "antagonist" | "supporting"
   - gender: "male" | "female" (REQUIRED - used for voice casting)
   - age: Approximate age range
   - appearance: Physical description (hair, skin, eyes, build)
   - wardrobe: SPECIFIC outfit they wear THROUGHOUT the entire film (this MUST be consistent in EVERY scene)
   - voiceStyle: How they speak (tone, pace, accent, mannerisms)
   - personality: Key traits and motivations
   - arc: How they change from beginning to end

3. **WARDROBE CONSISTENCY NOTES**
   - Define the exact clothing each character wears
   - Include colors, materials, and distinctive features
   - This wardrobe description will be injected into EVERY image prompt

4. **SCENE-BY-SCENE DIALOGUE ASSIGNMENTS**
   For each planned scene, specify:
   - Which characters appear
   - Who speaks and in what order
   - The general topic/conflict of their conversation

CRITICAL: Return ONLY valid JSON with this structure (no markdown):
{
  "logline": "One sentence story summary",
  "theme": "Core theme",
  "emotionalArc": ["hope", "tension", "triumph"],
  "threeActStructure": {
    "setup": "Description of Act 1",
    "confrontation": "Description of Act 2", 
    "resolution": "Description of Act 3"
  },
  "characters": [
    {
      "name": "Character Name",
      "role": "protagonist",
      "gender": "female",
      "age": "mid-30s",
      "appearance": "Detailed physical description",
      "wardrobe": "Red leather jacket over white t-shirt, dark blue jeans, black boots",
      "voiceStyle": "Confident, quick-witted, slight accent",
      "personality": "Determined but vulnerable",
      "arc": "Starts doubtful, becomes confident leader"
    }
  ],
  "wardrobeNotes": "Key wardrobe details for image consistency",
  "sceneDialogueMap": [
    {
      "sceneNumber": 1,
      "title": "The Discovery",
      "charactersPresent": ["Maria", "James"],
      "dialogueFlow": [
        { "character": "Maria", "action": "initiates conversation about the mystery" },
        { "character": "James", "action": "expresses doubt" },
        { "character": "Maria", "action": "reveals key evidence" }
      ],
      "conflict": "Maria tries to convince James"
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let generatedContent = data?.choices?.[0]?.message?.content;

    if (!generatedContent) {
      throw new Error('No content generated');
    }

    console.log('Raw story bible response length:', generatedContent.length);

    // Extract JSON from markdown code blocks if present
    const jsonMatch = generatedContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      generatedContent = jsonMatch[1];
    }

    // Try to find JSON object in the response
    const objectMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      generatedContent = objectMatch[0];
    }

    // Parse the story bible with robust cleanup
    let storyBible;
    try {
      storyBible = JSON.parse(generatedContent);
    } catch (parseError) {
      console.log('Initial JSON parse failed, attempting cleanup...');
      
      // More aggressive cleanup for malformed JSON
      let cleaned = generatedContent
        .replace(/^\uFEFF/, '') // Remove BOM
        .replace(/[\x00-\x1F\x7F]/g, (char: string) => {
          // Replace control characters except for common whitespace
          if (char === '\n' || char === '\r' || char === '\t') {
            return ' '; // Replace newlines/tabs in strings with space
          }
          return '';
        })
        .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas
        .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2') // Fix unescaped backslashes
        .trim();
      
      try {
        storyBible = JSON.parse(cleaned);
      } catch (secondError) {
        console.log('Second parse attempt failed, trying more aggressive cleanup...');
        
        // Even more aggressive: just try to extract and reformat
        // Remove all line breaks within strings by replacing them globally
        cleaned = cleaned.replace(/\n/g, ' ').replace(/\r/g, ' ');
        
        try {
          storyBible = JSON.parse(cleaned);
        } catch (thirdError) {
          console.error('All JSON parse attempts failed:', thirdError);
          console.log('Raw content preview:', generatedContent.substring(0, 500));
          throw new Error('Failed to parse AI response as JSON. The AI may have generated malformed content.');
        }
      }
    }

    // Validate structure
    if (!storyBible.characters || !Array.isArray(storyBible.characters)) {
      throw new Error('Invalid story bible - missing characters array');
    }

    console.log(`Generated story bible with ${storyBible.characters.length} characters`);

    return new Response(
      JSON.stringify({ storyBible }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-story-bible:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate story bible' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
