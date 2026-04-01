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
    const { outline } = await req.json();

    if (!outline) {
      return new Response(
        JSON.stringify({ error: 'Outline is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting locations from outline...');

    const systemPrompt = `You are a film production assistant. Your task is to extract all unique locations from a movie outline.

For each location, provide:
1. A clear, unique name
2. A detailed visual description (architecture, style, colors, materials)
3. Suggested lighting setup
4. Time of day (day, night, golden-hour, blue-hour, overcast)
5. Key props that should be visible
6. The mood/atmosphere

Return ONLY a valid JSON array with this structure:
[
  {
    "name": "Location Name",
    "description": "Detailed visual description...",
    "lightingSetup": "Lighting description...",
    "timeOfDay": "day|night|golden-hour|blue-hour|overcast",
    "props": ["prop1", "prop2", "prop3"],
    "mood": "mood description"
  }
]

IMPORTANT:
- Combine similar locations (e.g., "Maria's Kitchen - Morning" and "Maria's Kitchen - Night" should be ONE location with flexible time)
- Be specific and visual in descriptions
- Only return the JSON array, no other text`;

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract all unique locations from this movie outline:\n\n${outline}` }
        ],
        thinkingBudget: 4000,
      });

      const content = result.text;
      if (!content) {
        throw new Error('No content generated');
      }

      let locations;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          locations = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse locations JSON:', parseError);
        console.error('Raw content:', content);
        throw new Error('Failed to parse location data');
      }

      const locationsWithIds = locations.map((loc: any, idx: number) => ({
        id: `loc_${Date.now()}_${idx}`,
        ...loc,
        timeOfDay: loc.timeOfDay || 'day',
        props: loc.props || [],
        mood: loc.mood || 'neutral'
      }));

      console.log(`Extracted ${locationsWithIds.length} locations`);

      return new Response(
        JSON.stringify({ locations: locationsWithIds }),
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

  } catch (error: any) {
    console.error('Error in extract-locations:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract locations' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
