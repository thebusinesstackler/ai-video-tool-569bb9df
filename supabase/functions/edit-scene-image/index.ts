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

    console.log('Editing/generating image with reference:', {
      hasReferenceImage: !!referenceImageUrl,
      hasCharacterDescription: !!characterDescription,
      promptLength: prompt.length
    });

    let messages: any[];
    
    if (referenceImageUrl) {
      // Use multimodal request with reference image for character consistency
      const characterInstruction = characterDescription 
        ? `Character description: ${characterDescription}. ` 
        : '';
      
      messages = [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Generate a new scene image based on this prompt: ${prompt}

${characterInstruction}CRITICAL INSTRUCTION: The main character/person in the new image MUST look EXACTLY like the person in the reference image provided. Maintain the same:
- Facial features (face shape, eyes, nose, mouth)
- Hair style and color
- Skin tone
- Body type and proportions
- Clothing style if visible

The scene and background should match the prompt, but the character must be visually identical to the reference.`
          },
          {
            type: 'image_url',
            image_url: {
              url: referenceImageUrl
            }
          }
        ]
      }];
    } else {
      // Standard text-only request
      messages = [{
        role: 'user',
        content: prompt
      }];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages,
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

    console.log('Image generated/edited successfully with reference');

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in edit-scene-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to edit image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
