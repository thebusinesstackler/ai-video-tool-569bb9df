import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  lifestyle:
    "Recreate this product shot with a DIFFERENT person in a completely different lifestyle setting. Keep the exact same product/bottle but place it with a new person — maybe someone cooking in a bright kitchen, reading in a sunlit living room, or doing yoga at home. Change the person's look, outfit, and background entirely. The product must look identical to the original.",
  white_bg:
    "Take just the product/bottle from this image and place it on a clean pure white background. Professional e-commerce product photography. Remove all people and backgrounds. Only the product, perfectly lit with soft studio lighting, centered, sharp focus.",
  ugc:
    "Recreate this as a totally different UGC-style photo. Show a DIFFERENT person (different age, ethnicity, style) casually holding or using this exact same product in a different everyday setting — maybe at a desk, in a car, at a café, or on a couch. Shot on iPhone, natural lighting, authentic and relatable. The product must be the same bottle/item.",
  flat_lay:
    "Take this exact product/bottle and arrange it in a beautiful flat lay composition shot from directly above on a clean surface. Surround it with complementary lifestyle props (plants, books, candles, fruits, fabric textures) that match the product's wellness/health vibe. No people. The product must look identical.",
  nature:
    "Take this exact product/bottle and place it in a completely different natural outdoor setting — maybe on a mossy rock by a stream, on a wooden table in a garden, or nestled among wildflowers. Golden hour lighting, lush greenery, organic feel. No people. The product must be clearly recognizable and identical.",
  studio:
    "Take this exact product/bottle and photograph it with dramatic studio lighting on a dark, moody background. Rim lighting, subtle color glow, luxury premium feel. Cinematic and bold. No people. The product must look identical to the original.",
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
      const contextPrompt = `Product: "${productName || "product"}"${productDescription ? `. Description: ${productDescription}` : ""}. ${basePrompt}`;

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
            model: "google/gemini-3.1-flash-image-preview",
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
