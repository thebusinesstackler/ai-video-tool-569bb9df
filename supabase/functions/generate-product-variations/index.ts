import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  lifestyle:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Only change the background and surroundings. Replace the current background with a warm lifestyle scene — a bright kitchen counter, a cozy living room shelf, or a sunny breakfast table. Add a different person nearby interacting naturally with the scene. The product must remain crisp, sharp, and identical to the input image.",
  white_bg:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Remove everything except the product. Place it on a pure white background with professional studio lighting. Soft shadows, clean composition, e-commerce ready. The product must remain crisp, sharp, and identical to the input image.",
  ugc:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Only change the background and surroundings. Change the scene to look like a casual iPhone photo — someone holding or displaying this product at a café table, in a car, or on a couch. Natural lighting, authentic UGC style. The product must remain crisp, sharp, and identical to the input image.",
  flat_lay:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Only change the background and surroundings. Create a top-down flat lay composition on a clean marble or wood surface. Add complementary lifestyle props around it (plants, books, fabric textures). No people. The product must remain crisp, sharp, and identical to the input image.",
  nature:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Only change the background and surroundings. Place the product in a lush natural outdoor setting — on a mossy rock, a garden table, or among wildflowers. Golden hour lighting. No people. The product must remain crisp, sharp, and identical to the input image.",
  studio:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Only change the background and surroundings. Add dramatic studio lighting with a dark moody background. Rim lighting, subtle color glow, luxury premium feel. No people. The product must remain crisp, sharp, and identical to the input image.",
  transparent_bg:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Cleanly remove the entire background so only the product remains, isolated on a pure solid white background (which can be cut out later). Preserve natural product shadows directly under/beneath the product for realism. Edges must be razor-sharp with no halo, no fringe, no leftover background pixels. The product must remain crisp, sharp, and identical to the input image. High-resolution e-commerce cutout quality.",
  hero_premium:
    "Edit this photo: keep the EXACT product/bottle pixel-perfect and completely unchanged — do NOT redraw, blur, or alter the bottle, label, text, colors, or shape in any way. Remove all background distractions and place the product as a luxury hero shot — soft gradient background (warm cream to amber), cinematic three-point lighting, gentle rim light along the bottle edge, soft realistic ground shadow, ultra-high-resolution detail on the label and glass. Premium magazine-cover quality, no people, no props. The product must remain crisp, sharp, and identical to the input image.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageUrl, productName, productDescription, variationStyle, productId, targetTable } = await req.json();

    if (!imageUrl || !variationStyle || !productId) {
      return new Response(
        JSON.stringify({ error: "imageUrl, variationStyle, and productId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const styles = Array.isArray(variationStyle) ? variationStyle : [variationStyle];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { style: string; imageUrl: string }[] = [];

    for (const style of styles) {
      const basePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.lifestyle;
      const contextPrompt = `The image below contains a product called "${productName || "product"}"${productDescription ? ` (${productDescription})` : ""}. CRITICAL INSTRUCTION: The product/bottle in this image must remain EXACTLY as-is — preserve every pixel of the label, text, colors, shape, and branding. Do NOT regenerate, redraw, or approximate the product. Only modify the environment around it. Output a high-resolution, sharp, photorealistic image. ${basePrompt}`;

      console.log(`Generating ${style} variation for product ${productId}`);

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: contextPrompt },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        }
      );

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited — please try again shortly" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted — please add funds" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("AI error:", status, errText);
        continue; // skip this style but continue others
      }

      const aiData = await aiResponse.json();
      const b64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!b64) {
        console.error("No image in AI response for style:", style);
        continue;
      }

      // Upload to storage
      const base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const filePath = `${user.id}/products/${productId}/variation-${style}-${Date.now()}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("project-files")
        .upload(filePath, binaryData, { contentType: "image/png" });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("project-files")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Insert into appropriate table
      const styleLabel = style.charAt(0).toUpperCase() + style.slice(1).replace(/_/g, " ") + " Variation";
      
      if (targetTable === "product_graphics") {
        await supabase.from("product_graphics").insert({
          user_id: user.id,
          product_id: productId,
          image_url: publicUrl,
          label: styleLabel,
          source_style: style,
          is_original: false,
        });
      } else {
        await supabase.from("product_gallery").insert({
          user_id: user.id,
          product_id: productId,
          image_url: publicUrl,
          label: styleLabel,
          is_primary: false,
        });
      }

      results.push({ style, imageUrl: publicUrl });
      console.log(`✅ ${style} variation saved: ${publicUrl}`);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
