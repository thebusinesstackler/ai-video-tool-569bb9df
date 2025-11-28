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
5. Complete narration for voiceover (60-120 seconds of content)
6. A detailed image generation prompt that captures the key visual moment

CRITICAL: Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "sceneNumber": 1,
    "title": "Opening Scene Title",
    "location": "Location description",
    "timeOfDay": "Day/Night/Dawn/Dusk",
    "description": "Detailed description of what happens in this scene",
    "dialogue": "Complete voiceover narration for the scene. Include spoken dialogue, describe sound effects like thunder rumbling or footsteps echoing, and atmospheric descriptions. Create a rich audio drama experience that is 60-120 seconds when spoken. Use descriptive language rather than special characters or quotes.",
    "imagePrompt": "Highly detailed cinematic prompt for image generation, including camera angle, lighting, mood, character descriptions, setting details"
  }
]

IMPORTANT FORMATTING RULES:
- Do NOT use quotation marks within the dialogue field
- Do NOT use square brackets within the dialogue field
- Describe sounds and dialogue naturally in plain text
- Example dialogue format: "Thunder rumbles in the distance. Sarah opens the creaking door and calls out nervously asking if anyone is there. Footsteps echo on the wooden floor as wind howls through the broken windows."
- Make narration 60-120 seconds when spoken to create complete movie scenes
- Include character dialogue, sound descriptions, and atmospheric details all in natural flowing text

Return ONLY the JSON array, no other text or formatting.`;

    const userPrompt = `Based on this movie outline, generate 8-12 key cinematic scenes with complete immersive narration:

${outline}

Break this down into visually stunning scenes with:
1. Detailed image generation prompts for stunning visuals
2. Complete narration (60-120 seconds each) with natural flowing descriptions that include character dialogue, sound descriptions, and atmospheric details
3. Avoid using quotation marks or special characters within the narration - describe everything in plain descriptive text

Return ONLY the JSON array, no markdown formatting or code blocks.`;

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

    console.log('Raw AI response length:', generatedContent.length);

    // Extract JSON from markdown code blocks if present
    const jsonMatch = generatedContent.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
    if (jsonMatch) {
      generatedContent = jsonMatch[1];
      console.log('Extracted JSON from code block');
    }

    // Try to find JSON array in the response
    const arrayMatch = generatedContent.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      generatedContent = arrayMatch[0];
    }

    console.log('Content to parse (first 500 chars):', generatedContent.substring(0, 500));

    // Sanitize the content by removing/escaping control characters
    const sanitizedContent = generatedContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, (char: string) => {
      // Replace common control characters with their escaped versions
      const escapeMap: { [key: string]: string } = {
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
      };
      return escapeMap[char] || '';
    });

    // Parse the scenes
    let scenes;
    try {
      scenes = JSON.parse(sanitizedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed content (first 1000 chars):', sanitizedContent.substring(0, 1000));
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      throw new Error(`Failed to parse AI response: ${errorMessage}`);
    }

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
