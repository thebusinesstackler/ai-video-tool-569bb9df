// Generate slide images via Manus API, re-host to Supabase Storage, return ordered URLs.
//
// Flow:
//   1. POST  https://api.manus.ai/v2/task.create   (force_skills:["slides"], full prompt)
//   2. POLL  https://api.manus.ai/v2/task.detail   until status === "completed" (max ~6 min)
//   3. GET   https://api.manus.ai/v2/task.listMessages
//        → walk every assistant_message.attachments, keep image/* in order
//   4. Download each image, upload to "project-files" bucket, return public URLs
//
// Returns: { slideUrls: string[], taskId, manusTaskUrl }
//
// Used by Chatcut AI (manual "🎞 Slides" button + Marco's add_slide_broll action)
// to drop AI-generated slide PNGs onto the B-roll track as static cutaways.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANUS_BASE = "https://api.manus.ai/v2";

interface SlideRequest {
  prompt: string;             // free-form description of the deck
  slideCount?: number;        // hint, e.g. 6
  style?: string;             // e.g. "minimalist dark", "bold tiktok-friendly"
  brandPrimary?: string;      // hex
  brandFont?: string;
}

async function manusFetch(path: string, apiKey: string, init: RequestInit = {}) {
  const r = await fetch(`${MANUS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-manus-api-key": apiKey,
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) {
    throw new Error(`Manus ${path} failed (${r.status}): ${typeof body === "string" ? body : JSON.stringify(body).slice(0, 400)}`);
  }
  return body;
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

    // Verify caller (fast-path JWT claims)
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

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

    // We DEMAND Manus return image previews for every slide so we can drop them on a video timeline.
    const fullPrompt =
      `Create exactly ${slideCount} presentation slides about: ${body.prompt}.${styleLine}${brandLine} ` +
      `Each slide must be visually striking with a single bold headline + minimal supporting text — designed to read clearly when overlaid behind a talking-head video. ` +
      `IMPORTANT: When the deck is ready, attach a high-resolution PNG preview image of EACH slide (one image per slide, in order) so they can be used as graphics in a video editor. ` +
      `Aspect ratio: 16:9. Do not include speaker notes in the preview images.`;

    console.log("[manus-slides] Creating task, slideCount=", slideCount);
    const created = await manusFetch("/task.create", MANUS_API_KEY, {
      method: "POST",
      body: JSON.stringify({
        message: {
          content: [{ type: "text", text: fullPrompt }],
          force_skills: ["slides"],
        },
        title: `Chatcut slides — ${body.prompt.slice(0, 60)}`,
        share_visibility: "private",
        agent_profile: "manus-1.6",
      }),
    });
    const taskId = created?.task_id as string;
    if (!taskId) throw new Error("Manus did not return task_id");
    console.log("[manus-slides] task_id=", taskId, "url=", created?.task_url);

    // Poll task.detail until completed (or fail). Manus slide tasks ~ 1-4 minutes.
    const POLL_INTERVAL_MS = 6000;
    const MAX_POLLS = 70; // ~7 minutes
    let finalStatus = "running";
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const detail = await manusFetch(`/task.detail?task_id=${encodeURIComponent(taskId)}`, MANUS_API_KEY, { method: "GET" });
        finalStatus = detail?.task?.status || finalStatus;
        if (i % 3 === 0) console.log(`[manus-slides] poll ${i} status=${finalStatus}`);
        if (finalStatus === "completed" || finalStatus === "failed" || finalStatus === "stopped") break;
      } catch (e) {
        console.warn("[manus-slides] poll error (continuing):", e instanceof Error ? e.message : e);
      }
    }
    if (finalStatus !== "completed") {
      throw new Error(`Manus task did not complete (status=${finalStatus}). Try again or simplify the prompt.`);
    }

    // List messages — take attachments from assistant messages, keep image/* in order they appear.
    const messages = await manusFetch(
      `/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=asc&limit=100`,
      MANUS_API_KEY,
      { method: "GET" },
    );
    const msgs = Array.isArray(messages?.messages) ? messages.messages : [];
    const rawSlideUrls: { url: string; filename: string }[] = [];
    for (const m of msgs) {
      const atts = m?.assistant_message?.attachments || [];
      for (const a of atts) {
        const ct = (a?.content_type || "").toLowerCase();
        const fn = (a?.filename || "").toLowerCase();
        const isImage = ct.startsWith("image/") || fn.endsWith(".png") || fn.endsWith(".jpg") || fn.endsWith(".jpeg") || fn.endsWith(".webp");
        if (isImage && a?.url) {
          rawSlideUrls.push({ url: a.url, filename: a.filename || `slide-${rawSlideUrls.length + 1}.png` });
        }
      }
    }
    if (rawSlideUrls.length === 0) {
      throw new Error("Manus returned no slide images. The deck may have completed without preview attachments — try adding 'attach PNG previews' to your prompt.");
    }
    console.log(`[manus-slides] got ${rawSlideUrls.length} raw slide attachments`);

    // Re-host every slide to our project-files bucket so links never expire.
    const slideUrls: string[] = [];
    for (let i = 0; i < rawSlideUrls.length; i++) {
      const { url, filename } = rawSlideUrls[i];
      try {
        const imgResp = await fetch(url);
        if (!imgResp.ok) {
          console.warn(`[manus-slides] download failed for ${filename}: ${imgResp.status}`);
          continue;
        }
        const bytes = new Uint8Array(await imgResp.arrayBuffer());
        const ext = filename.split(".").pop() || "png";
        const safeExt = /^(png|jpg|jpeg|webp)$/i.test(ext) ? ext.toLowerCase() : "png";
        const contentType = safeExt === "jpg" || safeExt === "jpeg" ? "image/jpeg" : safeExt === "webp" ? "image/webp" : "image/png";
        const path = `${userId}/manus-slides/${taskId}/slide-${String(i + 1).padStart(2, "0")}.${safeExt}`;
        const { error: upErr } = await supabase.storage.from("project-files").upload(path, bytes, {
          contentType,
          upsert: true,
        });
        if (upErr) {
          console.warn(`[manus-slides] upload failed for ${path}:`, upErr.message);
          continue;
        }
        const { data: pub } = supabase.storage.from("project-files").getPublicUrl(path);
        if (pub?.publicUrl) slideUrls.push(pub.publicUrl);
      } catch (e) {
        console.warn(`[manus-slides] re-host error for slide ${i + 1}:`, e instanceof Error ? e.message : e);
      }
    }

    if (slideUrls.length === 0) {
      throw new Error("Failed to re-host any slide images.");
    }

    return new Response(
      JSON.stringify({
        slideUrls,
        taskId,
        manusTaskUrl: created?.task_url || null,
        count: slideUrls.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[manus-slides] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
