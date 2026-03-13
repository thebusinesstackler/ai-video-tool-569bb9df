import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      sceneDescription, 
      characterNames, // Array of character names [char1, char2]
      tone, 
      location, 
      timeOfDay, 
      sceneTitle,
      // NEW: Story context for blockbuster-quality dialogue
      storyBible,
      movieIdea,
      scenePosition, // e.g., "1 of 6", "opening", "climax", "resolution"
      previousSceneSummary,
      characterPersonalities, // Object: { "CharName": "personality description" }
      transitionAction // What happens in this scene
    } = await req.json();

    if (!sceneDescription) {
      throw new Error('Scene description is required');
    }

    if (!characterNames || characterNames.length < 2) {
      throw new Error('At least 2 character names are required for conversation');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const char1 = characterNames[0];
    const char2 = characterNames[1];

    console.log('Generating blockbuster dialogue between:', char1, 'and', char2);
    console.log('Scene context:', { sceneTitle, location, tone, scenePosition });

    // Build rich story context
    let storyContext = '';
    if (movieIdea) {
      storyContext += `\nMOVIE CONCEPT: ${movieIdea}\n`;
    }
    if (storyBible) {
      if (storyBible.theme) storyContext += `THEME: ${storyBible.theme}\n`;
      if (storyBible.setting) storyContext += `SETTING: ${storyBible.setting}\n`;
      if (storyBible.tone) storyContext += `OVERALL TONE: ${storyBible.tone}\n`;
    }
    if (previousSceneSummary) {
      storyContext += `\nPREVIOUSLY: ${previousSceneSummary}\n`;
    }

    // Build character context
    let characterContext = '';
    if (characterPersonalities) {
      characterContext = Object.entries(characterPersonalities)
        .map(([name, personality]) => `${name}: ${personality}`)
        .join('\n');
    }

    // Determine scene type for dialogue style
    let sceneTypeGuidance = '';
    if (scenePosition) {
      if (scenePosition.includes('1 of') || scenePosition.toLowerCase().includes('opening')) {
        sceneTypeGuidance = 'This is an OPENING scene - establish the characters and their dynamic. Build intrigue.';
      } else if (scenePosition.toLowerCase().includes('climax')) {
        sceneTypeGuidance = 'This is a CLIMAX scene - high emotional stakes, tension, confrontation or revelation.';
      } else if (scenePosition.toLowerCase().includes('resolution') || scenePosition.toLowerCase().includes('final')) {
        sceneTypeGuidance = 'This is a RESOLUTION scene - provide closure, emotional payoff, or a memorable ending.';
      }
    }

    const prompt = `You are an AWARD-WINNING SCREENWRITER known for creating dialogue that sounds like a BLOCKBUSTER MOVIE TRAILER.

${storyContext}

CHARACTERS IN THIS SCENE:
1. ${char1}
2. ${char2}
${characterContext ? `\nCHARACTER PERSONALITIES:\n${characterContext}` : ''}

SCENE DETAILS:
- Title: ${sceneTitle || 'Untitled Scene'}
- Location: ${location || 'Unknown'}
- Time: ${timeOfDay || 'Day'}
- Mood/Tone: ${tone || 'dramatic'}
- Scene Position: ${scenePosition || 'middle of story'}
${transitionAction ? `- What happens: ${transitionAction}` : ''}
${sceneTypeGuidance ? `\n${sceneTypeGuidance}` : ''}
${previousSceneSummary ? `\nSTORY SO FAR (dialogue must continue this narrative thread):\n${previousSceneSummary}` : ''}

SCENE DESCRIPTION:
${sceneDescription}

YOUR TASK:
Write BLOCKBUSTER MOVIE DIALOGUE - the kind that gives you chills in a trailer. 

DIALOGUE RULES:
1. SHORT, PUNCHY LINES - Most lines should be 5-15 words. Impact over length.
2. SUBTEXT - Characters hint at deeper meanings, don't explain everything
3. TENSION - Even casual exchanges should have underlying stakes
4. CHARACTER VOICE - Each character sounds distinct based on their personality
5. EMOTIONAL BEATS - Build to a moment of impact (revelation, confrontation, realization)
6. NO EXPOSITION DUMPS - Show, don't tell. No "As you know..." dialogue
7. NATURALISTIC - People interrupt, trail off, react emotionally

DIALOGUE EXAMPLES (for inspiration):
- "You knew. This whole time... you knew." / "I did what I had to do."
- "We have 24 hours. That's it." / "Then we make them count."
- "Promise me you'll come back." / "I'm not making promises I can't keep."
- "They're coming." / "Let them come."

CRITICAL FORMAT RULES:
- Return a JSON array of dialogue entries
- Each entry has "character" (exact name from above) and "line" (spoken words only)
- NO stage directions, NO parentheses, NO asterisks, NO brackets
- ONLY the spoken words

Return ONLY valid JSON in this exact format:
[
  {"character": "${char1}", "line": "Their line here..."},
  {"character": "${char2}", "line": "Their response..."},
  {"character": "${char1}", "line": "Next line..."},
  {"character": "${char2}", "line": "Reply..."}
]

Generate 4-8 exchanges (8-16 total lines). Make it CINEMATIC. Return ONLY the JSON array.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an Oscar-winning screenwriter. Your dialogue is legendary - memorable, emotional, and perfectly suited for movie trailers. You write conversations that reveal character through conflict and subtext. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let dialogueContent = data.choices[0].message.content.trim();
    
    // Clean up the response - remove markdown code blocks if present
    dialogueContent = dialogueContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('Raw dialogue content:', dialogueContent);

    // Parse the JSON array
    let conversation;
    try {
      conversation = JSON.parse(dialogueContent);
    } catch (parseError) {
      console.error('Failed to parse dialogue JSON:', parseError);
      // Try to extract JSON from the response
      const jsonMatch = dialogueContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        conversation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse dialogue response as JSON');
      }
    }

    // Validate the structure
    if (!Array.isArray(conversation)) {
      throw new Error('Dialogue response is not an array');
    }

    // Clean up each entry and normalize character names
    const cleanedConversation = conversation.map((entry: any) => {
      let charName = entry.character || 'Unknown';
      
      // Normalize character names - match to provided names (fuzzy matching)
      const char1Lower = char1.toLowerCase().replace(/\s+/g, '');
      const char2Lower = char2.toLowerCase().replace(/\s+/g, '');
      const entryCharLower = charName.toLowerCase().replace(/\s+/g, '');
      
      // Check if entry character matches char1 or char2
      if (entryCharLower.includes(char1Lower) || char1Lower.includes(entryCharLower)) {
        charName = char1;
      } else if (entryCharLower.includes(char2Lower) || char2Lower.includes(entryCharLower)) {
        charName = char2;
      }
      
      return {
        character: charName,
        line: (entry.line || '')
          .replace(/\([^)]*\)/g, '')  // Remove (parentheses)
          .replace(/\[[^\]]*\]/g, '') // Remove [brackets]
          .replace(/\*[^*]*\*/g, '')  // Remove *asterisks*
          .trim()
      };
    }).filter((entry: any) => entry.line.length > 0);

    console.log('Generated blockbuster conversation:', cleanedConversation.length, 'lines');

    // Also return separate dialogue by character for TTS
    const dialogueByCharacter: Record<string, string> = {};
    dialogueByCharacter[char1] = cleanedConversation
      .filter((e: any) => e.character === char1)
      .map((e: any) => e.line)
      .join(' ... ');
    dialogueByCharacter[char2] = cleanedConversation
      .filter((e: any) => e.character === char2)
      .map((e: any) => e.line)
      .join(' ... ');

    return new Response(
      JSON.stringify({ 
        conversation: cleanedConversation,
        dialogueByCharacter
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-conversation-dialogue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
