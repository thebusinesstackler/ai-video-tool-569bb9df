import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    console.log(`Generating ${movieLength} outline with ${lengthConfig.sceneRange} scenes`);

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a cohesive ${movieLength.replace('-', ' ')} outline (${lengthConfig.sceneRange} scenes, ${lengthConfig.duration}) for this idea:\n\n${movieIdea}\n\nRemember: The story must have a clear opening and closing, with the same character appearing consistently throughout. Use proper 3-act structure. Every scene MUST connect to the next — each scene ending should set up the next scene's beginning. The entire story should feel like ONE cohesive narrative, not disconnected vignettes.${storyBible ? '\n\nFollow the Story Bible provided in the system prompt for character arcs, three-act structure, and scene flow.' : ''}` }
        ],
        thinkingBudget: 16000,
      });

      const outline = result.text;
      if (!outline) throw new Error('No outline generated');

      console.log('Movie outline generated successfully');
      return new Response(
        JSON.stringify({ outline }),
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
    console.error('Error in generate-movie-outline:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate outline' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
