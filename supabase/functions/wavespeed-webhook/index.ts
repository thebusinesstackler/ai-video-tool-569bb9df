// Public webhook endpoint that WaveSpeed calls when a video task completes.
// Routed by `source` stored in video_tasks: 'reels-pro' (and similar) →
// auto-save to reels library + create a chatcut_drafts entry pre-loaded
// with the finished clip on the timeline.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WaveSpeedCallback {
  code?: number;
  message?: string;
  data?: {
    id: string;
    status?: string;
    outputs?: string[];
    error?: string;
  };
  // Some integrations send a flat shape
  id?: string;
  status?: string;
  outputs?: string[];
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let payload: WaveSpeedCallback;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[wavespeed-webhook] payload:", JSON.stringify(payload).slice(0, 500));

  const data = payload.data || (payload as any);
  const taskId: string | undefined = data?.id;
  const rawStatus: string = (data?.status || "").toLowerCase();
  const outputs: string[] = data?.outputs || [];
  const videoUrl: string | null = outputs?.[0] || null;
  const errorMsg: string | null = data?.error || null;

  if (!taskId) {
    return new Response(JSON.stringify({ ok: true, ignored: "no task id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const status =
    rawStatus === "completed" || rawStatus === "succeeded" || rawStatus === "success"
      ? "completed"
      : rawStatus === "failed" || rawStatus === "error" || rawStatus === "cancelled"
      ? "failed"
      : "processing";

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Look up the task we logged at create time
  const { data: taskRow, error: lookupErr } = await admin
    .from("video_tasks")
    .select("id, user_id, source, source_id, prompt, audio_url, metadata, model, scene_number")
    .eq("task_id", taskId)
    .maybeSingle();

  if (lookupErr || !taskRow) {
    console.error("[wavespeed-webhook] task not found for", taskId, lookupErr);
    return new Response(JSON.stringify({ ok: true, ignored: "task not tracked" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update task row
  await admin
    .from("video_tasks")
    .update({
      status,
      video_url: videoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskRow.id);

  if (status !== "completed" || !videoUrl) {
    console.log(`[wavespeed-webhook] task ${taskId} not completed (status=${status}, error=${errorMsg})`);
    return new Response(JSON.stringify({ ok: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const meta: any = taskRow.metadata || {};
  const source = taskRow.source || "";
  const userId = taskRow.user_id;

  // Auto-save to reels library + ChatCut for Reels Pro and any reels-flagged source
  const isReelsAutoSave = source === "reels-pro" || meta.autoSaveReel === true;

  if (isReelsAutoSave && userId) {
    try {
      const topic: string = meta.topic || "Reel from Reels Pro";
      const script: string = meta.script || "";
      const durationSec: number = Number(meta.durationSec) || 0;

      const { data: reelRow, error: reelErr } = await admin
        .from("reels")
        .insert({
          user_id: userId,
          topic,
          video_url: videoUrl,
          audio_url: taskRow.audio_url || meta.audioUrl || null,
          total_duration: Math.round(durationSec),
          scenes: script ? [{ narration: script, videoUrl, audioUrl: taskRow.audio_url || meta.audioUrl || null }] : [],
          is_draft: false,
        })
        .select("id")
        .single();

      if (reelErr) console.error("[wavespeed-webhook] reel insert failed:", reelErr);
      else console.log("[wavespeed-webhook] saved reel:", reelRow.id);

      // Auto-create ChatCut draft pre-loaded with this clip on the timeline
      if (meta.sendToChatcut !== false) {
        const draftName = `${topic} — Reels Pro`;
        const timelineState = {
          clips: [
            {
              id: crypto.randomUUID(),
              url: videoUrl,
              audioUrl: taskRow.audio_url || meta.audioUrl || null,
              start: 0,
              duration: durationSec || 0,
              source: "reels-pro",
              taskId,
            },
          ],
          duration: durationSec || 0,
        };

        const { data: draftRow, error: draftErr } = await admin
          .from("chatcut_drafts")
          .insert({
            user_id: userId,
            name: draftName,
            video_url: videoUrl,
            timeline_state: timelineState,
            chat_history: [
              {
                role: "system",
                content: `Auto-imported from Reels & Stories Pro. Topic: "${topic}". Clip is on the timeline with synced audio.`,
                created_at: new Date().toISOString(),
              },
            ],
          })
          .select("id")
          .single();

        if (draftErr) console.error("[wavespeed-webhook] chatcut draft insert failed:", draftErr);
        else console.log("[wavespeed-webhook] created chatcut draft:", draftRow.id);
      }
    } catch (err) {
      console.error("[wavespeed-webhook] auto-save error:", err);
    }
  }

  return new Response(JSON.stringify({ ok: true, status, videoUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
