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
      sceneTitle 
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

    console.log('Generating conversation dialogue between:', char1, 'and', char2);

    const prompt = `You are a professional screenwriter creating a realistic back-and-forth conversation for a movie scene.

CHARACTERS IN THIS SCENE:
1. ${char1} (Character A)
2. ${char2} (Character B)

SCENE DETAILS:
- Title: ${sceneTitle || 'Untitled Scene'}
- Location: ${location || 'Unknown'}
- Time: ${timeOfDay || 'Day'}
${tone ? `- Tone/Mood: ${tone}` : ''}

SCENE DESCRIPTION:
${sceneDescription}

YOUR TASK:
Create a natural, alternating conversation between ${char1} and ${char2}. The dialogue should:
- Alternate between the two characters (A speaks, B responds, A responds, etc.)
- Total approximately 45-60 seconds of dialogue (about 150-200 words total)
- Feel natural and emotionally authentic to the scene
- Move the story forward and reveal character dynamics

CRITICAL FORMAT RULES:
- Return a JSON array of dialogue entries
- Each entry has "character" (the name) and "line" (what they say)
- NO stage directions in parentheses or brackets
- NO asterisks or action descriptions
- ONLY the spoken words

Return ONLY valid JSON in this exact format:
[
  {"character": "${char1}", "line": "Their first line here..."},
  {"character": "${char2}", "line": "Their response here..."},
  {"character": "${char1}", "line": "Their next line..."},
  {"character": "${char2}", "line": "Their reply..."}
]

Generate 4-8 alternating exchanges. Return ONLY the JSON array, no other text.`;

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
            content: 'You are an award-winning screenwriter known for authentic, emotionally resonant dialogue. You write natural conversations that reveal character through subtext and conflict. Always return valid JSON only.'
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

    // Clean up each entry
    const cleanedConversation = conversation.map((entry: any) => ({
      character: entry.character || 'Unknown',
      line: (entry.line || '').replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\*[^*]*\*/g, '').trim()
    })).filter((entry: any) => entry.line.length > 0);

    console.log('Generated conversation:', cleanedConversation.length, 'lines');

    return new Response(
      JSON.stringify({ 
        conversation: cleanedConversation,
        // Also return combined dialogue for each character for TTS
        dialogueByCharacter: {
          [char1]: cleanedConversation.filter((e: any) => e.character === char1).map((e: any) => e.line).join(' ... '),
          [char2]: cleanedConversation.filter((e: any) => e.character === char2).map((e: any) => e.line).join(' ... ')
        }
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
