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
    const { sceneDescription, characterName, tone, location, timeOfDay, sceneTitle, isMainCharacter = true } = await req.json();

    if (!sceneDescription) {
      throw new Error('Scene description is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating dialogue for scene:', sceneDescription, 'Main character:', characterName);

    const prompt = isMainCharacter 
      ? `You are a professional screenwriter creating dialogue for a movie scene. 

IMPORTANT: You are writing dialogue ONLY for the main character "${characterName || 'the protagonist'}". 
- Write ONLY what ${characterName || 'the protagonist'} says
- Do NOT write any other character's lines
- The dialogue should be natural and fit the scene
- Write substantial dialogue for a 30-45 second scene (about 100-150 words)
- Include emotional depth, pauses for emphasis, and natural speech patterns

Scene Title: ${sceneTitle || 'Untitled Scene'}
Location: ${location || 'Unknown'}
Time: ${timeOfDay || 'Day'}
Main Character: ${characterName || 'Protagonist'}
${tone ? `Tone/Mood: ${tone}` : ''}

Scene Description: ${sceneDescription}

Write ONLY ${characterName || "the protagonist"}'s spoken dialogue. Include natural pauses (use "...") and emotional beats.
Make the dialogue substantial and meaningful - this is a key scene moment.
Do NOT include other characters' lines, stage directions, or character names.`
      : `You are a professional screenwriter creating dialogue for a supporting character in a movie scene.

IMPORTANT: You are writing dialogue for a SUPPORTING CHARACTER (not the main character "${characterName}").
- Write dialogue for ONE supporting character responding to or interacting with ${characterName}
- Write substantial dialogue for a 20-30 second response (about 60-100 words)
- Make it natural, emotional, and reactive to the scene

Scene Title: ${sceneTitle || 'Untitled Scene'}
Location: ${location || 'Unknown'}
Time: ${timeOfDay || 'Day'}
Main Character (NOT speaking): ${characterName || 'Protagonist'}
${tone ? `Tone/Mood: ${tone}` : ''}

Scene Description: ${sceneDescription}

Write ONLY the supporting character's spoken dialogue. Make it meaningful and emotionally engaging.
Do NOT include the main character's lines, stage directions, or character names.`;

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
            content: 'You are an award-winning screenwriter known for authentic, emotionally resonant dialogue. Your dialogue sounds natural, captures character personality, and moves the story forward. You write for film, so dialogue is punchy and purposeful.'
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
    const dialogue = data.choices[0].message.content;

    console.log('Generated dialogue:', dialogue);

    return new Response(
      JSON.stringify({ dialogue: dialogue.trim() }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-scene-dialogue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
