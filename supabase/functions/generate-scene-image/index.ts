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
    const { prompt, referenceImageUrl, characterDescription } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Image prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating image with prompt:', prompt);
    console.log('Reference image:', referenceImageUrl ? 'provided' : 'none');
    console.log('Character description:', characterDescription || 'none');

    // Build the message content
    let messageContent: any;
    
    if (referenceImageUrl) {
      // Use multi-modal input with reference image for character consistency
      const characterPrompt = characterDescription 
        ? `Generate a new scene image. IMPORTANT: The character in this reference image must appear in the generated scene with EXACTLY the same appearance, facial features, clothing, and style. Character description: ${characterDescription}. Scene to generate: ${prompt}`
        : `Generate a new scene image. IMPORTANT: The character in this reference image must appear in the generated scene with EXACTLY the same appearance, facial features, clothing, and style. Scene to generate: ${prompt}`;
      
      messageContent = [
        { type: 'text', text: characterPrompt },
        { type: 'image_url', image_url: { url: referenceImageUrl } }
      ];
    } else {
      // Text-only prompt
      const enhancedPrompt = characterDescription 
        ? `${prompt}. Character description for consistency: ${characterDescription}`
        : prompt;
      messageContent = enhancedPrompt;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated in response');
    }

    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-scene-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
