import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { movieIdea } = await req.json();

    if (!movieIdea) {
      return new Response(
        JSON.stringify({ error: 'Movie idea is required' }),
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

    const systemPrompt = `You are an expert screenwriter and story structure consultant. Your job is to take a movie idea and create a detailed, professional outline that breaks down the story into a three-act structure with key scenes.

Format your outline as follows:

**LOGLINE:**
[One compelling sentence that captures the essence of the movie]

**GENRE:** [Primary genre]
**TONE:** [Dramatic, comedic, dark, etc.]

**ACT ONE: SETUP (25% of runtime)**

Scene 1: Opening Image
- Description of the opening scene that establishes tone and world
- Key visual elements
- Approximate duration: 2-3 minutes

Scene 2: Introduce Protagonist
- Who they are, what they want, their ordinary world
- Character establishment
- Duration: 3-5 minutes

[Continue with 3-5 more key scenes in Act One]

Scene X: Inciting Incident
- The event that kicks off the main story
- Duration: 2-3 minutes

Scene Y: End of Act One / First Plot Point
- Point of no return, protagonist commits to the journey
- Duration: 2-3 minutes

**ACT TWO: CONFRONTATION (50% of runtime)**

[Break this into sequences]

**Sequence 1: Rising Action**
Scene 1: [Description with camera angles and duration]
Scene 2: [Description]
[etc.]

**Midpoint:**
Scene X: [Major revelation or turning point]

**Sequence 2: Complications**
[More scenes]

**Low Point / All Is Lost:**
Scene X: [Darkest moment]

**ACT THREE: RESOLUTION (25% of runtime)**

Scene 1: [Final plan/realization]
Scene 2: [Climax preparation]
Scene 3: [Climactic confrontation]
Scene 4: [Resolution]
Scene 5: [Final Image - mirrors opening]

**KEY THEMES:**
- [Theme 1]
- [Theme 2]

**VISUAL STYLE NOTES:**
- Recommended camera angles for key scenes
- Lighting suggestions
- Color palette recommendations

Make the outline detailed enough that each scene can be turned into a video generation prompt with start/end keyframes.`;

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
          { role: 'user', content: `Create a detailed movie outline for this idea:\n\n${movieIdea}` }
        ],
        temperature: 0.8,
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
    const outline = data.choices?.[0]?.message?.content;

    if (!outline) {
      throw new Error('No outline generated');
    }

    return new Response(
      JSON.stringify({ outline }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-movie-outline:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate outline' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
