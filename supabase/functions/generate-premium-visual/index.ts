import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Step 1: Claude designs the premium prompt
async function designPromptWithClaude(
  type: 'thumbnail' | 'outro',
  context: {
    topic: string;
    style: string;
    ctaText?: string;
    subtitle?: string;
    characterDescription?: string;
    sceneDescriptions?: string;
    logoUrl?: string;
    brandColors?: string;
  }
): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const thumbnailSystem = `You are an ELITE THUMBNAIL DESIGNER who has created thumbnails for MrBeast, Ali Abdaal, and top YouTube creators. You write image generation prompts that produce REAL YouTube-quality thumbnails.

YOUR DESIGN PRINCIPLES:
1. COMPOSITION: Rule of thirds. Subject fills 60%+ of frame. Strong leading lines. No clutter.
2. CONTRAST: High contrast between subject and background. Dark bg + bright subject OR vice versa.
3. COLOR: 2-3 dominant colors max. Complementary color pairs (blue/orange, purple/gold, red/teal).
4. EXPRESSION: Big, exaggerated facial expressions — surprise, shock, excitement, intensity. Eyes wide, mouth open or tight-lipped determination. The face IS the hook.
5. LIGHTING: Dramatic 3-point lighting. Strong key light creating depth. Rim/hair light for separation. Never flat.
6. DEPTH: Bokeh background, foreground elements, depth layers. Subject pops from background.
7. FOCUS: Crystal sharp on face/product. Everything else supports the focal point.
8. QUALITY: Shot on RED Komodo, 8K, cinematic color grade. Premium post-production feel.

BANNED: Generic stock photo feel. Flat lighting. Busy backgrounds. Small subjects. Low contrast. Cluttered composition. Multiple competing focal points.

OUTPUT: Write ONLY the image generation prompt. No explanation. Under 400 words. Include specific technical photography directions.`;

  const outroSystem = `You are a PREMIUM MOTION GRAPHICS DESIGNER who creates end screens for Netflix, Apple, and top brands. You write image generation prompts that produce professional branded outro cards.

YOUR DESIGN PRINCIPLES:
1. LAYOUT: Clean visual hierarchy. Logo prominent but not overwhelming. CTA text area clear.
2. BACKGROUND: Rich, premium backgrounds — gradient meshes, subtle particle effects, geometric patterns, cinematic bokeh.
3. STYLE VARIATIONS:
   - "logo-fade": Elegant fade with soft light bloom, premium gradient, clean minimalism
   - "animated-logo": Dynamic energy lines, motion blur trails, kinetic typography feel
   - "glitch-logo": Modern digital glitch — clean RGB split, scan lines, but SHARP and premium, not messy
   - "neon-logo": Glowing neon outlines, dark background, cyberpunk-clean aesthetic, light reflections
4. COLOR: Dark backgrounds (deep navy, charcoal, true black) with bright accent elements.
5. DEPTH: Layered elements creating dimension. Subtle shadows and light effects.
6. POLISH: Every pixel intentional. Professional color grading. Premium finish.

CRITICAL: The image must have a clear FOCAL AREA where text/CTA will be overlaid. Leave breathing room — don't fill every pixel.

OUTPUT: Write ONLY the image generation prompt. No explanation. Under 400 words.`;

  const userMessage = type === 'thumbnail'
    ? `Design a PREMIUM YouTube/TikTok thumbnail for:
TOPIC: "${context.topic}"
STYLE: ${context.style || 'dramatic'}
${context.characterDescription ? `CHARACTER: ${context.characterDescription}` : 'Show a compelling subject that matches the topic'}
${context.sceneDescriptions ? `CONTENT CONTEXT: ${context.sceneDescriptions}` : ''}

REQUIREMENTS:
- Vertical 9:16 format (mobile-first)
- The subject/person must be the HERO — large, sharp, commanding
- Expression must be INTENSE and scroll-stopping
- Background must complement but not compete
- Color grading must be premium and intentional
- NO text, NO words, NO typography — pure visual only
- Must make someone STOP scrolling and click`
    : `Design a PREMIUM branded outro/end screen:
STYLE: ${context.style || 'logo-fade'}
CTA TEXT AREA FOR: "${context.ctaText || 'Follow for more'}"
${context.subtitle ? `SUBTITLE: "${context.subtitle}"` : ''}
${context.logoUrl ? 'LOGO: A logo will be overlaid — leave prominent center-top space for it' : ''}
${context.brandColors ? `BRAND COLORS: ${context.brandColors}` : 'Use dark premium backgrounds with bright accents'}

REQUIREMENTS:
- Vertical 9:16 format
- Leave clear space for text overlay (center and bottom third)
- Background must be rich and premium, not plain or generic
- Visual hierarchy: background → logo area → CTA area
- Professional broadcast quality finish
- NO actual text or letters in the image — pure visual design only
- Must feel like a Netflix/Apple end screen`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: type === 'thumbnail' ? thumbnailSystem : outroSystem,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('Claude prompt design failed:', resp.status, err);
    throw new Error('Failed to design prompt with Claude');
  }

  const data = await resp.json();
  const designedPrompt = data.content?.[0]?.text?.trim();
  if (!designedPrompt || designedPrompt.length < 30) {
    throw new Error('Claude returned insufficient prompt design');
  }

  console.log('Claude designed prompt:', designedPrompt.substring(0, 200));
  return designedPrompt;
}

