// Generates a polished ANIMATED motion graphic for Chatcut AI.
// Pipeline:
//   1. Nano Banana 2 → transparent start frame (PNG)
//   2. Nano Banana 2 → transparent end frame   (PNG, evolved version of start)
//   3. WaveSpeed VEO 3.1 (image-to-video) animates start → end with the prompt
//   4. Polls until video is ready, returns videoUrl + start/end frame URLs.
//
// Marco (chatcut-director) calls this for "hero" graphics where a static PNG
// would feel cheap (big stat reveals, animated logos, product launches, etc).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

async function generateFrame(prompt: string, apiKey: string): Promise<string> {
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Frame gen failed (${resp.status}): ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("Frame gen returned no image");
  return url;
}

async function pollWaveSpeed(taskId: string, apiKey: string, maxMs = 180_000): Promise<string> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxMs) {
    const r = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.ok) {
      const j = await r.json();
      const status = j?.data?.status;
      if (status === "completed") {
        const out = j.data.outputs?.[0];
        if (out) return out;
        throw new Error("Completed but no output");
      }
      if (status === "failed") {
        throw new Error(j?.data?.error || "WaveSpeed task failed");
      }
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("Animation timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const WAVESPEED_API_KEY = Deno.env.get("WAVESPEED_API_KEY");
    if (!LOVABLE_API_KEY || !WAVESPEED_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY or WAVESPEED_API_KEY");
    }

    const {
      text = "",
      animationPrompt = "",
      type = "motion_graphic",
      brandPrimaryColor = "#7C3AED",
      brandTextColor = "#FFFFFF",
      brandFont = "Inter",
      aspectRatio = "9:16",
      duration = 4,
      fullCoverage = false,
    } = await req.json();

    // 1. Build frame prompts. Tight crop, transparent or solid bg depending on coverage.
    const bgRule = fullCoverage
      ? `Solid cinematic gradient background using ${brandPrimaryColor} as the dominant colour (deep, rich, full-bleed). NO transparency.`
      : `100% transparent canvas (alpha = 0). Only the graphic shape itself is visible. NO white or grey background.`;

    const brandLine = `Brand colour: ${brandPrimaryColor}. Text colour: ${brandTextColor}. Typography: bold modern sans-serif similar to ${brandFont}.`;

    const startPrompt = `Premium ${fullCoverage ? "full-screen" : "tight-cropped"} motion graphic START FRAME for a video reveal.
Headline: "${text}".
Style: ${type}. ${brandLine}
${bgRule}
Composition: text positioned but in its INITIAL state — slightly smaller, lower opacity (around 60%), subtle blur, like it's about to animate in. Tight composition, professional broadcast quality, sharp typography. Aspect ratio ${aspectRatio}.
NO watermarks, NO logos other than what's specified, NO checkerboard pattern.`;

    const endPrompt = `Premium ${fullCoverage ? "full-screen" : "tight-cropped"} motion graphic END FRAME — the FULLY REVEALED version of the same composition.
Headline: "${text}".
Style: ${type}. ${brandLine}
${bgRule}
Composition: text at FULL size, fully opaque, sharp, with a subtle highlight/glow accent. Same layout and colours as the start frame but in its final settled state. Aspect ratio ${aspectRatio}.
NO watermarks.`;

    console.log("Generating start + end frames...");
    const [startFrameUrl, endFrameUrl] = await Promise.all([
      generateFrame(startPrompt, LOVABLE_API_KEY),
      generateFrame(endPrompt, LOVABLE_API_KEY),
    ]);

    // 2. Submit VEO 3.1 image-to-video job. Wavespeed VEO image-to-video supports
    //    a single `image` (start frame). End frame is described in the prompt so
    //    VEO interpolates toward it.
    const veoPrompt = `${animationPrompt || `Smooth premium motion graphic reveal: "${text}" animates in with subtle zoom + glow.`}
The animation must feel polished and broadcast-quality: subtle camera push-in, type animates with a smooth scale-up and glow, background gradient shifts subtly. End on the fully-revealed graphic. NO watermarks, NO captions other than the specified headline.`;

    const veoBody = {
      prompt: veoPrompt,
      image: startFrameUrl,
      generate_audio: false,
      aspect_ratio: aspectRatio === "16:9" ? "16:9" : "9:16",
      duration: [4, 6, 8].includes(duration) ? duration : (duration <= 5 ? 4 : duration <= 7 ? 6 : 8),
      resolution: "720p",
    };

    console.log("Submitting VEO 3.1 image-to-video...");
    const veoResp = await fetch("https://api.wavespeed.ai/api/v3/google/veo3/image-to-video", {
      method: "POST",
      headers: { Authorization: `Bearer ${WAVESPEED_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(veoBody),
    });

    if (!veoResp.ok) {
      const t = await veoResp.text();
      throw new Error(`VEO submit failed (${veoResp.status}): ${t.slice(0, 200)}`);
    }
    const veoJson = await veoResp.json();
    const taskId = veoJson?.data?.id;
    if (!taskId) throw new Error("VEO returned no task id");

    console.log("Polling VEO task:", taskId);
    const videoUrl = await pollWaveSpeed(taskId, WAVESPEED_API_KEY);

    return new Response(
      JSON.stringify({ videoUrl, startFrameUrl, endFrameUrl, taskId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("generate-animated-graphic error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
