import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Try to scrape with Firecrawl if available
    let websiteContent = "";
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (FIRECRAWL_API_KEY) {
      try {
        const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
        });
        const scrapeData = await scrapeRes.json();
        websiteContent = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      } catch (e) {
        console.error("Firecrawl scrape failed, falling back to AI analysis:", e);
      }
    }

    const prompt = websiteContent
      ? `Analyze this website content and extract brand insights for creating lifestyle story videos:\n\n${websiteContent.slice(0, 8000)}`
      : `Analyze the brand at this URL: ${url}. Based on the URL and domain name, infer what you can about the brand.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a brand strategist and video marketing expert. Analyze the given website/brand and return a JSON object with these fields:
{
  "brand_name": "string",
  "brand_tone": "string (e.g. professional, playful, luxurious, casual, bold)",
  "product_type": "string",
  "target_audience": "string",
  "visual_style": "string (e.g. minimalist, vibrant, earthy, modern, cinematic)",
  "key_benefits": ["string array of 3-5 key product/brand benefits"],
  "content_angles": ["string array of 3-5 content angles"],
  "recommended_video_types": [
    {
      "type": "string",
      "title": "string",
      "description": "string explaining why this video type works for this brand",
      "hook_idea": "string"
    }
  ]
}
Include 5-7 recommended video types from: lifestyle benefit story, before-and-after transformation, daily routine, problem-solution, testimonial-style story, emotional brand story, product education story.
Return ONLY valid JSON, no markdown.`
          },
          { role: "user", content: prompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_brand_analysis",
            description: "Return structured brand analysis",
            parameters: {
              type: "object",
              properties: {
                brand_name: { type: "string" },
                brand_tone: { type: "string" },
                product_type: { type: "string" },
                target_audience: { type: "string" },
                visual_style: { type: "string" },
                key_benefits: { type: "array", items: { type: "string" } },
                content_angles: { type: "array", items: { type: "string" } },
                recommended_video_types: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      title: { type: "string" },
                      description: { type: "string" },
                      hook_idea: { type: "string" }
                    },
                    required: ["type", "title", "description", "hook_idea"]
                  }
                }
              },
              required: ["brand_name", "brand_tone", "product_type", "target_audience", "visual_style", "key_benefits", "content_angles", "recommended_video_types"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_brand_analysis" } }
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      throw new Error(`AI analysis failed: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis;
    
    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      analysis = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-brand-website error:", error);
    return new Response(JSON.stringify({ error: error.message || "Analysis failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
