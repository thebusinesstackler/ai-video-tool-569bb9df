import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a cinematic animation director specializing in turning static product and brand images into compelling animated video creatives. Analyze the provided image and:

1. Identify all objects, products, text, and layout elements visible
2. Suggest 5-8 specific animation directions (as selectable options)
3. Write a polished, ready-to-use animation prompt (80-120 words) that combines the best cinematic motion for this specific image — including camera movement, lighting shifts, product interaction, pacing, and atmosphere. This prompt should feel like a professional director's brief.

Return your analysis using the provided tool.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and create a cinematic animation direction:" },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_image",
              description: "Return structured analysis of the image with animation suggestions and a ready-to-use director's prompt",
              parameters: {
                type: "object",
                properties: {
                  objects: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of objects, products, text, and elements detected in the image",
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Short label like 'Slow zoom in' or 'Product float'" },
                        prompt: { type: "string", description: "Detailed animation prompt to pass to a video generation model" },
                      },
                      required: ["label", "prompt"],
                    },
                    description: "5-8 animation suggestions",
                  },
                  directorPrompt: {
                    type: "string",
                    description: "A polished 80-120 word cinematic animation prompt combining the best motion directions for this image. Should read like a professional director's brief covering camera movement, lighting, product focus, pacing, and atmosphere.",
                  },
                },
                required: ["objects", "suggestions", "directorPrompt"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_image" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment.", userMessage: "Our AI is busy right now. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted.", userMessage: "AI credits are currently unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-animate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", userMessage: "Something went wrong analyzing your image. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
