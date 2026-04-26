import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScriptParams {
  topic: string;
  duration: number;
  secondsPerScene: number;
  style: string;
  audience: string;
  tone: string;
  callToAction: string;
  characterId?: string;
}

interface Character {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  reference_images: string[] | null;
}

function createScriptPrompt(params: ScriptParams, character?: Character): string {
  const numScenes = Math.ceil(params.duration / params.secondsPerScene);
  
  let characterContext = "";
  if (character) {
    characterContext = `

FEATURED CHARACTER:
- Name: ${character.name}
- Physical Description: ${character.description || "Not specified - create appropriate visual details based on the character's name and personality"}
- Personality: ${character.personality || "Professional and engaging"}
${character.reference_images?.[0] ? `- Reference Image Available: Yes (ensure visual consistency across scenes)` : ""}

CRITICAL CHARACTER REQUIREMENTS:
1. Feature "${character.name}" as the main presenter/actor in EVERY scene
2. Use their personality to guide dialogue style, expressions, and mannerisms
3. In the CLEAN SCRIPT, provide HIGHLY DETAILED visual descriptions of ${character.name}:
   - Physical appearance (age range, hair color/style, facial features, build)
   - Clothing style and colors appropriate to the video context
   - Facial expressions and body language that match their personality
   - Specific actions they perform in each ${params.secondsPerScene}-second scene
   - Environment and how they interact with it
4. Make descriptions detailed enough for AI video generation to create consistent visuals of ${character.name}
5. Each scene must showcase ${character.name} performing meaningful actions within ${params.secondsPerScene} seconds
6. Describe mouth movements and expressions when they would be speaking (but don't include the actual dialogue)
`;
  }

  return `Create TWO versions of a video script with the following requirements:${characterContext}

Topic: ${params.topic}
Total Duration: ${params.duration} seconds
Seconds Per Scene: ${params.secondsPerScene} seconds (approximately ${numScenes} scenes total)
Style: ${params.style}
Target Audience: ${params.audience}
Tone: ${params.tone}
Call to Action: ${params.callToAction}

CRITICAL SCENE TIMING CONSTRAINT:
- Each scene MUST be exactly ${params.secondsPerScene} seconds long
- You need to create approximately ${numScenes} scenes to fill ${params.duration} seconds total
- Each scene description should be appropriate for a ${params.secondsPerScene}-second video clip

IMPORTANT: Return your response in this EXACT JSON format:
{
  "detailedScript": "the full script with timestamps (e.g., 0:00-0:${params.secondsPerScene.toString().padStart(2, '0')}), scene numbers, visual directions, text on screen instructions, etc.",
  "cleanScript": "the same script but ONLY scene descriptions for video generation - no timestamps, no scene numbers, no 'Visual:', no text on screen instructions, just pure scene descriptions with character details (age, appearance, actions). Each scene should be on a new line.",
  "scenes": [
    {
      "narration": "The spoken voiceover text the viewer will HEAR for this scene. This is the actual dialogue or narration read aloud.",
      "visualDescription": "What the camera SEES. Detailed visual description for AI video generation - character appearance, actions, environment, expressions. No dialogue."
    }
  ]
}

SCENES ARRAY RULES:
- The "scenes" array must have exactly ${numScenes} entries (one per scene)
- "narration" = the spoken words the narrator/presenter says during this scene. Write natural, engaging voiceover text. This is what gets sent to text-to-speech.
- "visualDescription" = what the camera sees during this scene. Detailed physical descriptions for AI video generation. NO spoken words, NO text overlays, NO dialogue.
- These two fields must be DIFFERENT. The narration is what you HEAR, the visual description is what you SEE.

Requirements for BOTH versions:
1. Hooks the viewer in the first ${params.secondsPerScene} seconds
2. Each scene is exactly ${params.secondsPerScene} seconds
3. Maintains engagement throughout
4. Delivers clear, valuable content
5. Includes natural transitions between scenes
6. Ends with the specified call to action

DETAILED SCRIPT FORMAT (for reference/editing):
- Include timestamps like "00:00-00:${params.secondsPerScene.toString().padStart(2, '0')}" for each scene
- Include scene numbers (Scene 1, Scene 2, etc.)
- Include "Visual:" and "Audio/Narration:" labels
- Include text on screen instructions
- Include all production notes
- Each scene = ${params.secondsPerScene} seconds

CLEAN SCRIPT FORMAT (for video generation):
${character ? `- Feature ${character.name} in EVERY scene with EXTENSIVE visual details` : '- Include character details (e.g., "A 35-year-old professional woman in business attire walks confidently into a modern office")'}
- HIGHLY DETAILED scene descriptions optimized for ${params.secondsPerScene}-second AI video generation
- NO timestamps
- NO scene numbers
- NO labels like "Visual:", "Audio:", "Narrator:", etc.
- NO text on screen instructions
- NO logos, graphics, or overlay instructions (like "logo appears", "text displays", "phone number shown")
- NO dialogue instructions (like "person says" or "narrator speaks")
- ONLY physical actions, detailed character descriptions, settings, and visual elements
${character ? `- For ${character.name}: describe appearance (age, hair, clothing, facial features), expressions, body language, specific actions` : ''}
- Just pure visual descriptions suitable for AI video generation
- Each scene on a NEW LINE
- Each scene = ${params.secondsPerScene} seconds of meaningful action/description
- If someone needs to speak, describe their mouth movements and expressions, NOT what they say
- DO NOT include any text that would appear on screen or be spoken
${character ? `- Ensure ${character.name}'s visual description remains consistent across ALL scenes` : ''}

CRITICAL FOR CLEAN SCRIPT:
The clean version is ONLY for generating the video visuals. Any text, logos, phone numbers, or spoken words will be added during video editing, NOT during video generation. Describe ONLY what the camera sees - people, actions, environments, expressions. Never include dialogue or text overlays in scene descriptions.

Make it suitable for ${params.style} style video content with ${params.secondsPerScene}-second scene constraints.`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const params: ScriptParams = {
      topic: body.topic,
      duration: body.duration,
      secondsPerScene: body.secondsPerScene,
      style: body.style,
      audience: body.audience,
      tone: body.tone,
      callToAction: body.callToAction,
      characterId: body.characterId,
    };
    const character: Character | undefined = body.character;
    const prompt = createScriptPrompt(params, character);

    try {
      const result = await callClaude({
        messages: [
          { 
            role: 'system', 
            content: `You are a professional video script writer specializing in AI video generation. CRITICAL: You MUST return a valid JSON object with exactly two keys: "detailedScript" and "cleanScript". The detailedScript should have timestamps, scene numbers, visual/audio labels, and all production notes. The cleanScript should ONLY have HIGHLY DETAILED scene descriptions with extensive character details (age, appearance, clothing, expressions, actions) optimized for ${params.secondsPerScene}-second AI video generation - absolutely NO timestamps, NO scene numbers, NO labels, NO text on screen instructions, NO dialogue. Just pure visual descriptions suitable for AI video generation${character ? ` featuring ${character.name} with consistent visual details across all scenes` : ''}.` 
          },
          { role: 'user', content: prompt }
        ],
        thinkingBudget: 16000,
      });

      const generatedScript = result.text;

      if (!generatedScript || !generatedScript.trim()) {
        console.error('No usable script content in AI response');
        return new Response(
          JSON.stringify({ error: 'No script content generated' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try to parse JSON response for two versions
      let detailedScript = generatedScript.trim();
      let cleanScript = generatedScript.trim();
      
      try {
        let jsonContent = generatedScript.trim();
        const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1];
        }
        
        const parsed = JSON.parse(jsonContent);
        if (parsed.detailedScript && parsed.cleanScript) {
          detailedScript = parsed.detailedScript;
          cleanScript = parsed.cleanScript;
        }
      } catch (e) {
        console.log('Could not parse JSON response, using raw content:', e);
      }

      // Extract structured scenes array if present
      let scenes: { narration: string; visualDescription: string }[] = [];
      try {
        let jsonContent2 = generatedScript.trim();
        const jsonMatch2 = jsonContent2.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch2) jsonContent2 = jsonMatch2[1];
        const parsed2 = JSON.parse(jsonContent2);
        if (Array.isArray(parsed2.scenes)) {
          scenes = parsed2.scenes;
        }
      } catch (_) {
        // scenes will remain empty
      }

      return new Response(
        JSON.stringify({ 
          script: detailedScript,
          detailedScript: detailedScript,
          cleanScript: cleanScript,
          scenes: scenes
        }), 
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
    console.error('Error in generate-script function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});