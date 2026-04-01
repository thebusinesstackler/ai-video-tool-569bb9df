import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate image using OpenAI DALL-E (gpt-image-1) - no reference image support
async function generateWithOpenAI(prompt: string, openaiKey: string): Promise<string> {
  console.log('Using OpenAI gpt-image-1 for generation');
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI error:', response.status, errorText);
    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (response.status === 402 || response.status === 401) throw new Error('AUTH_ERROR');
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  const url = data.data?.[0]?.url;
  
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('No image in OpenAI response');
}

// Generate/edit image using Lovable AI (Gemini) - supports reference images
async function generateWithLovableAI(messages: any[], lovableKey: string): Promise<string> {
  console.log('Using Lovable AI (Gemini) for generation');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
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
    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (response.status === 402) throw new Error('CREDITS_EXHAUSTED');
    throw new Error(`AI Gateway error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    const textContent = data.choices?.[0]?.message?.content;
    if (textContent) console.warn('Model returned text instead of image:', textContent.slice(0, 300));
    throw new Error('No image generated');
  }
  return imageUrl;
}

function buildPromptText(
  prompt: string,
  opts: {
    characterDescription?: string;
    characterTransformation?: string;
    cameraAngle?: string;
    backgroundDescription?: string;
    refCount: number;
  }
): string {
  const { characterDescription, characterTransformation, cameraAngle, backgroundDescription, refCount } = opts;

  const transformInstruction = characterTransformation ? `IMPORTANT CHARACTER TRANSFORMATION: ${characterTransformation}. ` : '';
  const characterInstruction = characterDescription ? `Character description: ${characterDescription}. ` : '';
  const cameraInstruction = cameraAngle ? `CAMERA ANGLE: Use a ${cameraAngle} for this shot. ` : '';
  const backgroundInstruction = backgroundDescription
    ? `BACKGROUND CONSISTENCY (CRITICAL): The background MUST be: ${backgroundDescription}. Keep the EXACT same environment, lighting, and atmosphere as specified. Only change the camera angle and character pose. `
    : 'BACKGROUND CONSISTENCY: Maintain the same environment and lighting as the reference image. ';
  const multiRefInstruction = refCount > 1
    ? `CRITICAL: Study ALL ${refCount} reference images to ensure MAXIMUM character consistency. The character's face, skin tone, hair, and features must match EXACTLY across all generated scenes. `
    : '';

  if (characterTransformation) {
    return `Generate a new scene image based on this prompt: ${prompt}

${multiRefInstruction}${transformInstruction}${characterInstruction}${cameraInstruction}

Use the reference image(s) for:
- Pose and body position
- Clothing style and overall aesthetic
- Lighting and composition
- Scene atmosphere and framing

${backgroundInstruction}

BUT APPLY THIS TRANSFORMATION: ${characterTransformation}

Keep the scene composition similar but transform the character as specified.`;
  }

  return `Generate a PHOTOREALISTIC scene image showing the EXACT SAME PERSON from the reference images in this new scene: ${prompt}

CRITICAL IDENTITY RULES:
- IGNORE any gender references in the prompt text - use the ACTUAL person from reference images
- The person's face, body, gender, skin tone, hair MUST match the reference images EXACTLY
- Do NOT change the person's appearance or gender under any circumstances

CRITICAL REALISM RULES:
- HYPERREALISTIC human appearance — real skin with visible pores, natural texture, subsurface scattering
- NEVER produce plastic, CGI, airbrushed, or doll-like skin
- Natural lighting ONLY — soft window light, golden hour, overcast daylight, practical lighting
- Eyes with realistic catchlights, natural iris detail, slight moisture
- Hair with individual strand detail and natural movement
- Character should appear READY TO SPEAK — mouth slightly parted, engaged expression, direct eye contact
- Real human proportions and natural body language

${multiRefInstruction}${characterInstruction}${cameraInstruction}${backgroundInstruction}

Use the reference image(s) to MAINTAIN EXACT CHARACTER IDENTITY:
- SAME person, SAME gender, SAME facial features
- Professional appearance and demeanor
- Clothing style and aesthetic
- Natural, realistic lighting
- Scene atmosphere and framing

${cameraAngle ? `Use this SPECIFIC camera angle: ${cameraAngle}` : ''}

Generate a photorealistic image showing the SAME PERSON from the references in the described scene, with natural lighting and real human skin texture.`;
}

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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('No image generation API key configured');
    }
    
    const allReferenceImages: string[] = referenceImages && referenceImages.length > 0 
      ? referenceImages 
      : (referenceImageUrl ? [referenceImageUrl] : []);

    console.log('Image generation request:', {
      referenceImagesCount: allReferenceImages.length,
      hasCharacterDescription: !!characterDescription,
      hasCharacterTransformation: !!characterTransformation,
      cameraAngle: cameraAngle || 'not specified',
      hasBackgroundDescription: !!backgroundDescription,
      hasOpenAI: !!OPENAI_API_KEY,
      hasLovable: !!LOVABLE_API_KEY,
    });

    const promptOpts = {
      characterDescription,
      characterTransformation,
      cameraAngle,
      backgroundDescription,
      refCount: allReferenceImages.length,
    };

    // Strategy:
    // - If reference images exist → must use Lovable AI (Gemini) since DALL-E can't take reference images
    // - If no reference images → prefer OpenAI (DALL-E), fall back to Lovable AI
    const hasRefs = allReferenceImages.length > 0;

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} of ${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        let imageUrl: string;

        if (hasRefs && LOVABLE_API_KEY) {
          // Reference images → Lovable AI (Gemini multimodal)
          const instructionText = buildPromptText(prompt, promptOpts);
          const imageContents = allReferenceImages.slice(0, 4).map(imgUrl => ({
            type: 'image_url',
            image_url: { url: imgUrl }
          }));
          const messages = [{
            role: 'user',
            content: [
              { type: 'text', text: instructionText },
              ...imageContents
            ]
          }];
          imageUrl = await generateWithLovableAI(messages, LOVABLE_API_KEY);

        } else if (OPENAI_API_KEY) {
          // No reference images → OpenAI DALL-E
          const cameraNote = cameraAngle ? ` Use this specific camera angle: ${cameraAngle}.` : '';
          const bgNote = backgroundDescription ? ` The background must be: ${backgroundDescription}.` : '';
          const charNote = characterDescription ? ` Character: ${characterDescription}.` : '';
          const fullPrompt = prompt + charNote + cameraNote + bgNote;
          imageUrl = await generateWithOpenAI(fullPrompt, OPENAI_API_KEY);

        } else if (LOVABLE_API_KEY) {
          // Fallback to Lovable AI text-only
          const cameraNote = cameraAngle ? ` Use this specific camera angle: ${cameraAngle}.` : '';
          const bgNote = backgroundDescription ? ` The background must be: ${backgroundDescription}.` : '';
          const messages = [{ role: 'user', content: prompt + cameraNote + bgNote }];
          imageUrl = await generateWithLovableAI(messages, LOVABLE_API_KEY);

        } else {
          throw new Error('No suitable API key available for this request');
        }

        console.log('Image generated successfully, camera angle:', cameraAngle);

        return new Response(
          JSON.stringify({ imageUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry on auth/payment errors
        if (lastError.message === 'RATE_LIMIT') {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (lastError.message === 'AUTH_ERROR') {
          return new Response(
            JSON.stringify({ error: 'API key invalid or payment issue. Check your OpenAI API key.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (lastError.message === 'CREDITS_EXHAUSTED') {
          // If OpenAI is available, retry with it (no refs case)
          if (!hasRefs && OPENAI_API_KEY) {
            console.log('Lovable AI credits exhausted, falling back to OpenAI');
            try {
              const cameraNote = cameraAngle ? ` Use this specific camera angle: ${cameraAngle}.` : '';
              const bgNote = backgroundDescription ? ` The background must be: ${backgroundDescription}.` : '';
              const charNote = characterDescription ? ` Character: ${characterDescription}.` : '';
              const fullPrompt = prompt + charNote + cameraNote + bgNote;
              const imageUrl = await generateWithOpenAI(fullPrompt, OPENAI_API_KEY);
              return new Response(
                JSON.stringify({ imageUrl }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } catch (fallbackErr) {
              console.error('OpenAI fallback also failed:', fallbackErr);
            }
          }
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (attempt === MAX_RETRIES) break;
      }
    }

    throw lastError || new Error('Failed to generate image after retries');

  } catch (error) {
    console.error('Error in edit-scene-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to edit image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
