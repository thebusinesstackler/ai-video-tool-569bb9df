import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brandAnalysis, duration, videoTypes, count = 3 } = await req.json();
    if (!brandAnalysis) {
      return new Response(JSON.stringify({ error: "Brand analysis is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const numScenes = duration <= 15 ? 3 : duration <= 30 ? 5 : 8;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a creative director for lifestyle video ads. Generate ${count} unique video concepts for a ${duration}-second lifestyle story video.

Brand context:
- Brand: ${brandAnalysis.brand_name}
- Tone: ${brandAnalysis.brand_tone}
- Product: ${brandAnalysis.product_type}
- Audience: ${brandAnalysis.target_audience}
- Style: ${brandAnalysis.visual_style}
- Benefits: ${(brandAnalysis.key_benefits || []).join(", ")}

${videoTypes?.length ? `Focus on these video types: ${videoTypes.join(", ")}` : ""}

Each concept must have exactly ${numScenes} scenes that flow as a connected story.`
          },
          {
            role: "user",
            content: `Generate ${count} lifestyle video concepts. Each should feel like a real social media ad — authentic, story-driven, with natural product placement.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_concepts",
            description: "Return video concepts",
            parameters: {
              type: "object",
              properties: {
                concepts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      type: { type: "string" },
                      description: { type: "string" },
                      hook: { type: "string" },
                      cta: { type: "string" },
                      voiceover_script: { type: "string" },
                      music_mood: { type: "string" },
                      scenes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            scene_number: { type: "number" },
                            duration_seconds: { type: "number" },
                            visual_prompt: { type: "string" },
                            narration: { type: "string" },
                            scene_type: { type: "string", enum: ["hook", "story", "product", "benefit", "cta"] }
                          },
                          required: ["scene_number", "duration_seconds", "visual_prompt", "narration", "scene_type"]
                        }
                      }
                    },
                    required: ["title", "type", "description", "hook", "cta", "voiceover_script", "music_mood", "scenes"]
                  }
                }
              },
              required: ["concepts"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_concepts" } }
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      throw new Error(`Concept generation failed: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result;

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      result = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-lifestyle-concepts error:", error);
    return new Response(JSON.stringify({ error: error.message || "Generation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
