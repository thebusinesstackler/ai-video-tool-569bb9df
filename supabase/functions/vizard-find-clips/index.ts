import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { projectId, transcript, videoDuration } = await req.json();
    if (!projectId || !transcript) throw new Error("Missing projectId or transcript");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build transcript text for analysis
    let transcriptText = "";
    if (Array.isArray(transcript)) {
      transcriptText = transcript
        .map((seg: any) => `[${formatTime(seg.start)}] ${seg.text}`)
        .join("\n");
    } else if (typeof transcript === "string") {
      transcriptText = transcript;
    } else if (transcript.segments) {
      transcriptText = transcript.segments
        .map((seg: any) => `[${formatTime(seg.start)}] ${seg.text}`)
        .join("\n");
    }

    // Scale clip count based on video duration
    const resolvedDuration =
      typeof videoDuration === "number" && Number.isFinite(videoDuration) && videoDuration > 0
        ? videoDuration
        : estimateTranscriptDuration(transcript);
    const durationMin = Math.max(1, Math.round(resolvedDuration / 60));
    const minClips = Math.max(8, Math.round(durationMin * 1.2));
    const maxClips = Math.max(15, Math.round(durationMin * 2));

    const systemPrompt = `You are a viral video clip strategist. Analyze this transcript from a long-form video and identify the ${minClips}-${maxClips} best moments that would make compelling short-form clips (15-60 seconds each).

For each clip, provide:
- A catchy title
- A brief description of why it's compelling
- Precise start and end timestamps (in seconds)
- A virality score from 1-10
- 2-3 tags describing the content type (e.g., "hook", "insight", "emotional", "controversial", "funny", "educational")

Focus on:
- Strong hooks and opening statements
- Emotional peaks or surprising revelations
- Actionable insights or key takeaways
- Controversial or debate-worthy moments
- Funny or relatable moments
- Complete thoughts (don't cut mid-sentence)

Be thorough — for a ${durationMin}-minute video, you should find at LEAST ${minClips} clips. If the strongest moments are fewer than that, include secondary but still complete moments so you never return fewer than ${minClips}. Cover the entire video from start to finish, not just the beginning.

Video duration: ${videoDuration || "unknown"} seconds.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the transcript:\n\n${transcriptText}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_clips",
              description: "Return the identified viral clips",
              parameters: {
                type: "object",
                properties: {
                  clips: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique clip ID like clip_1, clip_2" },
                        title: { type: "string" },
                        description: { type: "string" },
                        start: { type: "number", description: "Start time in seconds" },
                        end: { type: "number", description: "End time in seconds" },
                        score: { type: "number", description: "Virality score 1-10" },
                        tags: { type: "array", items: { type: "string" } },
                      },
                      required: ["id", "title", "description", "start", "end", "score", "tags"],
                    },
                  },
                },
                required: ["clips"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_clips" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    let clips: any[] = [];

    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      clips = parsed.clips || [];
    }

    // Add exported: false to each clip
    clips = clips.map((c: any) => ({ ...c, exported: false }));

    // Update the project
    const { error: updateError } = await supabase
      .from("vizard_projects")
      .update({ clips, status: "ready" })
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ clips }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vizard-find-clips error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function estimateTranscriptDuration(transcript: any): number {
  const segments = Array.isArray(transcript)
    ? transcript
    : Array.isArray(transcript?.segments)
      ? transcript.segments
      : [];

  if (segments.length > 0) {
    const maxEnd = segments.reduce((max: number, seg: any) => {
      const end = Number(seg?.end ?? seg?.start ?? 0);
      return Number.isFinite(end) ? Math.max(max, end) : max;
    }, 0);

    if (maxEnd > 0) return maxEnd;
  }

  if (typeof transcript === "string") {
    const words = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (words > 0) return Math.max(60, Math.round(words / 2.5));
  }

  return 600;
}
