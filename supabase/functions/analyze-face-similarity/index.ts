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
    const { imageUrls } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 image URLs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Analyzing ${imageUrls.length} images for face similarity`);

    // Build image content for the AI
    const imageContent = imageUrls.map((url: string, idx: number) => ({
      type: "image_url" as const,
      image_url: { url }
    }));

    // Ask AI to analyze and group faces
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing faces in images. Your task is to:
1. Examine each image and identify the main person/face in it
2. Group images that appear to show the SAME person (considering different poses, angles, lighting)
3. Describe each person briefly (age range, gender, distinctive features)

Respond with a JSON object in this exact format:
{
  "groups": [
    {
      "description": "Brief description of the person in this group",
      "imageIndices": [0, 2, 5]
    }
  ]
}

Where imageIndices are the 0-based indices of images showing the same person.
If all images show the same person, return a single group with all indices.
Be generous in grouping - if faces look similar, group them together.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `I have ${imageUrls.length} images. Please analyze the faces and group images that show the same person. Here are the images:`
              },
              ...imageContent
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    // Parse the JSON response
    let parsedResponse;
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return a default single group with all images
      parsedResponse = {
        groups: [{
          description: 'All selected images',
          imageIndices: imageUrls.map((_: string, i: number) => i)
        }]
      };
    }

    // Convert indices to actual image URLs
    const groups = parsedResponse.groups.map((group: { description: string; imageIndices: number[] }) => ({
      description: group.description,
      images: group.imageIndices.map((idx: number) => imageUrls[idx]).filter(Boolean)
    }));

    console.log(`Found ${groups.length} group(s)`);

    return new Response(
      JSON.stringify({ groups }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-face-similarity:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze images';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
