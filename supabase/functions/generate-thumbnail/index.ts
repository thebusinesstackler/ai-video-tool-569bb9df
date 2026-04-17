import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate a TikTok-style thumbnail image with Nano Banana
 * (google/gemini-2.5-flash-image) via the Lovable AI Gateway.
 *
 * Marco calls this from ChatcutAI when the user asks for a thumbnail
 * (or proactively when a video has no opening title card).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      transcript = "",
      hookText = "",
      brandName = "",
      brandPrimaryColor = "#FACC15",
      brandFont = "Montserrat",
      style = "tiktok-bold",
      aspectHint = "vertical",
      extraPrompt = "",
      productImageUrl = null,
      productName = null,
    } = body || {};

    // Build a focused prompt for a high-energy TikTok cover image.
    // Nano Banana renders bold typography directly in the image.
    const aspectLine =
      aspectHint === "horizontal"
        ? "Composition: 16:9 horizontal cover."
        : aspectHint === "square"
        ? "Composition: 1:1 square cover."
        : "Composition: 9:16 vertical mobile cover (TikTok / Reels / Shorts).";

    const styleLine =
      style === "minimal"
        ? "Style: clean minimal editorial cover, generous negative space, refined sans-serif headline, soft realistic photography."
        : style === "cinematic"
        ? "Style: cinematic movie-poster look, dramatic lighting, rich color grade, large condensed serif/sans headline."
        : "Style: high-energy TikTok / MrBeast-style cover. Punchy text, exaggerated facial expression if a person is implied, saturated colors, thick outlined headline that pops, slight tilt for momentum.";

    const headline = (hookText || transcript)
      .toString()
      .trim()
      .slice(0, 120) || "WATCH THIS";

    // CRITICAL: when a product reference image is provided, treat this as a COMPOSITING task —
    // lift the product pixels from the reference and place them into the new cover scene.
    const productLine = productImageUrl
      ? `\n\nPRODUCT COMPOSITING TASK (CRITICAL — DO NOT REDRAW THE PRODUCT):
The attached reference image shows the user's ACTUAL product${productName ? ` ("${productName}")` : ""} on a plain background.
You MUST treat this as a compositing job, NOT a redraw:
- Cut the product out of the reference and place it as the HERO element of the new cover scene.
- Preserve the product's label, text, typography, logo, colors, bottle/packaging shape, dropper cap, and proportions PIXEL-FOR-PIXEL exactly as they appear in the reference. Every word on the label must remain readable and identical.
- You MAY relight the product to match the new scene's lighting, add cast shadows, reflections, motion blur or splash effects AROUND it, rotate or tilt it for dynamism, and scale it.
- You MUST NOT invent a new label, change the brand name, alter the color of the bottle, swap the cap, or "stylize" the product artwork in any way. If you cannot preserve the label exactly, leave the product unchanged.
- Build the rest of the scene (background, splashes, FX, supporting elements, headline) AROUND this composited product.
The reference image is the source of truth for the product's appearance — non-negotiable.`
      : "";

    const prompt = `Create a SCROLL-STOPPING cover image for a short-form video.

${aspectLine}
${styleLine}

HEADLINE TO RENDER ON IMAGE (must be perfectly legible, max 6 words, ALL CAPS, large bold display type, with a strong outline or drop shadow so it reads at thumbnail size on a phone):
"${shortenHeadline(headline)}"

VIDEO TOPIC / TRANSCRIPT EXCERPT for visual inspiration (do NOT render this text — only the headline above):
"${transcript.toString().slice(0, 600)}"

${brandName ? `Brand: ${brandName}.` : ""}
Use the brand color ${brandPrimaryColor} as the dominant accent for the headline fill, underline bar, or button shape behind the text.
Use a typeface in the spirit of "${brandFont}" — bold weight only.${productLine}

VISUAL DIRECTION:
- One clear subject or focal element supporting the headline (product, hand, face, object, dramatic scene).
- Strong contrast and lighting — image must be readable as a tiny thumbnail.
- Leave the headline as the loudest element; everything else supports it.
- NO watermarks, NO logos, NO UI chrome (no play button, no platform icons).
- NO extra text besides the single headline above (no captions, no subtitles, no taglines).

${extraPrompt ? `Extra direction from the editor: ${extraPrompt}` : ""}`;

    // Multimodal content: include the reference product image inline so Nano Banana
    // can faithfully reproduce its label/packaging.
    const userContent: any[] = [{ type: "text", text: prompt }];
    if (productImageUrl) {
      userContent.push({ type: "image_url", image_url: { url: productImageUrl } });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Nano Banana 2 is dramatically better at preserving exact product labels/packaging
        // from a reference image when compositing. Fall back to Nano Banana 1 if no product ref.
        model: productImageUrl
          ? "google/gemini-3.1-flash-image-preview"
          : "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: productImageUrl ? userContent : prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Credits required. Please add funds to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("Nano Banana error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Thumbnail generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const imageUrl =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
      data?.choices?.[0]?.message?.images?.[0]?.url ||
      null;

    if (!imageUrl) {
      console.error("No image in response", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "No image returned by model" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imageUrl, headline: shortenHeadline(headline) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-thumbnail error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function shortenHeadline(s: string): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ");
  return words.slice(0, 6).join(" ").toUpperCase();
}
