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
    const { sceneDescription, characterName, otherCharacterName, tone, location, timeOfDay, sceneTitle, isMainCharacter = true } = await req.json();

    if (!sceneDescription) {
      throw new Error('Scene description is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating dialogue for:', characterName, 'Main character:', isMainCharacter);

    const speakerName = characterName || (isMainCharacter ? 'the protagonist' : 'the second character');
    const wordTarget = isMainCharacter ? '100-150' : '60-100';
    const durationTarget = isMainCharacter ? '30-45 second' : '20-30 second';

    const prompt = `You are an award-winning screenwriter writing dialogue for a movie scene.

CHARACTER SPEAKING: ${speakerName}
${otherCharacterName ? `OTHER CHARACTER IN SCENE: ${otherCharacterName}` : ''}

SCENE: "${sceneTitle || 'Untitled Scene'}"
LOCATION: ${location || 'Unknown'} — ${timeOfDay || 'Day'}
${tone ? `MOOD: ${tone}` : ''}

SCENE DESCRIPTION:
${sceneDescription}

TASK: Write ${durationTarget} of spoken dialogue (${wordTarget} words) for ${speakerName}.

CRITICAL WRITING RULES:

1. SOUND LIKE A REAL ACTOR PERFORMING
   - Write how real people actually speak in emotional moments
   - Lines should feel conversational, grounded, and performance-ready
   - Each line should have subtext — what the character MEANS vs what they SAY
   - Vary sentence length: mix short punchy lines with longer flowing ones

2. NO EXCESSIVE ELLIPSES
   - Do NOT use "..." more than once in the entire dialogue
   - Instead of "I just... I don't know... maybe we should go..."
   - Write: "I don't know. Maybe we should go."
   - A single "..." is acceptable ONLY for one truly dramatic pause
   - Use periods, commas, and natural sentence breaks for pacing

3. EMOTIONAL DELIVERY
   - The words themselves should convey the emotion
   - Write lines that naturally sound angry, tender, nervous, etc.
   - A good actor should be able to perform this without stage directions

4. NO STAGE DIRECTIONS OR FORMATTING
   - NO parentheses like (sighs), (pauses), (whispers)
   - NO brackets or asterisks
   - NO character name prefixes
   - ONLY the spoken words

5. PACING AND RHYTHM
   - Some lines should be short and sharp: "No. Not anymore."
   - Others can breathe: "I spent three years waiting for you to say that, and now that you have, I don't know what to do with it."
   - Build to an emotional peak

Write ONLY the spoken words. No formatting, no labels, no directions.`;

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
            content: 'You are a screenwriter whose dialogue has been compared to Aaron Sorkin and Taylor Sheridan. Your lines are sharp, emotionally authentic, and performance-ready. You never write placeholder or robotic dialogue. Every line sounds like a real human being in a real moment. You almost never use ellipses — your pacing comes from sentence structure, not punctuation tricks.'
          },
          { role: 'user', content: prompt }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-scene-dialogue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
