import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    console.log('Generating content strategy for niche:', niche);

    const durationInstruction = videoDuration === '30'
      ? 'All videos should be 30 seconds (4 scenes of ~7s each).'
      : videoDuration === '60'
      ? 'All videos should be 60 seconds (6 scenes of ~10s each).'
      : 'Mix of 30-second (4 scenes) and 60-second (6 scenes) videos.';

    const promoInstruction = includePromotional
      ? 'Include 1-2 promotional/product-focused ideas in the mix.'
      : 'Focus on organic content. No hard-sell promotional ideas.';

    const systemPrompt = `You are an elite AI Content Strategist specializing in short-form video for TikTok, Instagram Reels, and YouTube Shorts.

You help creators brainstorm high-performing video ideas with strong hooks, clear storylines, and actionable scene breakdowns.

OUTPUT FORMAT: Return ONLY valid JSON matching this exact structure:
{
  "contentPillars": [
    { "name": "Pillar Name", "description": "What this pillar covers", "color": "#hex" }
  ],
  "videoIdeas": [
    {
      "title": "Short video idea title (5-12 words)",
      "hookText": "The exact scroll-stopping hook line the creator would say",
      "hookStyle": "bold_claim|question|controversy|story|secret|countdown|fomo|curiosity",
      "targetDuration": 30,
      "sceneCount": 4,
      "sceneDurations": [7, 8, 8, 7],
      "contentType": "educational|entertainment|promotional|motivational|storytelling",
      "callToAction": "Short natural CTA or null",
      "outroTemplate": "cta-follow",
      "seriesNumber": 1,
      "seriesPillar": "Pillar Name"
    }
  ],
  "weeklySchedule": [
    { "day": "Monday", "pillar": "Pillar Name", "contentType": "educational" }
  ]
}

RULES FOR VIDEO IDEAS:
1. Generate 5-7 ideas minimum, each with a DIFFERENT angle
2. Every hook must be scroll-stopping — use curiosity, tension, surprise, or bold claims
3. Vary hookStyle across ideas — do NOT repeat the same style
4. Each idea must tell a REAL STORY, not just list benefits
5. Ideas should feel like native UGC/social content, not ads
6. Scene breakdowns should describe real-life, relatable moments
7. CTAs should be natural and topic-specific, not generic "follow for more"

ANGLE VARIETY — use different approaches:
- Curiosity: "Why does nobody talk about X?"
- Problem/Solution: "I was struggling with X until..."
- Educational: "3 things most people get wrong about X"
- Contrarian: "Everyone says X but they're wrong"
- Lifestyle: Show a day/routine incorporating the topic
- Story-driven: Mini narrative with emotional arc
- Demonstration: Show before/after or process

HOOK QUALITY:
- Each hook must be 5-15 words
- Must create an immediate urge to keep watching
- Must be specific to the topic (not generic)
- Must match the selected hookStyle

BANNED:
- Generic summaries or paragraphs
- Testimonial-only formats ("I've been using...")
- Repetitive ideas with same angle
- Weak or flat hooks`;

    const userPrompt = `Generate a content strategy for this niche/topic: "${niche.trim()}"

${durationInstruction}
${promoInstruction}

Requirements:
- 5-7 video ideas with DIFFERENT angles and hook styles
- Each idea needs a specific, compelling hook line
- Ideas should be varied: mix curiosity, educational, story, contrarian, lifestyle angles
- Scene counts: 4 scenes for 30s videos, 6 scenes for 60s videos
- Include 3-4 content pillars that cover different aspects of the niche
- Include a 7-day weekly schedule rotating through the pillars

Make every idea feel like it could go viral on TikTok or Instagram Reels.
Return ONLY valid JSON, no markdown, no explanation.`;

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        thinkingBudget: 8000,
      });

      const content = result.text;
      if (!content) {
        return new Response(
          JSON.stringify({ error: 'No strategy generated' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let strategy;
      try {
        let jsonContent = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        } else {
          const objMatch = content.match(/\{[\s\S]*\}/);
          if (objMatch) {
            jsonContent = objMatch[0];
          }
        }
        jsonContent = jsonContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();
        strategy = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        console.error('Raw content:', content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: 'Failed to parse strategy response. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate structure
      if (!strategy.videoIdeas || !Array.isArray(strategy.videoIdeas) || strategy.videoIdeas.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Strategy generated but contained no video ideas. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure defaults
      if (!strategy.contentPillars) strategy.contentPillars = [];
      if (!strategy.weeklySchedule) strategy.weeklySchedule = [];

      // Normalize video ideas
      strategy.videoIdeas = strategy.videoIdeas.map((idea: any, idx: number) => ({
        title: idea.title || `Video Idea ${idx + 1}`,
        hookText: idea.hookText || idea.hook || '',
        hookStyle: idea.hookStyle || 'curiosity',
        targetDuration: idea.targetDuration === 60 ? 60 : 30,
        sceneCount: idea.sceneCount || (idea.targetDuration === 60 ? 6 : 4),
        sceneDurations: idea.sceneDurations || (idea.targetDuration === 60 ? [10,10,10,10,10,10] : [7,8,8,7]),
        contentType: idea.contentType || 'educational',
        callToAction: idea.callToAction || null,
        outroTemplate: idea.outroTemplate || 'cta-follow',
        seriesNumber: idea.seriesNumber || idx + 1,
        seriesPillar: idea.seriesPillar || strategy.contentPillars?.[0]?.name || 'General',
      }));

      console.log('Generated strategy with', strategy.videoIdeas.length, 'video ideas');

      return new Response(
        JSON.stringify(strategy),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (error instanceof ClaudeError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Content strategy generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
