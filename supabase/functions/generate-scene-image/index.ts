import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Validation limits
const MAX_PROMPT_LENGTH = 2000;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_URL_LENGTH = 2048;
const MAX_REFERENCE_IMAGES = 4;

function validateUrl(url: string | undefined): boolean {
  if (!url) return true;
  if (url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'data:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists (JWT verified by Supabase)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      prompt, 
      referenceImageUrl, 
      referenceImages, 
      characterDescription,
      locationReference,
      characterBlocking
    } = await req.json();

    // Validate required prompt
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Image prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate character description
    if (characterDescription && typeof characterDescription === 'string' && characterDescription.length > MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Character description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URLs
    if (!validateUrl(referenceImageUrl)) {
      return new Response(
        JSON.stringify({ error: 'Invalid reference image URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUrl(locationReference)) {
      return new Response(
        JSON.stringify({ error: 'Invalid location reference URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate reference images array
    if (referenceImages) {
      if (!Array.isArray(referenceImages)) {
        return new Response(
          JSON.stringify({ error: 'Reference images must be an array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (referenceImages.length > MAX_REFERENCE_IMAGES) {
        return new Response(
          JSON.stringify({ error: `Maximum ${MAX_REFERENCE_IMAGES} reference images allowed` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      for (const img of referenceImages) {
        if (!validateUrl(img)) {
          return new Response(
            JSON.stringify({ error: 'Invalid URL in reference images array' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Sanitize text inputs
    const sanitizedPrompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    const sanitizedDescription = characterDescription?.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    
    // Use multiple reference images if provided, otherwise fall back to single reference
    const allReferenceImages: string[] = referenceImages && referenceImages.length > 0 
      ? referenceImages 
      : (referenceImageUrl ? [referenceImageUrl] : []);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating image with prompt length:', sanitizedPrompt.length);
    console.log('Reference images count:', allReferenceImages.length);

    // Build blocking instructions if provided
    let blockingInstructions = '';
    if (characterBlocking && Array.isArray(characterBlocking) && characterBlocking.length > 0) {
      blockingInstructions = '\n\nCHARACTER POSITIONING:\n' + characterBlocking.map((block: any) => 
        `- ${String(block.characterName || 'Character').slice(0, 100)}: positioned ${String(block.startPosition || 'center').slice(0, 50)} of frame, facing ${String(block.facing || 'forward').slice(0, 50)}${block.movement !== 'Stays stationary' ? `, ${String(block.movement || '').slice(0, 100)}` : ''}`
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

SCENE TO CREATE: ${sanitizedPrompt}${blockingInstructions}

Place the reference person(s) naturally into this scene setting. Focus on lighting, composition, and atmosphere while preserving the person's authentic appearance and the location's visual identity.`;
      
      messageContent = [
        { type: 'text', text: characterPrompt },
        ...allReferenceImages.slice(0, 4).map(imgUrl => ({
          type: 'image_url',
          image_url: { url: imgUrl }
        })),
        ...(locationReference ? [{
          type: 'image_url',
          image_url: { url: locationReference }
        }] : [])
      ];
    } else {
      let enhancedPrompt = sanitizedDescription 
        ? `Generate a cinematic, photorealistic movie scene image. ${sanitizedPrompt}. The main character: ${sanitizedDescription}`
        : `Generate a cinematic, photorealistic movie scene image. ${sanitizedPrompt}`;
      
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
        model: 'google/gemini-3.1-flash-image-preview',
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

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.startsWith('data:image')) {
        imageUrl = content;
      } else if (Array.isArray(content)) {
        const imageItem = content.find((item: any) => 
          item.type === 'image_url' || item.type === 'image'
        );
        if (imageItem?.image_url?.url) {
          imageUrl = imageItem.image_url.url;
        }
      }
    }

    if (!imageUrl && allImages.length > 0) {
      const refusalContent = data.choices?.[0]?.message?.content;
      if (typeof refusalContent === 'string' && refusalContent.toLowerCase().includes('cannot')) {
        console.log('Model declined reference images, retrying with text-only prompt...');
        
        const textOnlyPrompt = sanitizedDescription 
          ? `Generate a cinematic, photorealistic movie scene image. ${sanitizedPrompt}. The main character: ${sanitizedDescription}${blockingInstructions}`
          : `Generate a cinematic, photorealistic movie scene image. ${sanitizedPrompt}${blockingInstructions}`;
        
        const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: textOnlyPrompt }],
            modalities: ['image', 'text']
          }),
        });
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          imageUrl = retryData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (!imageUrl) {
            const retryContent = retryData.choices?.[0]?.message?.content;
            if (typeof retryContent === 'string' && retryContent.startsWith('data:image')) {
              imageUrl = retryContent;
            }
          }
        }
      }
    }

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
