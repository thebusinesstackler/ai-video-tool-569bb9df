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
    const { imageUrl, currentScript } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Product image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Step 1: Analyze the product image
    const analyzeMessages: any[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this product image carefully. Identify:
1. The exact product name/brand if visible
2. What category/type of product it is
3. Key visual features (color, shape, size, packaging)
4. The target audience for this product
5. 2-3 compelling selling points based on what you see

Return a JSON object with these fields:
{
  "productName": "exact name or best guess",
  "category": "product category",
  "description": "brief visual description",
  "targetAudience": "who would buy this",
  "sellingPoints": ["point1", "point2", "point3"],
  "suggestedPlacements": ["holding in hand", "on table with lifestyle setting", "close-up hero shot"]
}

Return ONLY the JSON, no other text.`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ];

    const analyzeResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: analyzeMessages,
      }),
    });

    if (!analyzeResp.ok) {
      if (analyzeResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (analyzeResp.status === 402) {
        return new Response(JSON.stringify({ error: 'Usage limit reached. Please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await analyzeResp.text();
      console.error('AI analysis error:', analyzeResp.status, errText);
      throw new Error('Failed to analyze product image');
    }

    const analyzeData = await analyzeResp.json();
    const analysisText = analyzeData.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    let productInfo: any;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      productInfo = jsonMatch ? JSON.parse(jsonMatch[0]) : { productName: 'Unknown Product', description: analysisText };
    } catch {
      productInfo = { productName: 'Product', description: analysisText };
    }

    // Step 2: If there's a current script, generate a rewritten version around the product
    let rewrittenScenes: any[] | null = null;
    if (currentScript && Array.isArray(currentScript) && currentScript.length > 0) {
      const scriptRewriteMessages = [
        {
          role: 'system',
          content: `You are a viral short-form video scriptwriter. You will rewrite scene narrations to naturally integrate a product. Keep the same number of scenes, same general structure, but weave the product into the narrative authentically. Each scene should feel organic, not forced. Maintain the hook strength of scene 1.`
        },
        {
          role: 'user',
          content: `Product info: ${JSON.stringify(productInfo)}

Current scenes:
${currentScript.map((s: any) => `Scene ${s.sceneNumber}: "${s.narration}" [Visual: ${s.visualDescription}]`).join('\n')}

Rewrite each scene to naturally feature "${productInfo.productName}". Return a JSON array:
[{"sceneNumber": 1, "narration": "...", "visualDescription": "..."}, ...]

For visualDescriptions, include the product naturally (e.g., "person holding ${productInfo.productName}", "close-up of ${productInfo.productName} on desk").
Return ONLY the JSON array.`
        }
      ];

      const rewriteResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: scriptRewriteMessages,
        }),
      });

      if (rewriteResp.ok) {
        const rewriteData = await rewriteResp.json();
        const rewriteText = rewriteData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = rewriteText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            rewrittenScenes = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn('Failed to parse rewritten scenes:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        productInfo,
        rewrittenScenes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-product:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to analyze product' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
