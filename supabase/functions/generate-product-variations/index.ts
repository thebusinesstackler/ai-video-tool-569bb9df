import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  lifestyle:
    "Place this exact product in a cozy, warm home setting with natural lighting streaming through a window. Style: lifestyle product photography, editorial, aspirational. Keep the product clearly visible and recognizable as the hero element.",
  white_bg:
    "Place this exact product on a clean, pure white background. Studio product photography with soft even lighting, no shadows. Professional e-commerce style photo. Keep the product perfectly sharp and centered.",
  ugc:
    "Show a real person casually holding this exact product, shot in the style of an iPhone selfie / UGC content. Natural, authentic, relatable. The person should look like a genuine customer, not a model.",
  flat_lay:
    "Arrange this exact product in a beautiful flat lay composition shot from directly above. Include complementary lifestyle props (notebook, coffee, plant, etc.) that match the product's vibe. Clean, Instagram-worthy aesthetic.",
  nature:
    "Place this exact product in a lush natural outdoor setting with greenery, soft sunlight, and organic textures. The product should be the focal point with a dreamy, fresh, wellness-inspired feel.",
  studio:
    "Dramatic studio lighting on a dark, moody background. This exact product lit with rim lighting and a subtle gradient. Luxury, premium, high-end product shot. Cinematic and bold.",
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

      // Insert into product_gallery
      const styleLabel = style.charAt(0).toUpperCase() + style.slice(1).replace(/_/g, " ") + " Variation";
      await supabase.from("product_gallery").insert({
        user_id: user.id,
        product_id: productId,
        image_url: publicUrl,
        label: styleLabel,
        is_primary: false,
      });

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
