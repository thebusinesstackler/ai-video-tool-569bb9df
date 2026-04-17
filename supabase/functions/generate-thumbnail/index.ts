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

    const prompt = `Create a SCROLL-STOPPING cover image for a short-form video.

${aspectLine}
${styleLine}

HEADLINE TO RENDER ON IMAGE (must be perfectly legible, max 6 words, ALL CAPS, large bold display type, with a strong outline or drop shadow so it reads at thumbnail size on a phone):
"${shortenHeadline(headline)}"

VIDEO TOPIC / TRANSCRIPT EXCERPT for visual inspiration (do NOT render this text — only the headline above):
"${transcript.toString().slice(0, 600)}"

${brandName ? `Brand: ${brandName}.` : ""}
Use the brand color ${brandPrimaryColor} as the dominant accent for the headline fill, underline bar, or button shape behind the text.
Use a typeface in the spirit of "${brandFont}" — bold weight only.

VISUAL DIRECTION:
- One clear subject or focal element supporting the headline (product, hand, face, object, dramatic scene).
- Strong contrast and lighting — image must be readable as a tiny thumbnail.
- Leave the headline as the loudest element; everything else supports it.
- NO watermarks, NO logos, NO UI chrome (no play button, no platform icons).
- NO extra text besides the single headline above (no captions, no subtitles, no taglines).

${extraPrompt ? `Extra direction from the editor: ${extraPrompt}` : ""}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
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
