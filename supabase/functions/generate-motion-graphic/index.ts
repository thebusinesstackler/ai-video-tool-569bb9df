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
      ? ` BRAND COLORS: brand primary color is ${brandPrimaryColor} (use this as the dominant fill). Text color: ${brandTextColor || '#ffffff'}.${brandFont ? ` Typography: clean modern sans-serif similar to ${brandFont}.` : ''}`
      : '';

    // ULTRA-STRICT prompt — Nano Banana 2 (gemini-3.1-flash-image-preview) honours
    // transparency much better than the older flash-image model. We also demand a
    // tight centred crop so the output drops cleanly onto video.
    const sizePrefix = `Generate a single finished UI graphic element as a PNG with a real alpha channel.

NON-NEGOTIABLE RULES:
1. The CANVAS BACKGROUND must be 100% transparent (alpha = 0). Absolutely no white, black, grey, or checkerboard pattern around the shape. The only visible pixels must be the shape itself.
2. The SHAPE itself must be 100% OPAQUE solid colour fill — no see-through patches, no checkerboard inside the shape, no glassmorphism unless explicitly requested.
3. Render a real designed shape — for buttons use a solid pill / rounded-rectangle (corner radius 24-32px), for badges a chip, for lower-thirds a slim filled bar. Text rendered cleanly INSIDE and centred.
4. Tight crop: the shape fills 92-100% of the canvas with at most 4% transparent margin on any side. NO extra padding, NO drop shadow halo, NO outer frame.
5. Aspect ratio: ~3:1 for pill buttons, ~4:1 for lower-third bars, ~1:1 for circular badges.
6. Crisp typography: bold modern sans-serif, tight kerning, NO double-rendering, NO blurry edges.
7. Multi-line text: render second line at ~55% of the main label size, both inside the same shape.${brandLine}

OUTPUT: a single tightly-cropped PNG. Shape = solid opaque brand colour. Background = true transparent alpha-zero. Nothing else. `;
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
        // Nano Banana 2 — sharper output and better transparency handling
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
