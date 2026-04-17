import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt: rawPrompt, brandPrimaryColor, brandTextColor, brandFont } = await req.json();
    const brandLine = brandPrimaryColor
      ? ` BRAND COLORS (use these for the shape's fill/accent): primary fill ${brandPrimaryColor}, text color ${brandTextColor || '#ffffff'}${brandFont ? `, font style similar to ${brandFont}` : ''}.`
      : '';
    const sizePrefix = `Generate a single self-contained UI overlay element on a FULLY TRANSPARENT alpha-channel background (true PNG alpha = 0 around the design — NOT a checkerboard pattern, NOT dark, NOT white). The element MUST be a real designed SHAPE with its own filled color and rounded corners. For BUTTONS: render an actual pill / rounded-rectangle button shape filled with the brand color, with the text rendered INSIDE the button shape. For BADGES / LOWER-THIRDS / TITLE CHIPS: render the actual chip/bar shape filled with color, text inside it. DO NOT render bare floating text — the design must always have a visible filled shape behind/around the text. Pixels OUTSIDE the designed shape must be 100% transparent (alpha 0) — no surrounding rectangular padding box, no outer frame, no plate.${brandLine} Output: PNG with alpha channel. `;
    const prompt = sizePrefix + (rawPrompt || "");
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Motion graphic image generation failed:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Image generation failed: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "No image returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("generate-motion-graphic error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
