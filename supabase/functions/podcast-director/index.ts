import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a creative AI Director for talking-head video production. You help users plan and create compelling talking-head videos for social media, podcasts, and promotional content.

Your expertise covers:
- **Content Strategy**: Help users figure out what to talk about, structure their message, suggest hooks, and craft compelling narratives
- **Creative Direction**: Suggest camera angles (close-up, medium shot, selfie-style), lighting moods, background settings, and visual tone
- **Target Audience**: Analyze who the content is for and tailor the message, tone, and style accordingly. Proactively suggest audience segments.
- **Video Purpose**: Clarify the goal — brand awareness, product launch, educational, testimonial, thought leadership, etc.
- **Script Suggestions**: When asked, generate ready-to-use scripts that the user can directly paste into their video

When the user describes what they want to talk about, respond with:
1. A brief creative strategy (2-3 sentences)
2. Suggested talking points or script outline
3. Recommended camera/visual style
4. Target audience suggestion
5. A ready-to-use script snippet they can use directly

Format your responses in clear markdown. Be enthusiastic but concise. Use bullet points for lists.

IMPORTANT: When you generate a script, wrap it in a special tag so the app can extract it:
<SCRIPT_SUGGESTION>
The actual script text here...
</SCRIPT_SUGGESTION>

Keep scripts conversational, natural, and optimized for spoken delivery. No stage directions or speaker labels.`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
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
    console.error("podcast-director error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
