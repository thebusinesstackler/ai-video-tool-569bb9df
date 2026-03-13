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
    const { movieIdea, characterDescription, movieLength = 'quick-reel', storyBible } = await req.json();

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

    // Build story bible context for narrative cohesion
    let storyBibleContext = '';
    if (storyBible) {
      storyBibleContext = `\n\nSTORY BIBLE (use this to ensure narrative cohesion):`;
      if (storyBible.logline) storyBibleContext += `\nLogline: ${storyBible.logline}`;
      if (storyBible.theme) storyBibleContext += `\nTheme: ${storyBible.theme}`;
      if (storyBible.threeActStructure) {
        storyBibleContext += `\nAct 1 (Setup): ${storyBible.threeActStructure.setup}`;
        storyBibleContext += `\nAct 2 (Confrontation): ${storyBible.threeActStructure.confrontation}`;
        storyBibleContext += `\nAct 3 (Resolution): ${storyBible.threeActStructure.resolution}`;
      }
      if (storyBible.emotionalArc) storyBibleContext += `\nEmotional Arc: ${storyBible.emotionalArc.join(' → ')}`;
      if (storyBible.characters && Array.isArray(storyBible.characters)) {
        storyBibleContext += `\nCharacters:`;
        storyBible.characters.forEach((char: any) => {
          storyBibleContext += `\n- ${char.name} (${char.role}): ${char.personality}. Arc: ${char.arc}. Wardrobe: ${char.wardrobe}`;
        });
      }
      if (storyBible.sceneDialogueMap && Array.isArray(storyBible.sceneDialogueMap)) {
        storyBibleContext += `\nPlanned Scene Flow:`;
        storyBible.sceneDialogueMap.forEach((scene: any) => {
          storyBibleContext += `\n- Scene ${scene.sceneNumber} "${scene.title}": ${scene.charactersPresent?.join(', ')} - ${scene.conflict}`;
        });
      }
    }

    const systemPrompt = `You are an expert screenwriter, cinematographer, and story structure consultant. Your job is to take a movie idea and create a cohesive, complete story outline with detailed cinematography directions.

${lengthConfig.actStructure}

TARGET: ${lengthConfig.sceneRange} scenes total, approximately ${lengthConfig.duration} runtime.

CAMERA MOVEMENTS (use these in your outline):
- Static: Camera remains fixed in position
- Pan Left/Right: Camera rotates horizontally on axis
- Tilt Up/Down: Camera rotates vertically on axis
- Zoom In: Lens zooms closer to subject
- Zoom Out: Lens zooms away from subject
- Push In: Camera physically moves toward subject (dolly)
- Pull Out: Camera physically moves away from subject
- Crane Up: Camera rises vertically
- Crane Down: Camera lowers vertically
- Orbit: Camera circles around subject
- Tracking: Camera follows subject movement laterally
- Handheld: Slightly shaky, documentary feel
- Steadicam: Smooth gliding motion following action

TRANSITION/CUT TYPES (use these between scenes):
- Hard Cut: Standard instant transition (most common)
- Cross-Dissolve: Gradual blend between scenes (emotional moments, time passing)
- Fade to Black: Scene fades out (end of chapter/act)
- Fade from Black: Scene fades in (new chapter/act)
- Whip Pan: Fast pan creating motion blur transition (energetic)
- Match Cut: Visual elements align between scenes (artistic continuity)
- Jump Cut: Jarring time skip within same scene (modern, stylized)
- Smash Cut: Sudden dramatic shift (shock/contrast)
- J-Cut: Audio from next scene starts before visual
- L-Cut: Audio from current scene continues over next visual

CRITICAL REQUIREMENTS:
1. Every story MUST have a clear OPENING scene that establishes the world and character
2. Every story MUST have a clear CLOSING scene that provides resolution and mirrors/callbacks to the opening
3. The SAME main character(s) must appear consistently with the same description throughout
4. Each scene must flow naturally into the next
5. The story should feel COMPLETE and satisfying
6. EVERY SCENE must include specific camera angles, movements, and transition to next scene${characterContext}

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

Cinematography:
- Start Frame: [Camera angle] - [Subject positioning, e.g., "Wide shot, character center frame"]
- Camera Movement: [Movement during scene, e.g., "Slow push in toward subject"]
- End Frame: [Camera angle] - [Final subject positioning, e.g., "Medium close-up on face"]
- Transition: [Cut type to next scene, e.g., "Cross-dissolve"]

Visual Description:
[Detailed visual description including the main character (use the exact character description), setting, mood. Describe what happens during the camera movement. This establishes the world and the character's ordinary life or starting point.]

Narration/Caption:
"[Short, punchy narration text that hooks the viewer - 15-25 words max]"

---

[Continue with all scenes, grouped by ACT, each with full Cinematography section]

---

**ACT 3: RESOLUTION**

**FINAL SCENE: CLOSING - [Scene Title]**
Location: [Location that ideally mirrors or contrasts with opening]
Time: [Time of day]
Duration: 8-15 seconds

Cinematography:
- Start Frame: [Camera angle] - [Subject positioning]
- Camera Movement: [Movement during scene]
- End Frame: [Camera angle] - [Final subject positioning]
- Transition: [Fade to Black for final scene]

Visual Description:
[Include the main character with consistent description. Show resolution, transformation, or callback to opening. This should feel like a satisfying ending.]

Narration/Caption:
"[Powerful closing line that provides resolution - 15-25 words]"

---

**VISUAL CONSISTENCY NOTES:**
- Main character appears in every scene wearing: [specific clothing/style]
- Color palette: [2-3 main colors]
- Lighting style: [consistent lighting approach]

**CINEMATOGRAPHY NOTES:**
- Primary camera movement style: [e.g., "Mostly slow push-ins and static shots with occasional orbits for emotional moments"]
- Transition style: [e.g., "Cross-dissolves for emotional beats, hard cuts for action, fade to black between acts"]
- Zoom usage: [When zooms are used and why, e.g., "Zoom-ins for reveals and tension, zoom-outs for establishing scale"]
- Pacing: [How camera choices support story pacing]

IMPORTANT RULES:
- Keep narration SHORT (15-25 words per scene) - this is for video content
- Each scene should be 8-15 seconds when visualized
- The main character description must be IDENTICAL in every scene
- Opening and closing should have thematic connection
- Story should feel COMPLETE - no cliffhangers
- EVERY scene MUST have the full Cinematography section with Start Frame, Camera Movement, End Frame, and Transition
- Generate EXACTLY ${lengthConfig.sceneRange} scenes to match the selected format`;

    console.log('Generating movie outline with Lovable AI...');

    const requestBody = JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a cohesive ${movieLength.replace('-', ' ')} outline (${lengthConfig.sceneRange} scenes, ${lengthConfig.duration}) for this idea:\n\n${movieIdea}\n\nRemember: The story must have a clear opening and closing, with the same character appearing consistently throughout. Use proper 3-act structure.` }
      ],
    });

    // Retry logic for transient errors
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`AI Gateway attempt ${attempt}/${MAX_RETRIES}`);
        
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: requestBody,
        });

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
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`AI Gateway error (attempt ${attempt}):`, response.status, errorText.substring(0, 200));
          
          // Retry on 5xx errors (transient)
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          
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
        
      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`Fetch error (attempt ${attempt}):`, fetchError.message);
        
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed after retries');
  } catch (error: any) {
    console.error('Error in generate-movie-outline:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate outline' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
