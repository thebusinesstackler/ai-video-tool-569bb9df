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
    const { outline, characterDescription } = await req.json();
    
    if (!outline) {
      return new Response(
        JSON.stringify({ error: 'Movie outline is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build character context for the prompt
    const characterContext = characterDescription 
      ? `\n\nCRITICAL - MAIN CHARACTER (must appear in EVERY scene with this EXACT description): ${characterDescription}. Use this exact appearance description in every imagePrompt to maintain character consistency.`
      : '';

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
${characterContext}

For each scene, you must provide:
1. Scene number and title
2. Location and time of day
3. Detailed visual description (what the camera sees)
4. Character actions and emotions
5. Complete narration for voiceover (60-120 seconds of content)
6. A detailed image generation prompt that captures the key visual moment${characterDescription ? ` - ALWAYS include the main character with this exact description: ${characterDescription}` : ''}
7. The BEST camera angle for the scene based on emotional impact and visual storytelling
8. The BEST lighting style for the scene based on mood and atmosphere

AVAILABLE CAMERA ANGLES (pick the most appropriate):
- "eye-level": Standard neutral perspective, good for dialogue
- "low-angle": Camera looks up, makes subject appear powerful or imposing
- "high-angle": Camera looks down, makes subject appear vulnerable
- "birds-eye": Directly overhead, dramatic establishing shots
- "dutch-angle": Tilted camera, creates tension and unease
- "over-shoulder": View from behind character, good for conversations
- "pov": Character's point of view, immersive moments
- "close-up": Tight shot on subject, emotional detail, intimate moments
- "wide-shot": Full scene establishing shot, grand locations
- "medium-shot": Waist-up framing, balanced general use

AVAILABLE LIGHTING STYLES (pick the most appropriate):
- "natural": Soft, realistic daylight
- "golden-hour": Warm sunset/sunrise glow, romantic or peaceful
- "blue-hour": Cool twilight atmosphere, mysterious
- "noir": High contrast, dramatic shadows, thriller/mystery
- "studio": Professional three-point setup, interviews
- "moonlight": Cool, ethereal night lighting
- "neon": Vibrant colored lights, cyberpunk/urban night
- "candlelight": Warm, flickering ambiance, intimate
- "overcast": Soft, diffused lighting, melancholy
- "harsh": Strong direct lighting, sharp shadows, confrontation

CRITICAL: Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "sceneNumber": 1,
    "title": "Opening Scene Title",
    "location": "Location description",
    "timeOfDay": "Day/Night/Dawn/Dusk",
    "description": "Detailed description of what happens in this scene",
    "dialogue": "Complete voiceover narration for the scene...",
    "imagePrompt": "Highly detailed cinematic prompt for image generation${characterDescription ? '. MUST include the main character with their exact appearance.' : ''}",
    "selectedCameraAngle": "close-up",
    "selectedLighting": "golden-hour"
  }
]

IMPORTANT FORMATTING RULES:
- Do NOT use quotation marks within the dialogue field
- Do NOT use square brackets within the dialogue field
- Describe sounds and dialogue naturally in plain text
- Make narration 60-120 seconds when spoken to create complete movie scenes
- Include character dialogue, sound descriptions, and atmospheric details all in natural flowing text
- ALWAYS include selectedCameraAngle and selectedLighting - pick the BEST options based on the scene's mood, action, and emotional impact
${characterDescription ? `- The main character (${characterDescription}) MUST appear in every scene's imagePrompt with consistent appearance` : ''}

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

    // Parse the scenes with multiple fallback strategies
    let scenes;
    let lastError;
    
    // Try 1: Direct parse (content is already valid JSON)
    try {
      scenes = JSON.parse(generatedContent);
      console.log('Parsed directly');
    } catch (e1) {
      lastError = e1;
      console.log('Direct parse failed, trying cleanup...');
      
      // Try 2: Clean up common issues
      try {
        let cleaned = generatedContent
          // Remove any BOM or invisible characters at start
          .replace(/^\uFEFF/, '')
          // Fix unescaped newlines inside strings (replace actual newlines with spaces in string values)
          .trim();
        
        scenes = JSON.parse(cleaned);
        console.log('Parsed after basic cleanup');
      } catch (e2) {
        lastError = e2;
        console.log('Basic cleanup failed, trying aggressive cleanup...');
        
        // Try 3: More aggressive cleanup
        try {
          // Remove control characters except those that are valid in JSON strings
          let aggressive = generatedContent
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
            .trim();
          
          scenes = JSON.parse(aggressive);
          console.log('Parsed after aggressive cleanup');
        } catch (e3) {
          lastError = e3;
          console.log('Aggressive cleanup failed, trying line-by-line fix...');
          
          // Try 4: Fix common JSON issues
          try {
            let fixed = generatedContent
              // Remove trailing commas before ] or }
              .replace(/,\s*([\]}])/g, '$1')
              // Fix single quotes to double quotes (careful with apostrophes)
              .replace(/(?<![a-zA-Z])'([^']*)'(?![a-zA-Z])/g, '"$1"')
              .trim();
            
            scenes = JSON.parse(fixed);
            console.log('Parsed after fixing common JSON issues');
          } catch (e4) {
            console.error('All parse attempts failed');
            console.error('Last error:', e4);
            console.error('Content preview:', generatedContent.substring(0, 500));
            throw new Error(`Failed to parse AI response: ${e4 instanceof Error ? e4.message : 'Unknown error'}`);
          }
        }
      }
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid scenes format - expected non-empty array');
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
