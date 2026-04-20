// Poll a Manus slide-generation task. When complete, walk the assistant attachments,
// re-host every image to our `project-files` bucket, and return ordered public URLs.
//
// Client polls this every ~10s with { taskId } until status === "completed".

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANUS_BASE = "https://api.manus.ai/v2";

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
    const userId = claimsData.claims.sub as string;

    const { taskId } = await req.json();
    if (!taskId || typeof taskId !== "string") {
      return new Response(JSON.stringify({ error: "taskId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Status check
    const detailResp = await fetch(`${MANUS_BASE}/task.detail?task_id=${encodeURIComponent(taskId)}`, {
      headers: { "x-manus-api-key": MANUS_API_KEY },
    });
    const detail = await detailResp.json();
    if (!detailResp.ok) {
      throw new Error(`Manus task.detail failed (${detailResp.status}): ${JSON.stringify(detail).slice(0, 300)}`);
    }
    const status = detail?.task?.status || "unknown";

    if (status === "running" || status === "queued" || status === "pending") {
      return new Response(JSON.stringify({ status, ready: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === "failed" || status === "stopped" || status === "cancelled") {
      return new Response(JSON.stringify({ status, ready: false, error: `Manus task ${status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // status === "completed" — fetch messages & extract slide images.
    const msgsResp = await fetch(
      `${MANUS_BASE}/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=asc&limit=100`,
      { headers: { "x-manus-api-key": MANUS_API_KEY } },
    );
    const msgsData = await msgsResp.json();
    if (!msgsResp.ok) {
      throw new Error(`Manus listMessages failed (${msgsResp.status}): ${JSON.stringify(msgsData).slice(0, 300)}`);
    }
    const msgs = Array.isArray(msgsData?.messages) ? msgsData.messages : [];

    const rawSlideUrls: { url: string; filename: string }[] = [];
    for (const m of msgs) {
      const atts = m?.assistant_message?.attachments || [];
      for (const a of atts) {
        const ct = (a?.content_type || "").toLowerCase();
        const fn = (a?.filename || "").toLowerCase();
        const isImage =
          ct.startsWith("image/") ||
          fn.endsWith(".png") || fn.endsWith(".jpg") || fn.endsWith(".jpeg") || fn.endsWith(".webp");
        if (isImage && a?.url) {
          rawSlideUrls.push({ url: a.url, filename: a.filename || `slide-${rawSlideUrls.length + 1}.png` });
        }
      }
    }
    if (rawSlideUrls.length === 0) {
      return new Response(
        JSON.stringify({
          status: "completed",
          ready: false,
          error: "Manus completed the task but returned no slide images. Try regenerating with the prompt 'attach PNG previews of every slide'.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Re-host every slide image so links never expire.
    const slideUrls: string[] = [];
    for (let i = 0; i < rawSlideUrls.length; i++) {
      const { url, filename } = rawSlideUrls[i];
      try {
        const imgResp = await fetch(url);
        if (!imgResp.ok) continue;
        const bytes = new Uint8Array(await imgResp.arrayBuffer());
        const ext = (filename.split(".").pop() || "png").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp)$/i.test(ext) ? ext : "png";
        const contentType =
          safeExt === "jpg" || safeExt === "jpeg" ? "image/jpeg" :
          safeExt === "webp" ? "image/webp" : "image/png";
        const path = `${userId}/manus-slides/${taskId}/slide-${String(i + 1).padStart(2, "0")}.${safeExt}`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(path, bytes, { contentType, upsert: true });
        if (upErr) {
          console.warn(`upload failed ${path}:`, upErr.message);
          continue;
        }
        const { data: pub } = supabase.storage.from("project-files").getPublicUrl(path);
        if (pub?.publicUrl) slideUrls.push(pub.publicUrl);
      } catch (e) {
        console.warn("re-host error:", e instanceof Error ? e.message : e);
      }
    }

    if (slideUrls.length === 0) {
      return new Response(
        JSON.stringify({ status: "completed", ready: false, error: "Failed to re-host slide images." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ status: "completed", ready: true, slideUrls, count: slideUrls.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[check-manus-slides] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
