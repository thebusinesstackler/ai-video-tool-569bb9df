import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_PROMPT_LENGTH = 5000;
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

// Enhance prompt using Claude or GPT-4o for better DALL-E output
async function enhancePrompt(rawPrompt: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  const systemMsg = `You are an expert image prompt engineer for DALL-E / gpt-image-1. Rewrite the given scene description into a hyper-realistic cinematic image prompt. MANDATORY quality directives to include:
- HYPER-REALISTIC skin with visible pores, natural imperfections, micro-wrinkles, and subsurface scattering
- Professional cinematic lighting: specify exact lighting setup (e.g. key light at 45°, fill light, rim/hair light, practical lights in scene)
- Natural color grading with accurate skin tones, no oversaturation
- Shallow depth of field with bokeh when appropriate
- Camera lens specification (e.g. 85mm f/1.4, 35mm wide angle)
- Atmospheric details: dust particles in light, lens flare, volumetric haze if appropriate
Keep under 300 words. Output ONLY the enhanced prompt.`;

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
        if (text && text.length > 20) return text;
      }
    } catch (e) {
      console.warn('Claude enhancement failed:', e);
    }
  }

  if (OPENAI_API_KEY) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: rawPrompt }],
          max_tokens: 500,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 20) return text;
      }
    } catch (e) {
      console.warn('GPT-4o enhancement failed:', e);
    }
  }

  return rawPrompt;
}

// Generate image with OpenAI gpt-image-1
async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1536', // Portrait-ish for 9:16
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI image error:', response.status, errorText);
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
    if (response.status === 401 || response.status === 402) throw new Error('OpenAI API key invalid or payment issue.');
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  const url = data.data?.[0]?.url;
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('No image generated in response');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Image prompt is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (characterDescription && typeof characterDescription === 'string' && characterDescription.length > MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Character description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUrl(referenceImageUrl) || !validateUrl(locationReference)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (referenceImages) {
      if (!Array.isArray(referenceImages) || referenceImages.length > MAX_REFERENCE_IMAGES) {
        return new Response(
          JSON.stringify({ error: `Reference images must be an array of max ${MAX_REFERENCE_IMAGES}` }),
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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const sanitizedPrompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    const sanitizedDescription = characterDescription?.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

    console.log('Generating image with prompt length:', sanitizedPrompt.length);

    // Build blocking instructions
    let blockingInstructions = '';
    if (characterBlocking && Array.isArray(characterBlocking) && characterBlocking.length > 0) {
      blockingInstructions = '\n\nCHARACTER POSITIONING:\n' + characterBlocking.map((block: any) =>
        `- ${String(block.characterName || 'Character').slice(0, 100)}: positioned ${String(block.startPosition || 'center').slice(0, 50)} of frame, facing ${String(block.facing || 'forward').slice(0, 50)}${block.movement !== 'Stays stationary' ? `, ${String(block.movement || '').slice(0, 100)}` : ''}`
      ).join('\n');
    }

    // Build comprehensive text prompt (since DALL-E doesn't accept reference images)
    let rawPrompt = `Generate a cinematic, photorealistic movie scene image. ${sanitizedPrompt}`;

    if (sanitizedDescription) {
      rawPrompt += `\nThe main character: ${sanitizedDescription}`;
    }

    if (locationReference) {
      rawPrompt += `\nSet in a location matching a specific reference environment — maintain architectural style and atmosphere.`;
    }

    if (blockingInstructions) {
      rawPrompt += blockingInstructions;
    }

    rawPrompt += `\n\nVertical 9:16 portrait format. Ultra photorealistic, cinematic lighting, film-grade quality.`;

    // Enhance prompt for better DALL-E output
    const enhancedPrompt = await enhancePrompt(rawPrompt);

    const imageUrl = await generateImage(enhancedPrompt, OPENAI_API_KEY);

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
