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
      characterDescription, 
      characterTransformation,
      cameraAngle,
      backgroundDescription 
    } = await req.json();

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
      hasCharacterTransformation: !!characterTransformation,
      cameraAngle: cameraAngle || 'not specified',
      hasBackgroundDescription: !!backgroundDescription,
      promptLength: prompt.length
    });

    let messages: any[];
    
    if (referenceImageUrl) {
      // Build transformation instruction if provided
      const transformInstruction = characterTransformation 
        ? `IMPORTANT CHARACTER TRANSFORMATION: ${characterTransformation}. ` 
        : '';
      
      const characterInstruction = characterDescription 
        ? `Character description: ${characterDescription}. ` 
        : '';
      
      // Camera angle instruction
      const cameraInstruction = cameraAngle
        ? `CAMERA ANGLE: Use a ${cameraAngle} for this shot. `
        : '';
      
      // Background consistency instruction
      const backgroundInstruction = backgroundDescription
        ? `BACKGROUND CONSISTENCY (CRITICAL): The background MUST be: ${backgroundDescription}. Keep the EXACT same environment, lighting, and atmosphere as specified. Only change the camera angle and character pose. `
        : 'BACKGROUND CONSISTENCY: Maintain the same environment and lighting as the reference image. ';
      
      // Different prompts based on whether transformation is requested
      const instructionText = characterTransformation
        ? `Generate a new scene image based on this prompt: ${prompt}

${transformInstruction}${characterInstruction}${cameraInstruction}

Use the reference image for:
- Pose and body position
- Clothing style and overall aesthetic
- Lighting and composition
- Scene atmosphere and framing

${backgroundInstruction}

BUT APPLY THIS TRANSFORMATION: ${characterTransformation}

Keep the scene composition similar but transform the character as specified.`
        : `Generate a scene image based on this prompt: ${prompt}

${characterInstruction}${cameraInstruction}${backgroundInstruction}

Use the reference image as STYLE INSPIRATION for:
- Professional appearance and demeanor
- Clothing style and aesthetic
- Lighting quality and composition
- Scene atmosphere and framing
- Overall visual quality

${cameraAngle ? `Use this SPECIFIC camera angle: ${cameraAngle}` : ''}

The generated image should match the scene description exactly. Use the reference for visual style and quality, not identity.
IMPORTANT: Follow the scene prompt's description of the character. Generate a high-quality professional image matching the prompt.`;

      messages = [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: instructionText
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
      // Standard text-only request with camera angle
      const cameraNote = cameraAngle 
        ? ` Use this specific camera angle: ${cameraAngle}.`
        : '';
      const backgroundNote = backgroundDescription
        ? ` The background must be: ${backgroundDescription}.`
        : '';
        
      messages = [{
        role: 'user',
        content: prompt + cameraNote + backgroundNote
      }];
    }

    // Retry logic for intermittent failures
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} of ${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff
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
        console.log('AI response structure:', JSON.stringify({
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          hasMessage: !!data.choices?.[0]?.message,
          hasImages: !!data.choices?.[0]?.message?.images,
          imagesLength: data.choices?.[0]?.message?.images?.length,
          messageContent: data.choices?.[0]?.message?.content?.slice?.(0, 200)
        }));

        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          const textContent = data.choices?.[0]?.message?.content;
          if (textContent) {
            console.warn('Model returned text instead of image:', textContent.slice(0, 300));
          }
          throw new Error('No image generated - retrying...');
        }

        console.log('Image generated/edited successfully with reference, camera angle:', cameraAngle);

        return new Response(
          JSON.stringify({ imageUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt === MAX_RETRIES) {
          break; // Exit loop, will throw below
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('Failed to generate image after retries');

  } catch (error) {
    console.error('Error in edit-scene-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to edit image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
