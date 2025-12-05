import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntroOutroConfig {
  introTemplate?: string;
  introText?: string;
  outroTemplate?: string;
  outroText?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      topic, 
      sceneCount = 4, 
      targetDuration = 30,
      introConfig,
      outroConfig
    } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating reel script for topic:', topic);
    console.log('Intro config:', introConfig);
    console.log('Outro config:', outroConfig);

    // Calculate scene duration excluding intro/outro
    const introDuration = introConfig?.introTemplate && introConfig.introTemplate !== 'none' ? 3 : 0;
    const outroDuration = outroConfig?.outroTemplate && outroConfig.outroTemplate !== 'none' ? 3 : 0;
    const contentDuration = targetDuration - introDuration - outroDuration;
    
    // Calculate scene duration - max 8 seconds per scene (WaveSpeed limit)
    const maxSceneDuration = 8;
    const sceneDuration = Math.min(Math.round(contentDuration / sceneCount), maxSceneDuration);
    
    // Calculate word count for 8 seconds max (speaking rate ~2.5 words/sec = 20 words max)
    const maxWordsPerScene = 20;

    const systemPrompt = `You are an elite short-form video scriptwriter and visual director for viral TikTok/Instagram content.

Your scripts MUST:
- Open with an IRRESISTIBLE hook in scene 1 (question, bold claim, pattern interrupt)
- Keep narrations punchy: MAX ${maxWordsPerScene} words per scene (~${sceneDuration} seconds spoken)
- Use conversational, scroll-stopping language
- End with clear value or CTA

Your visual descriptions MUST:
- Maintain PERFECT visual consistency across ALL scenes (same style, lighting, color palette)
- Describe a SPECIFIC recurring character/presenter if showing people (exact age, gender, ethnicity, hair, clothing)
- Include: camera angle, lighting style, background environment, mood/atmosphere, color grading
- Be detailed enough for AI image generation to produce cohesive results
- Use the SAME visual style keywords across all scenes for consistency
- Format: "Style: [consistent style]. Subject: [what's shown]. Camera: [angle]. Lighting: [type]. Background: [environment]. Colors: [palette]. Mood: [atmosphere]."`;

    const userPrompt = `Create ${sceneCount} scene scripts for a ${contentDuration}-second viral Reel about: "${topic}"

CRITICAL REQUIREMENTS:

1. NARRATION (${maxWordsPerScene} words MAX per scene):
   - Scene 1: MUST start with a powerful hook (question, shocking fact, "Stop scrolling if...", "Nobody talks about...", "The secret to...")
   - Middle scenes: Deliver value with punchy, memorable lines
   - Final scene: Strong conclusion or call-to-action

2. VISUAL DESCRIPTIONS (EXTREMELY DETAILED for AI image consistency):
   - First, decide on ONE visual style that will apply to ALL scenes (e.g., "cinematic 4K, warm golden hour lighting, shallow depth of field, film grain")
   - If showing a person/character: describe them IDENTICALLY in every scene (e.g., "young Asian woman, 25, long black hair, white blouse, confident expression")
   - Include for EVERY scene: exact camera angle (close-up/medium/wide), lighting direction, background details, color palette, mood keywords
   - Use the EXACT same style descriptors across scenes to ensure visual coherence

Return ONLY a valid JSON array with exactly ${sceneCount} scenes:
[
  {
    "sceneNumber": 1,
    "narration": "Hook line here - MAX ${maxWordsPerScene} words",
    "visualDescription": "Style: [consistent style across all scenes]. Subject: [detailed description]. Camera: [angle]. Lighting: [type]. Background: [environment]. Colors: [specific palette]. Mood: [atmosphere]. Keywords: [additional AI prompt keywords]",
    "duration": ${sceneDuration}
  }
]

EXAMPLE visual description format:
"Style: Cinematic 4K, warm amber tones, soft film grain, professional lighting. Subject: A confident 30-year-old Caucasian man with short brown hair, trimmed beard, wearing a navy blue polo shirt. Camera: Medium close-up, eye level. Lighting: Soft key light from left, natural fill. Background: Modern minimalist home office with plants, blurred bokeh. Colors: Warm amber, cream, navy accents. Mood: Trustworthy, engaging, professional. Keywords: social media talking head, vertical 9:16, ultra realistic."`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('Raw AI response:', content.substring(0, 500));

    // Extract JSON from the response - try multiple approaches
    let jsonContent = content;
    
    // Try to extract from code blocks first
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    } else {
      // Try to find JSON array directly
      const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonContent = arrayMatch[0];
      }
    }

    // Clean up problematic characters that break JSON parsing
    jsonContent = jsonContent
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Remove control characters
      .replace(/\r\n/g, '\\n') // Normalize line endings in strings
      .replace(/\r/g, '\\n')
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\\/g, '\\\\') // Escape backslashes (but not already escaped ones)
      .replace(/\\\\\\/g, '\\\\') // Fix over-escaping
      .replace(/\\\\"/g, '\\"') // Fix quote escaping
      .replace(/([^\\])"/g, '$1\\"') // This might cause issues, let's be careful
      .trim();

    // Actually, let's use a safer approach - just clean control chars
    jsonContent = content;
    const jsonMatch2 = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch2) {
      jsonContent = jsonMatch2[1].trim();
    } else {
      const arrayMatch2 = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch2) {
        jsonContent = arrayMatch2[0];
      }
    }
    
    // Safe cleanup
    jsonContent = jsonContent
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .trim();

    // Parse the scenes with error handling
    let scenes;
    try {
      scenes = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonContent.substring(0, 500));
      
      // Try to fix common JSON issues
      try {
        // Remove trailing commas before ] or }
        let fixedJson = jsonContent
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"'); // Replace single quotes with double
        scenes = JSON.parse(fixedJson);
      } catch (retryError) {
        console.error('Retry parse also failed:', retryError);
        throw new Error('Failed to parse AI response as JSON. Please try again.');
      }
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid scenes format');
    }

    // Extract visual style from first scene for consistency
    const baseVisualStyle = extractVisualStyle(scenes[0]?.visualDescription || '');
    console.log('Base visual style extracted:', baseVisualStyle);

    // Renumber scenes to account for intro
    const hasIntro = introConfig?.introTemplate && introConfig.introTemplate !== 'none';
    const hasOutro = outroConfig?.outroTemplate && outroConfig.outroTemplate !== 'none';

    if (hasIntro) {
      // Shift all scene numbers up by 1
      scenes = scenes.map((scene: any, index: number) => ({
        ...scene,
        sceneNumber: index + 2 // Start from 2
      }));

      // Add intro scene at the beginning with consistent visual style
      const introScene = {
        sceneNumber: 1,
        narration: introConfig.introText || getDefaultIntroText(introConfig.introTemplate, topic),
        visualDescription: getIntroVisualDescription(introConfig.introTemplate, topic, baseVisualStyle),
        duration: 3,
        isIntro: true,
        templateId: introConfig.introTemplate
      };
      scenes.unshift(introScene);
    }

    if (hasOutro) {
      // Add outro scene at the end with consistent visual style
      const outroScene = {
        sceneNumber: scenes.length + 1,
        narration: outroConfig.outroText || getDefaultOutroText(outroConfig.outroTemplate),
        visualDescription: getOutroVisualDescription(outroConfig.outroTemplate, baseVisualStyle),
        duration: 3,
        isOutro: true,
        templateId: outroConfig.outroTemplate
      };
      scenes.push(outroScene);
    }

    console.log('Generated scenes:', scenes.length, 'with intro:', hasIntro, 'outro:', hasOutro);

    return new Response(
      JSON.stringify({ scenes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating reel script:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate script' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Extract visual style keywords from a description for consistency
function extractVisualStyle(description: string): string {
  // Extract common style patterns
  const styleMatch = description.match(/Style:\s*([^.]+)/i);
  const colorsMatch = description.match(/Colors?:\s*([^.]+)/i);
  const moodMatch = description.match(/Mood:\s*([^.]+)/i);
  const lightingMatch = description.match(/Lighting:\s*([^.]+)/i);
  
  const parts = [];
  if (styleMatch) parts.push(styleMatch[1].trim());
  if (colorsMatch) parts.push(`Colors: ${colorsMatch[1].trim()}`);
  if (moodMatch) parts.push(`Mood: ${moodMatch[1].trim()}`);
  if (lightingMatch) parts.push(`Lighting: ${lightingMatch[1].trim()}`);
  
  return parts.length > 0 ? parts.join('. ') : 'Cinematic 4K, vibrant colors, professional lighting, modern social media aesthetic';
}

// Helper functions for intro/outro defaults - now with stronger hooks
function getDefaultIntroText(templateId: string, topic: string): string {
  switch (templateId) {
    case 'hook-text':
      return 'Stop scrolling! This changes everything...';
    case 'topic-title':
      return `Nobody talks about this: ${topic.split(' ').slice(0, 4).join(' ')}...`;
    case 'question-hook':
      return 'What if everything you knew was wrong?';
    case 'countdown':
      return 'Most people miss these 3 secrets...';
    default:
      return 'You need to see this...';
  }
}

function getDefaultOutroText(templateId: string): string {
  switch (templateId) {
    case 'cta-follow':
      return 'Follow for more secrets like this!';
    case 'cta-subscribe':
      return 'Part 2 drops tomorrow - Subscribe now!';
    case 'cta-comment':
      return 'Which one surprised you most? Tell me below!';
    case 'cta-share':
      return 'Send this to someone who needs it!';
    default:
      return 'Save this for later!';
  }
}

function getIntroVisualDescription(templateId: string, topic: string, baseStyle: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional studio lighting';
  
  switch (templateId) {
    case 'hook-text':
      return `Style: ${commonStyle}. Subject: Bold attention-grabbing text graphic with kinetic typography, dramatic reveal animation. Camera: Front facing, eye level. Lighting: High contrast dramatic lighting with rim light. Background: Dark gradient with subtle animated particles, depth blur. Colors: Electric purple, hot pink, cyan accents on dark background. Mood: Urgent, exciting, must-watch energy. Keywords: social media intro, vertical 9:16, motion graphics, trending TikTok style, no faces, abstract dynamic background.`;
    case 'topic-title':
      return `Style: ${commonStyle}. Subject: Elegant title card with topic "${topic}" in premium typography, subtle animation. Camera: Centered frame, slight zoom in motion. Lighting: Soft diffused professional lighting. Background: Clean gradient backdrop with subtle texture, bokeh elements. Colors: Sophisticated palette matching brand, gold accents. Mood: Premium, trustworthy, professional. Keywords: title slide, social media, vertical 9:16, clean design, no faces, modern minimalist.`;
    case 'question-hook':
      return `Style: ${commonStyle}. Subject: Intriguing visual with floating question marks, puzzle elements, mystery atmosphere. Camera: Slightly low angle, dynamic. Lighting: Moody atmospheric with highlights. Background: Abstract curious environment, thought-provoking imagery. Colors: Deep blues, purples, with golden highlights. Mood: Mysterious, thought-provoking, curiosity-inducing. Keywords: question hook, vertical 9:16, intrigue, abstract, no faces, conceptual art.`;
    case 'countdown':
      return `Style: ${commonStyle}. Subject: Energetic countdown "3" with bold numbers, dynamic motion trails, excitement building. Camera: Dynamic angle with movement. Lighting: High energy, multiple colored lights. Background: Dark with neon accents, particle effects, energy burst. Colors: Neon green, electric blue, hot white highlights. Mood: Energetic, anticipation, excitement. Keywords: countdown, hype intro, vertical 9:16, dynamic, no faces, motion energy.`;
    default:
      return `Style: ${commonStyle}. Subject: Engaging intro graphic, bold typography, dynamic elements. Camera: Eye level, professional framing. Lighting: Studio quality. Background: Modern gradient with depth. Colors: Vibrant, attention-grabbing. Mood: Professional, engaging. Keywords: social media intro, vertical 9:16, no faces.`;
  }
}

function getOutroVisualDescription(templateId: string, baseStyle: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional lighting';
  
  switch (templateId) {
    case 'cta-follow':
      return `Style: ${commonStyle}. Subject: Compelling follow call-to-action, animated follow button, social media icons with glow effects. Camera: Centered, direct engagement. Lighting: Bright, inviting warmth. Background: Gradient with subtle social media motifs, floating hearts and plus signs. Colors: Platform reds, pinks, warm encouraging tones. Mood: Friendly, welcoming, community-building. Keywords: follow CTA, social media outro, vertical 9:16, engagement, no faces, call to action design.`;
    case 'cta-subscribe':
      return `Style: ${commonStyle}. Subject: Subscribe button animation, notification bell with glow, "Part 2" teaser text. Camera: Engaging direct frame. Lighting: Exciting, dynamic lighting. Background: Teaser preview atmosphere, countdown elements. Colors: Red subscribe button, yellow bell, anticipation colors. Mood: Exciting, cliffhanger, must-see-more. Keywords: subscribe CTA, YouTube style, vertical 9:16, teaser, no faces.`;
    case 'cta-comment':
      return `Style: ${commonStyle}. Subject: Comment bubble graphics, question typography, interactive chat elements floating. Camera: Inviting, conversational angle. Lighting: Warm, friendly glow. Background: Community discussion vibes, multiple chat bubbles. Colors: Friendly blues, conversation greens, welcoming palette. Mood: Conversational, inclusive, community-focused. Keywords: comment CTA, engagement, vertical 9:16, discussion, no faces, interactive.`;
    case 'cta-share':
      return `Style: ${commonStyle}. Subject: Share arrow icons multiplying, viral spread visualization, network expansion graphics. Camera: Dynamic outward motion. Lighting: Energetic, spreading light rays. Background: Network connections, spreading ripples effect. Colors: Viral purples, sharing blues, connection highlights. Mood: Shareable, viral energy, spreading positivity. Keywords: share CTA, viral, vertical 9:16, network effect, no faces.`;
    default:
      return `Style: ${commonStyle}. Subject: Engaging call-to-action graphic, save/bookmark icon. Camera: Direct, clear framing. Lighting: Professional, clear. Background: Clean with subtle branding. Colors: Action-oriented, clear contrast. Mood: Clear CTA, professional. Keywords: outro, CTA, vertical 9:16, no faces.`;
  }
}