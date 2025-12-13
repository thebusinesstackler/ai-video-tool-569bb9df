import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      sceneTitle, 
      location, 
      timeOfDay, 
      dialogue, 
      transitionAction, 
      characterDescription,
      cameraAngle,
      position,
      frameType, // 'start' or 'end'
      mood,
      lighting
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Describing scene:', { sceneTitle, frameType, location, timeOfDay });

    // Build context for the AI
    const contextParts = [];
    
    if (sceneTitle) contextParts.push(`Scene: "${sceneTitle}"`);
    if (location) contextParts.push(`Location: ${location}`);
    if (timeOfDay) contextParts.push(`Time: ${timeOfDay}`);
    if (mood) contextParts.push(`Mood: ${mood}`);
    if (lighting) contextParts.push(`Lighting style: ${lighting}`);
    if (characterDescription) contextParts.push(`Character: ${characterDescription}`);
    if (dialogue) contextParts.push(`Dialogue being spoken: "${dialogue}"`);
    if (transitionAction) contextParts.push(`Action happening: ${transitionAction}`);
    if (cameraAngle) contextParts.push(`Camera angle: ${cameraAngle}`);
    if (position) contextParts.push(`Character position: ${position}`);

    const frameContext = frameType === 'start' 
      ? 'This is the STARTING frame of the scene - capture the beginning moment.'
      : 'This is the ENDING frame of the scene - capture the concluding moment after the action has occurred.';

    const systemPrompt = `You are an expert cinematographer and visual director. Your job is to create detailed, vivid image prompts that will be used to generate movie scene images.

Create prompts that are:
- Highly visual and descriptive
- Cinematic in style (like a movie still)
- Focused on composition, lighting, and atmosphere
- Specific about character positioning and expressions
- Aware of the camera angle and framing

Output ONLY the image prompt, nothing else. No explanations, no prefixes like "Image prompt:" - just the description itself.`;

    const userPrompt = `${frameContext}

Scene Context:
${contextParts.join('\n')}

Generate a detailed, cinematic image prompt that captures this exact moment. Include:
1. The setting and environment with specific visual details
2. Character appearance, expression, and body language
3. Lighting and atmosphere that matches the mood
4. Camera framing and composition
5. Any relevant props or environmental elements

Make it vivid and specific enough for an AI image generator to create a compelling movie still.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
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
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedPrompt = data.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      throw new Error('No prompt generated from AI');
    }

    console.log('Generated prompt:', generatedPrompt.substring(0, 100) + '...');

    return new Response(JSON.stringify({ 
      imagePrompt: generatedPrompt.trim()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in describe-scene function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
