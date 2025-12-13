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
    const { 
      prompt, 
      referenceImageUrl, 
      referenceImages, 
      characterDescription,
      locationReference,  // New: Location reference image for background consistency
      characterBlocking   // New: Character positioning info
    } = await req.json();

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
    console.log('Location reference:', locationReference ? 'provided' : 'none');
    console.log('Character blocking:', characterBlocking ? JSON.stringify(characterBlocking) : 'none');

    // Build blocking instructions if provided
    let blockingInstructions = '';
    if (characterBlocking && Array.isArray(characterBlocking) && characterBlocking.length > 0) {
      blockingInstructions = '\n\nCHARACTER POSITIONING:\n' + characterBlocking.map((block: any) => 
        `- ${block.characterName}: positioned ${block.startPosition} of frame, facing ${block.facing}${block.movement !== 'Stays stationary' ? `, ${block.movement}` : ''}`
      ).join('\n');
    }

    // Build the message content
    let messageContent: any;
    
    // Collect all images: character references + location reference
    const allImages: string[] = [...allReferenceImages];
    if (locationReference) {
      allImages.push(locationReference);
    }
    
    if (allImages.length > 0) {
      // Use multi-modal input with reference images for character AND location consistency
      let characterPrompt = `Generate a cinematic, photorealistic image for a movie scene.`;
      
      if (allReferenceImages.length > 0) {
        characterPrompt += `

REFERENCE PERSON(S): Use the person(s) from the first ${allReferenceImages.length} reference image(s) as the main subject(s). Keep their EXACT appearance - same face, same features, same look. Do NOT change their hair color, eye color, or any physical features.`;
      }
      
      if (locationReference) {
        characterPrompt += `

LOCATION REFERENCE: Use the LAST reference image as the background/environment. Keep the same architectural style, colors, props, and lighting. The scene should feel like it's taking place in this exact location.`;
      }
      
      characterPrompt += `

SCENE TO CREATE: ${prompt}${blockingInstructions}

Place the reference person(s) naturally into this scene setting. Focus on lighting, composition, and atmosphere while preserving the person's authentic appearance and the location's visual identity.`;
      
      // Build content array with all reference images (characters first, then location)
      messageContent = [
        { type: 'text', text: characterPrompt },
        // Add character reference images (up to 4)
        ...allReferenceImages.slice(0, 4).map(imgUrl => ({
          type: 'image_url',
          image_url: { url: imgUrl }
        })),
        // Add location reference if provided
        ...(locationReference ? [{
          type: 'image_url',
          image_url: { url: locationReference }
        }] : [])
      ];
    } else {
      // Text-only prompt - can use character description since there's no reference to conflict with
      let enhancedPrompt = characterDescription 
        ? `Generate a cinematic, photorealistic movie scene image. ${prompt}. The main character: ${characterDescription}`
        : `Generate a cinematic, photorealistic movie scene image. ${prompt}`;
      
      if (blockingInstructions) {
        enhancedPrompt += blockingInstructions;
      }
      
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
