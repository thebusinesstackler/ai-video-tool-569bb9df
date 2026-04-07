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
            content: `You are a cinematic animation director. You analyze static product/brand images and craft animation prompts for an AI video model (image-to-video). The video model takes the image as the FIRST FRAME and generates a short clip from it.

UNDERSTANDING THE VIDEO MODEL:
- It receives the exact image as frame 1 and generates ~4 seconds of video continuing from it
- It interprets prompts LITERALLY — if you say "bottle floats upward" it WILL move the bottle up and out of frame
- It cannot add new objects, only animate what exists
- Camera movements work well (zoom, pan) because they move the virtual camera, not the objects
- Lighting/atmosphere effects work well because they modify the scene globally
- ANY instruction about an object moving WILL cause it to move and potentially leave the frame

CRITICAL PRESERVATION RULES:
- Count every element precisely: if there are 5 stars, say "five stars"; if 3 bullet points, say "three bullet points"
- NEVER use movement verbs (float, slide, drift, fly, rise, fall, spin, rotate, shift, move, travel, glide, sweep, sway, bounce) for ANY object, product, text, icon, badge, or UI element
- Every product, label, star rating, bullet point, badge, logo, and text overlay must remain FROZEN in place
- The only things that may "move" are: the camera, light sources, atmospheric particles, and focus plane

ALLOWED EFFECTS (the ONLY animation types you may suggest):
- Camera: Slow Zoom In, Slow Zoom Out, Gentle Pan, Subtle Dolly Push, Slow Orbit
- Atmosphere: Bokeh Bloom, Soft Light Rays, Floating Dust Particles, Lens Flare, Gentle Haze
- Lighting: Warm Light Sweep, Spotlight Glow, Ambient Pulse, Rim Light Fade, Golden Hour Shift
- Depth: Rack Focus (shift focus plane), Background Blur, Shallow Depth-of-field Pull
- Texture: Subtle surface shimmer on glossy/metallic materials, gentle condensation on cold surfaces

ANALYSIS INSTRUCTIONS:
1. List EVERY visible element with exact counts (e.g., "5 gold stars", "3 bullet points", "product bottle centered")
2. Note the composition, colors, lighting conditions, and mood
3. Create 5-8 suggestions ONLY from the allowed effects above, each tailored to enhance THIS specific image
4. Each suggestion prompt must be self-contained and ready to use
5. Write a director's prompt (100-150 words) that combines the most cinematic effects for this image

PROMPT FORMAT RULES:
- Start every prompt with: "Starting from this exact image, the camera [movement]. "
- Describe only what the CAMERA does and what LIGHT/ATMOSPHERE does — never what objects do
- Reference specific detected elements to anchor the prompt (e.g., "the gold star rating remains crisp and fixed")
- End every prompt with: "Every element — products, text, stars, badges, icons — remains perfectly frozen in its original position throughout the entire shot."

Return your analysis using the provided tool.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and create animation directions that preserve the exact product appearance:" },
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
                    description: "Detailed list of every object, product, text, icon, star, badge, and element detected — include exact counts (e.g., '5 gold stars', '3 bullet points')",
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Short label from allowed categories only, e.g. 'Slow Zoom In', 'Bokeh Bloom', 'Rack Focus'. Never use object-movement labels." },
                        description: { type: "string", description: "One sentence describing what this camera/light/atmosphere effect does to enhance the image" },
                        prompt: { type: "string", description: "Self-contained animation prompt starting with 'Starting from this exact image, the camera...'. Only camera/light/atmosphere effects. Must end with 'Every element — products, text, stars, badges, icons — remains perfectly frozen in its original position throughout the entire shot.'" },
                      },
                      required: ["label", "description", "prompt"],
                    },
                    description: "5-8 animation suggestions from allowed categories only",
                  },
                  directorPrompt: {
                    type: "string",
                    description: "A polished 100-150 word cinematic animation prompt. Start with 'Starting from this exact image, the camera...'. Reference specific detected elements by name/count to anchor them. Only camera, lighting, and atmosphere effects. End with the preservation statement.",
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
