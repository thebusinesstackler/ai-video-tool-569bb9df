import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Vizard webhook received:", JSON.stringify(body));

    const { projectId, code, videos, errMsg } = body;

    if (!projectId) {
      console.error("Webhook missing projectId");
      return new Response(JSON.stringify({ ok: false, error: "Missing projectId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the local project by vizard_api_project_id
    const { data: project, error: findErr } = await supabase
      .from("vizard_projects")
      .select("id, clips")
      .eq("vizard_api_project_id", projectId)
      .maybeSingle();

    if (findErr || !project) {
      console.error("Project not found for vizardProjectId:", projectId, findErr);
      return new Response(JSON.stringify({ ok: false, error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processing complete with videos
    if (code === 2000 && Array.isArray(videos) && videos.length > 0) {
      const clips = videos.map((v: any, i: number) => ({
        id: `clip_${i + 1}`,
        title: v.title || `Clip ${i + 1}`,
        description: v.viralReason || "",
        start: 0,
        end: (v.videoMsDuration || 0) / 1000,
        score: parseInt(v.viralScore) || 0,
        tags: parseRelatedTopics(v.relatedTopic),
        exported: false,
      }));

      await supabase.from("vizard_projects").update({
        clips,
        vizard_videos: videos,
        status: "ready",
      }).eq("id", project.id);

      console.log(`Project ${project.id} updated to ready with ${clips.length} clips`);
    }
    // Failed
    else if (code === 4002 || code === 4004 || code === 4005 || code === 4008) {
      await supabase.from("vizard_projects").update({
        status: "failed",
        error: errMsg || `Vizard error code ${code}`,
      }).eq("id", project.id);
      console.log(`Project ${project.id} marked as failed: ${errMsg}`);
    }
    // Still processing or unknown code — log only
    else {
      console.log(`Vizard webhook code ${code} for project ${project.id} — no action taken`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vizard-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseRelatedTopics(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 3) : [];
  } catch {
    return [];
  }
}
