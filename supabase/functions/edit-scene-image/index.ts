import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Enhance prompt using Claude or GPT-4o for better image quality
async function enhancePromptForDallE(rawPrompt: string, characterConstraint?: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  const constraintBlock = characterConstraint
    ? `\n\nCRITICAL CHARACTER CONSTRAINT (NEVER VIOLATE): ${characterConstraint}\nYou MUST preserve exactly this gender, ethnicity, age range, and appearance in the enhanced prompt. Do NOT change, swap, or reinterpret any of these attributes.`
    : '';

  const systemMsg = `You are an expert image prompt engineer for DALL-E / gpt-image-1. Given a scene description, rewrite it into a detailed, photorealistic image prompt optimized for best quality output. Include specifics about lighting, composition, camera lens, color grading, and atmosphere.${constraintBlock}\nKeep it under 300 words. Output ONLY the enhanced prompt, nothing else.`;

  // Try Claude first
  if (ANTHROPIC_API_KEY) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: `${systemMsg}\n\nScene: ${rawPrompt}` }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data.content?.[0]?.text?.trim();
        if (text && text.length > 20) {
          console.log('Prompt enhanced via Claude');
          return text;
        }
      }
    } catch (e) {
      console.warn('Claude prompt enhancement failed:', e);
    }
  }

  // Fallback to OpenAI GPT-4o
  if (OPENAI_API_KEY) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: rawPrompt },
          ],
          max_tokens: 500,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 20) {
          console.log('Prompt enhanced via GPT-4o');
          return text;
        }
      }
    } catch (e) {
      console.warn('GPT-4o prompt enhancement failed:', e);
    }
  }

  return rawPrompt;
}

// Generate image using OpenAI gpt-image-1
async function generateWithOpenAI(prompt: string, openaiKey: string, size: string = '1024x1024'): Promise<string> {
  console.log('Generating image with OpenAI gpt-image-1');

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
      size,
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

  const cameraInstruction = cameraAngle ? `CAMERA ANGLE: Use a ${cameraAngle} for this shot. ` : '';
  const backgroundInstruction = backgroundDescription
    ? `BACKGROUND: The background MUST be: ${backgroundDescription}. `
    : '';

  // Strong character identity enforcement
  const characterBlock = characterDescription
    ? `\n\n*** MANDATORY CHARACTER IDENTITY (DO NOT DEVIATE) ***\nThe main person MUST be: ${characterDescription}.\nThis is NON-NEGOTIABLE. The person's gender, ethnicity, age, and physical appearance MUST match this description exactly. Do NOT substitute, swap, or reinterpret any aspect of their identity. If ANY part of the scene description conflicts with this character identity, the character identity ALWAYS wins.\n`
    : '';

  if (characterTransformation) {
    return `Generate a new scene image: ${prompt}

IMPORTANT CHARACTER TRANSFORMATION: ${characterTransformation}.
${characterBlock}${cameraInstruction}${backgroundInstruction}

Apply this transformation: ${characterTransformation}
Keep the scene composition similar but transform the character as specified.
Photorealistic, cinematic quality, 8K detail.`;
  }

  return `Generate a PHOTOREALISTIC scene image: ${prompt}

REALISM RULES:
- HYPERREALISTIC human appearance — real skin with visible pores, natural texture
- Natural lighting — soft window light, golden hour, overcast daylight
- Eyes with realistic catchlights, natural iris detail
- Hair with individual strand detail and natural movement
- Character should appear natural and engaged
- Real human proportions and natural body language
${characterBlock}${cameraInstruction}${backgroundInstruction}

Professional cinematic quality, natural lighting, photorealistic.`;
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
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
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
    });

    const promptOpts = {
      characterDescription,
      characterTransformation,
      cameraAngle,
      backgroundDescription,
      refCount: allReferenceImages.length,
    };

    // Build the raw prompt including all context
    const rawPrompt = buildPromptText(prompt, promptOpts);

    // Enhance the prompt for better DALL-E output, with character constraint
    const enhancedPrompt = await enhancePromptForDallE(rawPrompt, characterDescription || undefined);

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} of ${MAX_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const imageUrl = await generateWithOpenAI(enhancedPrompt, OPENAI_API_KEY);

        console.log('Image generated successfully, camera angle:', cameraAngle);

        return new Response(
          JSON.stringify({ imageUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Attempt ${attempt + 1} failed:`, lastError.message);

        if (lastError.message === 'RATE_LIMIT') {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (lastError.message === 'AUTH_ERROR') {
          return new Response(
            JSON.stringify({ error: 'OpenAI API key invalid or payment issue. Check your API key.' }),
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
