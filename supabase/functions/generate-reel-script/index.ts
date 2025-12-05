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

    const systemPrompt = `You are a professional short-form video scriptwriter specializing in engaging Reels and TikTok content. 
You create punchy, attention-grabbing scripts that are perfect for ${targetDuration}-second videos.
Your scripts should:
- Hook the viewer in the first 2 seconds
- Be conversational and authentic
- Include clear visual directions
- Be optimized for vertical video format
- Have natural speaking rhythm for voiceover
- CRITICAL: Keep each scene's narration to ${maxWordsPerScene} words or less (about ${sceneDuration} seconds when spoken)`;

    const userPrompt = `Create ${sceneCount} scene scripts for a ${contentDuration}-second Reel about: "${topic}"

IMPORTANT: Each scene's narration MUST be ${maxWordsPerScene} words or LESS. This is critical for video timing.
Each scene should be approximately ${sceneDuration} seconds when spoken aloud at a normal pace.

Return ONLY a valid JSON array with exactly ${sceneCount} scenes in this format:
[
  {
    "sceneNumber": 1,
    "narration": "The exact words to be spoken as voiceover (MAX ${maxWordsPerScene} words, keep it punchy!)",
    "visualDescription": "Brief description of what should appear on screen",
    "duration": ${sceneDuration}
  }
]

Make the first scene a strong hook. Make the last scene a clear conclusion.
Keep narrations SHORT and PUNCHY - maximum ${maxWordsPerScene} words each!`;

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

    // Extract JSON from the response
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Clean up the content
    jsonContent = jsonContent
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .trim();

    // Parse the scenes
    let scenes = JSON.parse(jsonContent);

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid scenes format');
    }

    // Renumber scenes to account for intro
    const hasIntro = introConfig?.introTemplate && introConfig.introTemplate !== 'none';
    const hasOutro = outroConfig?.outroTemplate && outroConfig.outroTemplate !== 'none';

    if (hasIntro) {
      // Shift all scene numbers up by 1
      scenes = scenes.map((scene: any, index: number) => ({
        ...scene,
        sceneNumber: index + 2 // Start from 2
      }));

      // Add intro scene at the beginning
      const introScene = {
        sceneNumber: 1,
        narration: introConfig.introText || getDefaultIntroText(introConfig.introTemplate, topic),
        visualDescription: getIntroVisualDescription(introConfig.introTemplate, topic),
        duration: 3,
        isIntro: true,
        templateId: introConfig.introTemplate
      };
      scenes.unshift(introScene);
    }

    if (hasOutro) {
      // Add outro scene at the end
      const outroScene = {
        sceneNumber: scenes.length + 1,
        narration: outroConfig.outroText || getDefaultOutroText(outroConfig.outroTemplate),
        visualDescription: getOutroVisualDescription(outroConfig.outroTemplate),
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

// Helper functions for intro/outro defaults
function getDefaultIntroText(templateId: string, topic: string): string {
  switch (templateId) {
    case 'hook-text':
      return 'Wait for it...';
    case 'topic-title':
      return topic;
    case 'question-hook':
      return 'Did you know...?';
    case 'countdown':
      return '3 Things You Need to Know';
    default:
      return '';
  }
}

function getDefaultOutroText(templateId: string): string {
  switch (templateId) {
    case 'cta-follow':
      return 'Follow for more!';
    case 'cta-subscribe':
      return 'Subscribe for Part 2!';
    case 'cta-comment':
      return 'What do you think? Comment below!';
    case 'cta-share':
      return 'Share this with a friend!';
    default:
      return '';
  }
}

function getIntroVisualDescription(templateId: string, topic: string): string {
  switch (templateId) {
    case 'hook-text':
      return 'Dynamic gradient background with bold kinetic typography, eye-catching colors, modern social media style';
    case 'topic-title':
      return `Sleek minimal title card displaying "${topic}" with elegant typography, subtle animated background`;
    case 'question-hook':
      return 'Thought-provoking visual with question mark motifs, intriguing atmosphere, curiosity-inducing design';
    case 'countdown':
      return 'Energetic countdown animation style, bold numbers, exciting buildup atmosphere, vibrant colors';
    default:
      return '';
  }
}

function getOutroVisualDescription(templateId: string): string {
  switch (templateId) {
    case 'cta-follow':
      return 'Engaging call-to-action design with follow button imagery, social media icons, arrow pointing, vibrant and friendly';
    case 'cta-subscribe':
      return 'Subscribe button animation style, notification bell icon, exciting teaser atmosphere';
    case 'cta-comment':
      return 'Interactive comment bubble design, question marks, community engagement vibes, friendly and inviting';
    case 'cta-share':
      return 'Share arrow icons, viral growth visualization, spreading network design, energetic and shareable';
    default:
      return '';
  }
}
