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
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing reference image:', imageUrl.substring(0, 100) + '...');

    try {
      const result = await callClaude({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and describe the person in it for use in AI image generation prompts.

Provide a BRIEF description (max 15 words) that includes:
- Gender (male/female)
- Approximate age range (20s, 30s, 40s, etc.)
- Key distinguishing features (hair color/style, facial hair if any)
- General appearance/attire style if visible

Format: "[Gender], [age range], [key features], [attire/style]"

Examples:
- "Male, 30s, short dark hair, professional attire"
- "Female, 20s, blonde wavy hair, casual style"
- "Male, 40s, bald with beard, business suit"

ONLY output the description, nothing else.`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        thinkingBudget: 4000,
        maxTokens: 4200,
      });

      const description = result.text?.trim();
      if (!description) {
        throw new Error('No description generated');
      }

      console.log('Generated character description:', description);

      return new Response(
        JSON.stringify({ description }),
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
    console.error('Error analyzing reference image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
