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

  const thumbnailSystem = `You are an ELITE THUMBNAIL DESIGNER who has created thumbnails for MrBeast, Ali Abdaal, and top YouTube creators. You write image generation prompts that produce REAL YouTube-quality thumbnails.

YOUR DESIGN PRINCIPLES:
1. COMPOSITION: Rule of thirds. Subject fills 60%+ of frame. Strong leading lines. No clutter.
2. CONTRAST: High contrast between subject and background. Bright, vibrant colors preferred.
3. COLOR: 2-3 dominant colors max. BRIGHT, SATURATED colors — yellows, reds, blues, greens. Complementary color pairs (blue/orange, purple/gold, red/teal).
4. EXPRESSION: Big, exaggerated facial expressions — surprise, shock, excitement, intensity. Eyes wide, mouth open or tight-lipped determination. The face IS the hook.
5. LIGHTING: BRIGHT, well-lit scenes. Natural daylight, golden hour warmth, or bright studio lighting. NEVER dark, moody, or cinematic darkness. Think: bright, clean, eye-catching.
6. DEPTH: Bokeh background, foreground elements, depth layers. Subject pops from background.
7. FOCUS: Crystal sharp on face/product. Everything else supports the focal point.
8. QUALITY: Shot on RED Komodo, 8K, premium post-production feel. HYPER-REALISTIC humans — real skin with pores, natural texture, NO airbrushed or CGI look.
9. TEXT OVERLAY: Include 2-5 words of BOLD, large, eye-catching text that summarizes the topic. Text should be thick, high-contrast, with a slight shadow/outline for legibility. Think MrBeast/Ali Abdaal thumbnail text style — BIG, BOLD, impossible to miss. Position text strategically so it doesn't cover the face.

BANNED: Dark/moody lighting. Nighttime scenes. Dramatic shadows. Generic stock photo feel. Flat lighting. Busy backgrounds. Small subjects. Low contrast. Cluttered composition. Airbrushed or plastic-looking skin.

OUTPUT: Write ONLY the image generation prompt. No explanation. Under 400 words. Include specific technical photography directions.`;

  const outroSystem = `You are a PREMIUM MOTION GRAPHICS DESIGNER who creates end screens for Netflix, Apple, and top brands. You write image generation prompts that produce professional branded outro cards.

YOUR DESIGN PRINCIPLES:
1. LAYOUT: Clean visual hierarchy. Logo prominent but not overwhelming. CTA text area clear.
2. BACKGROUND: Rich, premium backgrounds — gradient meshes, subtle particle effects, geometric patterns, cinematic bokeh. Can use bright or dark backgrounds depending on brand.
3. STYLE VARIATIONS:
   - "logo-fade": Elegant fade with soft light bloom, premium gradient, clean minimalism
   - "animated-logo": Dynamic energy lines, motion blur trails, kinetic typography feel
   - "glitch-logo": Modern digital glitch — clean RGB split, scan lines, but SHARP and premium, not messy
   - "neon-logo": Glowing neon outlines, dark background, cyberpunk-clean aesthetic, light reflections
4. COLOR: Vibrant, bold accent colors. Premium finish.
5. DEPTH: Layered elements creating dimension. Subtle shadows and light effects.
6. POLISH: Every pixel intentional. Professional color grading. Premium finish.

CRITICAL: The image must have a clear FOCAL AREA where text/CTA will be overlaid. Leave breathing room — don't fill every pixel.

OUTPUT: Write ONLY the image generation prompt. No explanation. Under 400 words.`;

  const userMessage = type === 'thumbnail'
    ? `Design a PREMIUM YouTube/TikTok thumbnail for:
TOPIC: "${context.topic}"
STYLE: ${context.style || 'bright-bold'}
${context.characterDescription ? `CHARACTER: ${context.characterDescription} — HYPER-REALISTIC, natural skin texture with pores, real human appearance` : 'Show a compelling, HYPER-REALISTIC person that matches the topic'}
${context.sceneDescriptions ? `CONTENT CONTEXT: ${context.sceneDescriptions}` : ''}

REQUIREMENTS:
- Vertical 9:16 format (mobile-first)
- The subject/person must be the HERO — large, sharp, commanding, HYPER-REALISTIC
- Expression must be INTENSE and scroll-stopping
- BRIGHT, well-lit scene — daylight, golden hour, or bright studio. NEVER dark or moody
- Background must complement but not compete — bright, colorful, clean
- Color grading must be BRIGHT, vibrant, and eye-catching
- MUST include BOLD TEXT OVERLAY: 2-5 words summarizing the topic in large, thick, high-contrast font with drop shadow — positioned so it doesn't cover the face. Think MrBeast thumbnail text style.
- The text should be the SECONDARY focal point after the person
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

  const systemPrompt = type === 'thumbnail' ? thumbnailSystem : outroSystem;

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
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const designedPrompt = data.content?.[0]?.text?.trim();
        if (designedPrompt && designedPrompt.length >= 30) {
          console.log('Claude designed prompt:', designedPrompt.substring(0, 200));
          return designedPrompt;
        }
      } else {
        const err = await resp.text();
        console.warn('Claude unavailable, falling back to Lovable AI Gateway:', resp.status, err.substring(0, 200));
      }
    } catch (e) {
      console.warn('Claude call threw, falling back to Lovable AI Gateway:', (e as Error).message);
    }
  }

  // Fallback: Lovable AI Gateway (Gemini Pro)
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('Prompt design unavailable (Claude exhausted, no LOVABLE_API_KEY)');

  const gwResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!gwResp.ok) {
    const err = await gwResp.text();
    console.error('Gateway prompt design failed:', gwResp.status, err);
    throw new Error('Failed to design prompt (Claude exhausted, gateway error)');
  }

  const gwData = await gwResp.json();
  const designedPrompt = gwData.choices?.[0]?.message?.content?.trim();
  if (!designedPrompt || designedPrompt.length < 30) {
    throw new Error('Prompt designer returned insufficient output');
  }

  console.log('Gateway designed prompt:', designedPrompt.substring(0, 200));
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

// Step 3a: Generate via Lovable AI Gateway (Gemini image preview) — primary, no billing limits
// Optional referenceImageUrl puts the model in EDIT mode so output preserves the actual product.
async function generateWithGateway(prompt: string, referenceImageUrl?: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const userContent = referenceImageUrl
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: referenceImageUrl } },
      ]
    : prompt;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image-preview',
      messages: [{ role: 'user', content: userContent }],
      modalities: ['image', 'text'],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error('Gateway image error:', resp.status, err);
    if (resp.status === 429) throw new Error('Gateway rate limit. Please try again shortly.');
    if (resp.status === 402) throw new Error('Lovable AI credits exhausted. Add credits in Settings.');
    throw new Error(`Gateway image generation failed: ${resp.status}`);
  }

  const data = await resp.json();
  const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imgUrl) return imgUrl;
  throw new Error('No image in gateway response');
}

// Step 3b: Optional OpenAI fallback (kept for parity, but skipped when billing-limited)
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
    throw new Error(`OpenAI image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  const url = data.data?.[0]?.url;
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('No image in OpenAI response');
}

// Unified: try Gateway first, fall back to OpenAI
async function generateImage(prompt: string, size: string, referenceImageUrl?: string): Promise<string> {
  try {
    return await generateWithGateway(prompt, referenceImageUrl);
  } catch (gwErr) {
    console.warn('Gateway image gen failed, trying OpenAI:', (gwErr as Error).message);
    // OpenAI gpt-image-1 fallback doesn't accept reference image here — fall back to text-only.
    return await generateWithOpenAI(prompt, size);
  }
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
      referenceImageUrl, // NEW: lock output to user's actual product
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

    // Step 3: Generate (Gateway primary, OpenAI fallback). When a reference image is provided
    // we run Gemini in EDIT mode so the output preserves the user's actual product.
    const imageUrl = await generateImage(reviewedPrompt, size, referenceImageUrl);

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