// Step 2: Quality review — Claude checks the prompt before generation
async function qualityReviewPrompt(prompt: string, type: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return prompt; // Skip if no key

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
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are a quality reviewer for image generation prompts. Review this ${type} prompt and IMPROVE it if any of these issues exist:
- Weak composition or cluttered layout
- Low contrast or flat lighting
- Generic/stock photo feel
- Missing premium quality cues
- Busy or competing focal points

If the prompt is already strong, return it as-is with minor polish. If weak, rewrite it to be premium.

PROMPT TO REVIEW:
${prompt}

OUTPUT: The improved prompt ONLY. No explanation.`
        }],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const reviewed = data.content?.[0]?.text?.trim();
      if (reviewed && reviewed.length > 30) {
        console.log('Quality review applied');
        return reviewed;
      }
    }
  } catch (e) {
    console.warn('Quality review skipped:', e);
  }

  return prompt;
}

// Step 3: Generate with gpt-image-1
async function generateWithOpenAI(prompt: string, size: string = '1024x1536'): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
    const err = await response.text();
    console.error('OpenAI image error:', response.status, err);
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again.');
    if (response.status === 401 || response.status === 402) throw new Error('OpenAI API key invalid or payment issue.');
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  const url = data.data?.[0]?.url;
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('No image in response');
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

    const body = await req.json();
    const {
      type = 'thumbnail', // 'thumbnail' | 'outro'
      topic = '',
      style = 'dramatic',
      ctaText,
      subtitle,
      characterDescription,
      sceneDescriptions,
      logoUrl,
      brandColors,
      size = '1024x1536',
    } = body;

    if (!topic && type === 'thumbnail') {
      return new Response(
        JSON.stringify({ error: 'Topic is required for thumbnails' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating premium ${type} | style: ${style} | topic: ${topic?.substring(0, 50)}`);

    // Step 1: Claude designs the prompt
    const designedPrompt = await designPromptWithClaude(type, {
      topic, style, ctaText, subtitle, characterDescription, sceneDescriptions, logoUrl, brandColors
    });

    // Step 2: Quality review
    const reviewedPrompt = await qualityReviewPrompt(designedPrompt, type);

    // Step 3: Generate with gpt-image-1
    const imageUrl = await generateWithOpenAI(reviewedPrompt, size);

    console.log(`Premium ${type} generated successfully`);

    return new Response(
      JSON.stringify({ imageUrl, prompt: reviewedPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-premium-visual:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
