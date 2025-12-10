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
    const { movieIdea, characterDescription } = await req.json();

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

    const characterContext = characterDescription 
      ? `\n\nIMPORTANT - MAIN CHARACTER: ${characterDescription}. Keep this character consistent throughout ALL scenes - same appearance, clothing style, and characteristics.`
      : '';

    const systemPrompt = `You are an expert screenwriter and story structure consultant specializing in SHORT-FORM video content (like reels and short films). Your job is to take a movie idea and create a cohesive, complete story outline optimized for 4-6 scene video generation.

CRITICAL REQUIREMENTS:
1. Every story MUST have a clear OPENING scene that establishes the world and character
2. Every story MUST have a clear CLOSING scene that provides resolution and mirrors/callbacks to the opening
3. The SAME main character must appear in EVERY scene with consistent description
4. Each scene must flow naturally into the next
5. The story should feel complete and satisfying, like a short film${characterContext}

Format your outline as follows:

**LOGLINE:**
[One compelling sentence that captures the essence of the story]

**MAIN CHARACTER:**
[Detailed description of the protagonist - appearance, clothing, age, key features. This EXACT description will be used in every scene for consistency]

**GENRE:** [Primary genre]
**TONE:** [Dramatic, comedic, dark, inspiring, etc.]

---

**SCENE 1: OPENING - [Scene Title]**
Location: [Specific location]
Time: [Day/Night/Golden Hour/etc.]
Duration: 8-10 seconds

Visual Description:
[Detailed visual description including the main character (use the exact character description), setting, mood, camera angle. This establishes the world and the character's ordinary life or starting point.]

Narration/Caption:
"[Short, punchy narration text that hooks the viewer - 15-25 words max]"

---

**SCENE 2: [Scene Title]**
Location: [Specific location]
Time: [Time of day]
Duration: 8-10 seconds

Visual Description:
[Include the main character with consistent description. Show the inciting incident or rising action.]

Narration/Caption:
"[Engaging narration - 15-25 words]"

---

[Continue with SCENE 3, SCENE 4, etc. - typically 4-6 scenes total]

---

**FINAL SCENE: CLOSING - [Scene Title]**
Location: [Location that ideally mirrors or contrasts with opening]
Time: [Time of day]
Duration: 8-10 seconds

Visual Description:
[Include the main character with consistent description. Show resolution, transformation, or callback to opening. This should feel like a satisfying ending.]

Narration/Caption:
"[Powerful closing line that provides resolution - 15-25 words]"

---

**VISUAL CONSISTENCY NOTES:**
- Main character appears in every scene wearing: [specific clothing/style]
- Color palette: [2-3 main colors]
- Lighting style: [consistent lighting approach]
- Camera style: [e.g., cinematic, handheld, steady]

IMPORTANT RULES:
- Keep narration SHORT (15-25 words per scene) - this is for short-form video
- Each scene should be 8-10 seconds when visualized
- The main character description must be IDENTICAL in every scene
- Opening and closing should have thematic connection
- Story should feel COMPLETE - no cliffhangers`;

    console.log('Generating movie outline with Lovable AI...');

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
          { role: 'user', content: `Create a cohesive short film outline (4-6 scenes) for this idea:\n\n${movieIdea}\n\nRemember: The story must have a clear opening and closing, with the same character appearing consistently throughout.` }
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
    const outline = data.choices?.[0]?.message?.content;

    if (!outline) {
      throw new Error('No outline generated');
    }

    console.log('Movie outline generated successfully');

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