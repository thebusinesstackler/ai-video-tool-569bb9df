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
    const body = await req.json();
    const { imageUrl } = body;

    // If imageUrl is provided, analyze the image
    if (imageUrl) {
      console.log('Analyzing image:', imageUrl);

      const systemPrompt = `You are an expert at describing images for video production. Focus on the main subject/action, setting, mood, and key visual elements. Keep under 2 sentences.`;

      try {
        const result = await callClaude({
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: 'Describe this image in a way useful for a B-roll scene in a commercial video:' },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          thinkingBudget: 4000,
        });

        const description = result.text;
        if (!description) throw new Error('No description generated from AI');

        return new Response(JSON.stringify({ description: description.trim() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        if (error instanceof ClaudeError) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
    }

    // Original scene description logic
    const { sceneTitle, location, timeOfDay, dialogue, transitionAction, characterDescription, cameraAngle, position, frameType, mood, lighting } = body;
    console.log('Describing scene:', { sceneTitle, frameType, location, timeOfDay });

    const contextParts = [];
    if (sceneTitle) contextParts.push(`Scene: "${sceneTitle}"`);
    if (location) contextParts.push(`Location: ${location}`);
    if (timeOfDay) contextParts.push(`Time: ${timeOfDay}`);
    if (mood) contextParts.push(`Mood: ${mood}`);
    if (lighting) contextParts.push(`Lighting style: ${lighting}`);
    if (characterDescription) contextParts.push(`Character: ${characterDescription}`);
    if (dialogue) contextParts.push(`Dialogue being spoken: "${dialogue}"`);
    if (transitionAction) contextParts.push(`Action happening: ${transitionAction}`);
    if (cameraAngle) contextParts.push(`Camera angle: ${cameraAngle}`);
    if (position) contextParts.push(`Character position: ${position}`);

    const frameContext = frameType === 'start' 
      ? 'This is the STARTING frame of the scene.'
      : 'This is the ENDING frame of the scene.';

    const systemPrompt = `You are a veteran cinematographer + production designer writing image prompts for an AI image model that will generate the literal first or last frame of a movie scene.

Write ONE dense paragraph (90-160 words) that includes, in this order:
1. Subject + action — who is in frame, what they're doing, their facial expression and body language.
2. Wardrobe + props — exact clothing colors/materials (must match character lock if provided), key props in hand or in frame.
3. Framing — shot size (wide / medium / close-up / over-shoulder / POV), camera height (eye-level / low / high / bird's-eye), lens feel (wide / 35mm / 85mm / macro).
4. Blocking + composition — where each character sits in the frame (left third / center / right third), depth (foreground / midground / background), eyelines.
5. Location + set dressing — specific architectural details, surfaces, textures, signage, era cues.
6. Lighting — direction, quality (hard / soft / diffused), color temperature, key + fill, practicals.
7. Color palette + mood — 2-3 dominant colors, atmosphere word (tense, warm, melancholic, etc.).
8. Continuity hook — for END frames, name the specific visual element (a screen, an object, a gesture) that the next scene will match-cut into.

Output ONLY the prompt paragraph. No preamble, no labels, no markdown.`;

    const userPrompt = `${frameContext}\n\nScene Context:\n${contextParts.join('\n')}\n\nGenerate a detailed, cinematic image prompt that captures this exact moment.`;

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        thinkingBudget: 8000,
      });

      const generatedPrompt = result.text;
      if (!generatedPrompt) throw new Error('No prompt generated from AI');

      return new Response(JSON.stringify({ imagePrompt: generatedPrompt.trim() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof ClaudeError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }

  } catch (error) {
    console.error('Error in describe-scene function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
