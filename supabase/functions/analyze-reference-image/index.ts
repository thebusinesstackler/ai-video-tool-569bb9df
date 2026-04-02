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
                text: `Analyze this image and extract a detailed CHARACTER PROFILE and PRODUCT PROFILE for AI video production.

Return a JSON object with these fields:

{
  "description": "Full character description for image generation (30-50 words)",
  "gender": "male" or "female",
  "ageRange": "20s" or "30s" etc,
  "appearance": "hair color/style, skin tone, facial features",
  "clothing": "what they're wearing",
  "environment": "visible background/setting or 'not visible'",
  "product": {
    "detected": true/false,
    "type": "bottle/dropper/jar/tube/can/box/packet/none",
    "shape": "description of shape",
    "color": "color of product/packaging",
    "label": "any visible text or branding",
    "howHeld": "how the person is interacting with it"
  }
}

RULES:
- Be PRECISE about gender — look at facial structure, body, clothing
- Description must be detailed enough to recreate the person consistently across multiple AI images
- If a product is visible (in hand, on table, nearby), describe it precisely
- If NO product is visible, set product.detected = false
- Focus on physical appearance, not interpretation or mood

Return ONLY the JSON object, no markdown, no explanation.`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        thinkingBudget: 4000,
        maxTokens: 5000,
      });

      const rawText = result.text?.trim();
      if (!rawText) {
        throw new Error('No description generated');
      }

      // Parse JSON response
      let profile;
      try {
        let jsonStr = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        else {
          const objMatch = rawText.match(/\{[\s\S]*\}/);
          if (objMatch) jsonStr = objMatch[0];
        }
        profile = JSON.parse(jsonStr);
      } catch {
        // Fallback: treat as plain text description
        console.log('Could not parse JSON, using raw text');
        profile = { description: rawText };
      }

      const description = profile.description || rawText;
      console.log('Generated character profile:', JSON.stringify(profile).substring(0, 300));

      return new Response(
        JSON.stringify({ 
          description,
          gender: profile.gender || null,
          ageRange: profile.ageRange || null,
          appearance: profile.appearance || null,
          clothing: profile.clothing || null,
          environment: profile.environment || null,
          product: profile.product || null,
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
    console.error('Error analyzing reference image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
