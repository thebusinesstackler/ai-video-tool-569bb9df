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
    const { prompt, referenceImageUrl, referenceImages, characterDescription } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Image prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use multiple reference images if provided, otherwise fall back to single reference
    const allReferenceImages: string[] = referenceImages && referenceImages.length > 0 
      ? referenceImages 
      : (referenceImageUrl ? [referenceImageUrl] : []);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating image with prompt:', prompt);
    console.log('Reference images count:', allReferenceImages.length);
    console.log('Character description:', characterDescription || 'none');

    // Build the message content
    let messageContent: any;
    
    if (allReferenceImages.length > 0) {
      // Use multi-modal input with reference images for character consistency
      const characterPrompt = characterDescription 
        ? `Generate a photorealistic image. The person shown in the reference image(s) must appear in the generated scene with EXACTLY the same facial features, skin tone, hair, and overall appearance. Study ALL provided reference images to ensure maximum consistency. Character: ${characterDescription}. Scene: ${prompt}`
        : `Generate a photorealistic image. The person shown in the reference image(s) must appear in the generated scene with EXACTLY the same facial features, skin tone, hair, and overall appearance. Study ALL provided reference images to ensure maximum consistency. Scene: ${prompt}`;
      
      // Build content array with all reference images
      messageContent = [
        { type: 'text', text: characterPrompt },
        // Add all reference images (up to 4 for better consistency)
        ...allReferenceImages.slice(0, 4).map(imgUrl => ({
          type: 'image_url',
          image_url: { url: imgUrl }
        }))
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
    console.log('AI response structure:', JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices?.[0]?.message,
      hasImages: !!data.choices?.[0]?.message?.images,
      imagesLength: data.choices?.[0]?.message?.images?.length,
      messageContent: typeof data.choices?.[0]?.message?.content
    }));

    // Try to extract image from the response
    let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    // If no image in images array, check if content contains base64 image
    if (!imageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.startsWith('data:image')) {
        imageUrl = content;
      } else if (Array.isArray(content)) {
        // Content might be an array with image objects
        const imageItem = content.find((item: any) => 
          item.type === 'image_url' || item.type === 'image'
        );
        if (imageItem?.image_url?.url) {
          imageUrl = imageItem.image_url.url;
        }
      }
    }

    if (!imageUrl) {
      console.error('Full AI response:', JSON.stringify(data, null, 2));
      throw new Error('No image generated in response. The AI may have declined to generate the image or returned text only.');
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
