import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          { role: 'user', content: `Extract all unique locations from this movie outline:\n\n${outline}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated');
    }

    // Parse JSON from response
    let locations;
    try {
      // Try to extract JSON from the response
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

    // Add IDs to locations
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

  } catch (error: any) {
    console.error('Error in extract-locations:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract locations' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
