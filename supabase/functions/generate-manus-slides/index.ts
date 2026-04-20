// Generate slide images via Manus API — KICK-OFF ONLY.
//
// This endpoint creates a Manus slide-generation task and returns the task_id immediately.
// The client should then poll `check-manus-slides` to know when the slide PNGs are ready.
//
// Why split it? Manus slide tasks take 1–4 minutes; Supabase edge functions have a soft
// timeout that's too short for synchronous polling. Splitting also lets the UI keep
// editing while slides render in the background (matches the existing BackgroundVideoContext pattern).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANUS_BASE = "https://api.manus.ai/v2";

interface SlideRequest {
  prompt: string;
  slideCount?: number;
  style?: string;
  brandPrimary?: string;
  brandFont?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MANUS_API_KEY = Deno.env.get("MANUS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!MANUS_API_KEY) throw new Error("MANUS_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service config missing");

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SlideRequest;
    if (!body?.prompt || typeof body.prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slideCount = Math.max(2, Math.min(15, body.slideCount ?? 6));
    const styleLine = body.style ? ` Visual style: ${body.style}.` : "";
    const brandLine = body.brandPrimary
      ? ` Use ${body.brandPrimary} as the dominant brand color${body.brandFont ? `, typography similar to ${body.brandFont}` : ""}.`
      : "";

    // Demand image previews per slide so we can drop them on the timeline.
    const fullPrompt =
      `Create exactly ${slideCount} presentation slides about: ${body.prompt}.${styleLine}${brandLine} ` +
      `Each slide must be visually striking with a single bold headline + minimal supporting text — designed to read clearly when overlaid behind a talking-head video. ` +
      `IMPORTANT: When the deck is ready, attach a high-resolution PNG preview image of EACH slide (one image per slide, in order) so they can be used as graphics in a video editor. ` +
      `Aspect ratio: 16:9. Do not include speaker notes in the preview images.`;

    const r = await fetch(`${MANUS_BASE}/task.create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manus-api-key": MANUS_API_KEY },
      body: JSON.stringify({
        message: { content: [{ type: "text", text: fullPrompt }], force_skills: ["slides"] },
        title: `Chatcut slides — ${body.prompt.slice(0, 60)}`,
        share_visibility: "private",
        agent_profile: "manus-1.6",
      }),
    });
    const text = await r.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      throw new Error(`Manus task.create failed (${r.status}): ${typeof data === "string" ? data : JSON.stringify(data).slice(0, 400)}`);
    }
    const taskId = data?.task_id;
    if (!taskId) throw new Error("Manus did not return task_id");

    return new Response(
      JSON.stringify({
        taskId,
        manusTaskUrl: data?.task_url || null,
        slideCount,
        message: "Slides are generating — poll check-manus-slides every ~10s.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[manus-slides] kickoff error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
