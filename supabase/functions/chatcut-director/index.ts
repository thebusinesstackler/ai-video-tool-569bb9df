import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, transcript, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Chatcut AI, a professional video editor assistant. You help users clean up raw footage by analyzing transcripts and suggesting cuts.

Your capabilities:
1. **Auto-Clean**: When given a transcript, identify all filler words (um, uh, like, you know, so, basically, actually, right, I mean) and awkward pauses (gaps > 1.5s between words). Return a structured list of suggested cuts.
2. **Chat**: Answer questions about video editing, suggest improvements, and help users refine their cuts.

When returning cut suggestions, use this exact JSON format wrapped in a code block:
\`\`\`cuts
[
  {"start": 1.2, "end": 1.8, "reason": "Filler word: um", "type": "filler"},
  {"start": 5.0, "end": 6.5, "reason": "Awkward pause", "type": "pause"},
  {"start": 12.3, "end": 12.9, "reason": "Filler word: like", "type": "filler"}
]
\`\`\`

Rules:
- Always be specific about timestamps
- Group nearby cuts when they're within 0.3s of each other
- Preserve natural speech rhythm - don't cut every single "like" if it flows naturally
- When the user asks to "clean" or "auto-clean", analyze the transcript and return cut suggestions
- Be conversational and helpful when chatting
- If no transcript is provided yet, ask the user to upload a video first`;

    const allMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (transcript) {
      allMessages.push({
        role: "system",
        content: `Here is the video transcript:\n\n${JSON.stringify(transcript)}`,
      });
    }

    if (messages && Array.isArray(messages)) {
      allMessages.push(...messages);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits required. Please add funds to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chatcut-director error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
