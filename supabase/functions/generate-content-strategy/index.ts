import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ContentStrategy {
  title: string;
  hookText: string;
  hookStyle: 'bold_claim' | 'question' | 'controversy' | 'story' | 'secret' | 'countdown' | 'fomo' | 'curiosity';
  targetDuration: 30 | 60;
  sceneCount: number;
  sceneDurations: number[];
  contentType: 'educational' | 'entertainment' | 'promotional' | 'motivational' | 'storytelling';
  callToAction: string | null;
  outroTemplate: string;
  seriesNumber: number;
  seriesPillar: string;
}

interface StrategyResponse {
  contentPillars: { name: string; description: string; color: string }[];
  videoIdeas: ContentStrategy[];
  weeklySchedule: { day: string; pillar: string; contentType: string }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { niche, videoDuration, includePromotional } = await req.json();

    if (!niche || typeof niche !== 'string' || niche.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Niche/topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const durationPreference = videoDuration === 'mix' 
      ? 'Mix of 30-second and 60-second videos' 
      : videoDuration === '30' 
        ? 'All 30-second videos (quick, punchy content)' 
        : 'All 60-second videos (deeper content)';

    const systemPrompt = `You are an expert viral content strategist for short-form video (TikTok, Reels, Shorts).

Your job is to create a comprehensive content strategy for a niche, including:
1. Content pillars (3-4 recurring themes)
2. 8-10 specific video ideas organized as a series
3. A weekly content schedule

For each video idea, provide:
- A compelling title
- A hook text (first 2-3 seconds to grab attention)
- Hook style (bold_claim, question, controversy, story, secret, countdown, fomo, curiosity)
- Target duration: 30 or 60 seconds
- Scene breakdown with exact durations that add up to total
- Content type (educational, entertainment, promotional, motivational, storytelling)
- Call to action (for promotional content) or null
- Outro template suggestion
- Series number and pillar

SCENE DURATION RULES:
- 30-second videos: 3-4 scenes
  * Hook scene: 3-5 seconds
  * Body scenes: 8-12 seconds each
  * CTA/Outro: 5-8 seconds
- 60-second videos: 5-6 scenes
  * Hook scene: 5-7 seconds
  * Body scenes: 10-15 seconds each
  * CTA/Outro: 8-10 seconds

HOOK STYLES:
- bold_claim: "I made $10K in a week doing this..."
- question: "Why is everyone suddenly doing this?"
- controversy: "This popular advice is actually WRONG..."
- story: "I tried this for 30 days and..."
- secret: "Nobody talks about this but..."
- countdown: "5 things you NEED to know about..."
- fomo: "If you're not doing this in 2024, you're behind..."
- curiosity: "What happens when you..."

OUTRO TEMPLATES:
- cta-follow: Follow for more tips
- cta-comment: Drop a comment with your thoughts
- cta-save: Save this for later
- cta-share: Share with someone who needs this
- cta-website: Link in bio (promotional)
- cta-part2: Part 2 coming tomorrow
- logo-reveal: Brand logo reveal

${includePromotional ? 'Include 2-3 promotional videos with clear CTAs and website mentions.' : 'Focus on value-based content. Avoid hard sells.'}

Video duration preference: ${durationPreference}

Respond ONLY with valid JSON matching this structure:
{
  "contentPillars": [
    { "name": "string", "description": "string", "color": "hex color" }
  ],
  "videoIdeas": [
    {
      "title": "string",
      "hookText": "string",
      "hookStyle": "bold_claim|question|controversy|story|secret|countdown|fomo|curiosity",
      "targetDuration": 30 or 60,
      "sceneCount": number,
      "sceneDurations": [array of numbers that sum to targetDuration],
      "contentType": "educational|entertainment|promotional|motivational|storytelling",
      "callToAction": "string or null",
      "outroTemplate": "string",
      "seriesNumber": number,
      "seriesPillar": "string matching a pillar name"
    }
  ],
  "weeklySchedule": [
    { "day": "Monday|Tuesday|etc", "pillar": "string", "contentType": "string" }
  ]
}`;

    const userPrompt = `Create a viral content strategy for the niche: "${niche}"

Generate 8-10 video ideas that could work as a series, with proper scene breakdowns and hooks that will grab attention in the first 2 seconds.`;

    console.log('Generating content strategy for niche:', niche);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate content strategy' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No strategy generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON from the response
    let strategy: StrategyResponse;
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      strategy = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Content:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse strategy response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generated strategy with', strategy.videoIdeas?.length, 'video ideas');

    return new Response(
      JSON.stringify(strategy),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Content strategy generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
