import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "videoUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Download the video and convert to base64 for inline media
    console.log(`[analyze-audio-trim] Downloading video: ${videoUrl.substring(0, 80)}...`);
    const videoResp = await fetch(videoUrl);
    if (!videoResp.ok) {
      throw new Error(`Failed to download video: ${videoResp.status}`);
    }
    const videoBuffer = await videoResp.arrayBuffer();
    const videoBytes = new Uint8Array(videoBuffer);

    // Convert to base64
    let base64 = "";
    const chunkSize = 8192;
    for (let i = 0; i < videoBytes.length; i += chunkSize) {
      const chunk = videoBytes.subarray(i, Math.min(i + chunkSize, videoBytes.length));
      base64 += String.fromCharCode(...chunk);
    }
    base64 = btoa(base64);

    const contentType = videoResp.headers.get("content-type") || "video/mp4";
    console.log(`[analyze-audio-trim] Video downloaded: ${(videoBytes.length / 1024 / 1024).toFixed(2)} MB, type: ${contentType}`);

    // Call Gemini 2.5 Flash via Lovable AI Gateway with tool calling for structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an audio analysis expert. You analyze video clips to detect whether speech/narration is cut off abruptly at the end — for example, mid-word or mid-sentence. Your job is to find the timestamp of the last naturally completed sentence in the audio.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: `Listen to the audio in this video clip carefully. Find the timestamp of the last naturally completed sentence. If speech is cut off mid-word at the end, return the timestamp right after the last complete sentence. If the audio ends cleanly with no cutoff, return the full duration as the trim timestamp.

Important: Return the timestamp in seconds (e.g., 14.5). Be precise to within 0.5 seconds.`,
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_trim_point",
              description: "Report the timestamp where the video should be trimmed for a clean audio ending.",
              parameters: {
                type: "object",
                properties: {
                  trimTimestamp: {
                    type: "number",
                    description: "The timestamp in seconds right after the last naturally completed sentence. If no cutoff detected, this equals the video duration.",
                  },
                  reason: {
                    type: "string",
                    description: "Brief explanation: was speech cut off mid-word, or did it end cleanly?",
                  },
                  hasCutoff: {
                    type: "boolean",
                    description: "True if speech was cut off mid-word/mid-sentence at the end, false if it ended cleanly.",
                  },
                },
                required: ["trimTimestamp", "reason", "hasCutoff"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_trim_point" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("[analyze-audio-trim] AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log("[analyze-audio-trim] AI response received");

    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("[analyze-audio-trim] No tool call in response:", JSON.stringify(aiResult));
      // Fallback: return no-trim result
      return new Response(
        JSON.stringify({ trimTimestamp: -1, reason: "AI did not return structured output", hasCutoff: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`[analyze-audio-trim] Result: trim=${result.trimTimestamp}s, cutoff=${result.hasCutoff}, reason=${result.reason}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-audio-trim] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
