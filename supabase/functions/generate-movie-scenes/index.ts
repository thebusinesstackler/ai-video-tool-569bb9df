import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { outline } = await req.json();
    
    if (!outline) {
      return new Response(
        JSON.stringify({ error: 'Movie outline is required' }),
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

    console.log('Generating movie scenes from outline...');

    const systemPrompt = `You are an expert screenwriter and cinematographer specializing in creating immersive audiovisual experiences. Your task is to break down a movie outline into detailed, cinematic scenes that work as complete movie segments with rich narration.

For each scene, you must provide:
1. Scene number and title
2. Location and time of day
3. Detailed visual description (what the camera sees)
4. Character actions and emotions
5. Complete narration including dialogue, sound effects, and atmospheric descriptions (60-120 seconds of content)
6. A detailed image generation prompt that captures the key visual moment

CRITICAL: Return your response as a valid JSON array with this exact structure:
[
  {
    "sceneNumber": 1,
    "title": "Opening Scene Title",
    "location": "Location description",
    "timeOfDay": "Day/Night/Dawn/Dusk",
    "description": "Detailed description of what happens in this scene",
    "dialogue": "Complete scene narration including: character dialogue in quotes, sound effects in [brackets], and atmospheric descriptions. Example: '[Thunder rumbles in the distance] Sarah opens the creaking door. \"Hello? Anyone there?\" she calls out nervously. [Footsteps echo on the wooden floor] The wind howls through the broken windows. Make this 60-120 seconds when spoken, creating a full immersive movie scene experience.",
    "imagePrompt": "Highly detailed cinematic prompt for image generation, including camera angle, lighting, mood, character descriptions, setting details"
  }
]

IMPORTANT GUIDELINES:
- Every scene MUST include complete narration with dialogue, sound effects, and atmosphere
- Use quotation marks for spoken dialogue
- Use [square brackets] for sound effects and environmental sounds
- Include atmospheric descriptions between dialogue for immersion
- Make narration 60-120 seconds when spoken to create complete movie scenes
- Sound effects should enhance the mood: [rain pattering], [door slams], [distant sirens], etc.
- Balance dialogue with sound effects and descriptions for a rich audio experience

Make each scene cinematically rich and audiovisually compelling. Create narration that sounds like a professional audio drama or audiobook.`;

    const userPrompt = `Based on this movie outline, generate 8-12 key cinematic scenes with complete immersive narration:

${outline}

Break this down into visually stunning scenes with:
1. Detailed image generation prompts for stunning visuals
2. Complete narration (60-120 seconds each) that includes:
   - Character dialogue in "quotes"
   - Sound effects in [brackets] like [thunder], [footsteps], [door creaking]
   - Atmospheric descriptions for immersion
   - Environmental sounds that enhance the mood

Create scenes that work as complete movie segments with rich audio experiences. Make them feel like professional audio dramas.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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

    // Extract JSON from markdown code blocks if present
    const jsonMatch = generatedContent.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
    if (jsonMatch) {
      generatedContent = jsonMatch[1];
    }

    // Parse the scenes
    const scenes = JSON.parse(generatedContent);

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid scenes format');
    }

    console.log(`Successfully generated ${scenes.length} scenes`);

    return new Response(
      JSON.stringify({ scenes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-movie-scenes:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate scenes' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
