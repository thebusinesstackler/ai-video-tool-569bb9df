import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Movie length configurations
const MOVIE_LENGTH_CONFIG: Record<string, { sceneRange: string; duration: string; actStructure: string }> = {
  'quick-reel': {
    sceneRange: '4-6',
    duration: '1-2 minutes',
    actStructure: `This is a SHORT-FORM video (like a reel or short). Structure:
- Opening hook (1 scene)
- Rising action (2-3 scenes)  
- Climax & Resolution (1-2 scenes)`
  },
  'short-story': {
    sceneRange: '10-15',
    duration: '3-5 minutes',
    actStructure: `This is a SHORT STORY format. Use 3-act structure:
- ACT 1 (Setup): 2-3 scenes - Establish world, character, and inciting incident
- ACT 2 (Confrontation): 5-8 scenes - Rising action, obstacles, character development
- ACT 3 (Resolution): 3-4 scenes - Climax, falling action, resolution`
  },
  'short-film': {
    sceneRange: '20-30',
    duration: '10-15 minutes',
    actStructure: `This is a SHORT FILM format. Use detailed 3-act structure:
- ACT 1 (Setup): 5-7 scenes
  * Opening image/world establishment
  * Character introduction and ordinary world
  * Inciting incident
  * Debate/reaction
- ACT 2 (Confrontation): 10-16 scenes
  * First plot point
  * Rising action and obstacles
  * Midpoint twist
  * Complications and setbacks
  * All is lost moment
- ACT 3 (Resolution): 5-7 scenes
  * Climax preparation
  * Final confrontation
  * Resolution and new equilibrium
  * Closing image (mirrors opening)`
  },
  'full-movie': {
    sceneRange: '40-60',
    duration: '30+ minutes',
    actStructure: `This is a FULL MOVIE format. Use comprehensive 3-act structure with sub-plots:
- ACT 1 (Setup): 10-15 scenes (25%)
  * Opening hook
  * World building
  * Character introductions (protagonist, deuteragonist, antagonist)
  * Inciting incident
  * First major decision
- ACT 2 (Confrontation): 20-30 scenes (50%)
  * Point of no return
  * Fun & games / exploring new world
  * B-story development (romance/friendship sub-plot)
  * Midpoint revelation
  * Bad guys close in
  * All is lost / dark night of the soul
- ACT 3 (Resolution): 10-15 scenes (25%)
  * Break into three / new plan
  * Finale preparation
  * Climactic sequence (multiple scenes)
  * Resolution of all plots
  * Final image / new status quo

Include sub-plots, character arcs for secondary characters, and thematic depth.`
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { movieIdea, characterDescription, movieLength = 'quick-reel' } = await req.json();

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

    const lengthConfig = MOVIE_LENGTH_CONFIG[movieLength] || MOVIE_LENGTH_CONFIG['quick-reel'];
    console.log(`Generating ${movieLength} outline with ${lengthConfig.sceneRange} scenes`);

    const characterContext = characterDescription 
      ? `\n\nIMPORTANT - MAIN CHARACTER(S): ${characterDescription}. Keep these characters consistent throughout ALL scenes - same appearance, clothing style, and characteristics.`
      : '';

    const systemPrompt = `You are an expert screenwriter and story structure consultant. Your job is to take a movie idea and create a cohesive, complete story outline.

${lengthConfig.actStructure}

TARGET: ${lengthConfig.sceneRange} scenes total, approximately ${lengthConfig.duration} runtime.

CRITICAL REQUIREMENTS:
1. Every story MUST have a clear OPENING scene that establishes the world and character
2. Every story MUST have a clear CLOSING scene that provides resolution and mirrors/callbacks to the opening
3. The SAME main character(s) must appear consistently with the same description throughout
4. Each scene must flow naturally into the next
5. The story should feel COMPLETE and satisfying${characterContext}

Format your outline as follows:

**LOGLINE:**
[One compelling sentence that captures the essence of the story]

**MAIN CHARACTER(S):**
[Detailed description of the protagonist(s) - appearance, clothing, age, key features. This EXACT description will be used in every scene for consistency]

**GENRE:** [Primary genre]
**TONE:** [Dramatic, comedic, dark, inspiring, etc.]
**TARGET LENGTH:** ${lengthConfig.sceneRange} scenes (${lengthConfig.duration})

---

**ACT 1: SETUP**

**SCENE 1: OPENING - [Scene Title]**
Location: [Specific location]
Time: [Day/Night/Golden Hour/etc.]
Duration: 8-15 seconds

Visual Description:
[Detailed visual description including the main character (use the exact character description), setting, mood, camera angle. This establishes the world and the character's ordinary life or starting point.]

Narration/Caption:
"[Short, punchy narration text that hooks the viewer - 15-25 words max]"

---

[Continue with all scenes, grouped by ACT]

---

**ACT 3: RESOLUTION**

**FINAL SCENE: CLOSING - [Scene Title]**
Location: [Location that ideally mirrors or contrasts with opening]
Time: [Time of day]
Duration: 8-15 seconds

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
- Keep narration SHORT (15-25 words per scene) - this is for video content
- Each scene should be 8-15 seconds when visualized
- The main character description must be IDENTICAL in every scene
- Opening and closing should have thematic connection
- Story should feel COMPLETE - no cliffhangers
- Generate EXACTLY ${lengthConfig.sceneRange} scenes to match the selected format`;

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
          { role: 'user', content: `Create a cohesive ${movieLength.replace('-', ' ')} outline (${lengthConfig.sceneRange} scenes, ${lengthConfig.duration}) for this idea:\n\n${movieIdea}\n\nRemember: The story must have a clear opening and closing, with the same character appearing consistently throughout. Use proper 3-act structure.` }
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
