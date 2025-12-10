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
    const { imageUrls, name, gender } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least 1 image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Analyzing ${imageUrls.length} images for face description`);

    // Build image content for the AI (use up to 3 images for best analysis)
    const imagesToAnalyze = imageUrls.slice(0, 3);
    const imageContent = imagesToAnalyze.map((url: string) => ({
      type: "image_url" as const,
      image_url: { url }
    }));

    const genderContext = gender ? `The person is ${gender}. ` : '';
    const nameContext = name ? `Their name is ${name}. ` : '';

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
            content: `You are an expert at analyzing faces and creating detailed physical descriptions for AI image generation. Your descriptions should be:
1. Detailed enough to recreate the person's likeness in AI-generated images
2. Focus on distinctive features: face shape, eye color/shape, nose, lips, skin tone, hair color/style/texture, facial hair, age range
3. Professional and respectful
4. Written as a continuous description suitable for image generation prompts

Format your response as a single detailed paragraph (50-100 words) that could be used as a character description in an AI image generation prompt.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${nameContext}${genderContext}Please analyze these reference images and create a detailed physical description of this person that can be used for consistent character generation in AI images. Focus on their distinctive facial features, hair, and overall appearance.`
              },
              ...imageContent
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
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
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content;
    
    if (!description) {
      throw new Error('No response from AI');
    }

    console.log('Generated face description:', description);

    return new Response(
      JSON.stringify({ description: description.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-face-description:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze images';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
