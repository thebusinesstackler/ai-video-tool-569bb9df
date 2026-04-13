import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIZARD_BASE = "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const VIZARD_API_KEY = Deno.env.get("VIZARD_API_KEY");
    if (!VIZARD_API_KEY) throw new Error("VIZARD_API_KEY not configured");

    const body = await req.json();
    const { action } = body;

    // ---- CREATE PROJECT ----
    if (action === "create") {
      const { videoUrl, videoType, projectName, lang, preferLength, maxClipNumber, ratioOfClip } = body;
      if (!videoUrl) throw new Error("Missing videoUrl");

      const payload: Record<string, any> = {
        videoUrl,
        videoType: videoType ?? 1, // default: remote file
        lang: lang ?? "en",
        preferLength: preferLength ?? [0], // auto
        ext: videoUrl.split(".").pop()?.split("?")[0] || "mp4",
      };
      if (projectName) payload.projectName = projectName;
      if (maxClipNumber) payload.maxClipNumber = maxClipNumber;
      if (ratioOfClip) payload.ratioOfClip = ratioOfClip;
      // Enable subtitles and headlines by default
      payload.subtitleSwitch = 1;
      payload.headlineSwitch = 1;

      console.log("Creating Vizard project:", JSON.stringify(payload));

      const resp = await fetch(`${VIZARD_BASE}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const result = await resp.json();
      console.log("Vizard create response:", JSON.stringify(result));

      if (result.code !== 2000) {
        throw new Error(result.errMsg || `Vizard API error code ${result.code}`);
      }

      return new Response(JSON.stringify({
        vizardProjectId: result.projectId,
        shareLink: result.shareLink || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- QUERY PROJECT ----
    if (action === "query") {
      const { vizardProjectId } = body;
      if (!vizardProjectId) throw new Error("Missing vizardProjectId");

      const resp = await fetch(`${VIZARD_BASE}/query/${vizardProjectId}`, {
        method: "GET",
        headers: {
          "VIZARDAI_API_KEY": VIZARD_API_KEY,
        },
      });

      const result = await resp.json();
      console.log("Vizard query response code:", result.code, "videos:", result.videos?.length ?? 0);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("vizard-api error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
