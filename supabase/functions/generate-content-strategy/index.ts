import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

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

    console.log('Generating content strategy for niche:', niche);

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

      let strategy: StrategyResponse;
      try {
        const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        strategy = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
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
