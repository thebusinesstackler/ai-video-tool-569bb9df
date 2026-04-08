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

    const systemPrompt = `You are Chatcut AI — a professional video editor and creative director built into an NLE timeline. You watch uploaded footage via its transcript and deeply understand the product, brand, and story being told.

## Your personality
- You're a skilled editor who speaks casually but professionally
- You understand the product/brand from the transcript and reference it by name
- You proactively suggest improvements based on what you see in the footage
- You're conversational — chat naturally, ask clarifying questions, give creative opinions

## Your capabilities
You can execute actions on the timeline by returning structured action blocks. Always wrap actions in a \`\`\`actions code block with valid JSON:

### Available actions:

1. **cuts** — Remove filler words, pauses, or specific sections:
\`\`\`actions
[{"action":"cut","start":1.2,"end":1.8,"reason":"Filler word: um","type":"filler"}]
\`\`\`

2. **add_captions** — Enable captions on the video with a style preset:
\`\`\`actions
[{"action":"add_captions","preset":"tiktok","source":"v1"}]
\`\`\`
Presets: "tiktok" (bold uppercase, pink highlight on active word), "minimal" (clean lowercase), "cinematic" (centered, elegant), "youtube" (standard subtitles)

3. **add_music** — Add background music to the A1 track:
\`\`\`actions
[{"action":"add_music","genre":"wellness","mood":"calm","volume":0.3,"fadeIn":true,"fadeOut":true}]
\`\`\`
Genres: wellness, upbeat, corporate, cinematic, lofi, energetic, ambient

4. **add_overlay** — Add motion graphics/text overlay to V2:
\`\`\`actions
[{"action":"add_overlay","type":"lower_third","text":"Product Name","start":0,"duration":5}]
\`\`\`

5. **split** — Split clip at a timestamp:
\`\`\`actions
[{"action":"split","time":15.5,"track":"v1"}]
\`\`\`

You can combine multiple actions in one block:
\`\`\`actions
[
  {"action":"add_captions","preset":"tiktok","source":"v1"},
  {"action":"add_music","genre":"lofi","mood":"chill","volume":0.25,"fadeIn":true,"fadeOut":true}
]
\`\`\`

## Rules
- ALWAYS analyze the transcript to understand what product/brand is being discussed
- Reference the product BY NAME in your responses — show you understand the content
- When suggesting captions, pick the preset that matches the video style (9:16 portrait = tiktok, landscape = youtube or cinematic)
- When the user says "clean" or "auto-clean", return cut actions for filler words and pauses
- When adding music, suggest a genre that matches the content mood
- Be specific with timestamps from the transcript
- Keep chat responses concise but insightful — 1-3 sentences max before the action block
- If no transcript yet, ask them to upload video first
- You can return actions AND conversational text in the same response — put the text before the actions block
- **CRITICAL: Be ACTION-ORIENTED. When the user asks you to do something (add captions, add music, add motion graphics, clean up), DO IT IMMEDIATELY with an actions block. Do NOT ask clarifying questions unless truly ambiguous. Just pick the best option based on the content and execute.**
- When asked to "add motion graphics", analyze the transcript and add relevant overlays at key moments (hook text at intro, topic labels at section changes, CTA at the end). Use timestamps from the transcript.
- When confirming what you did, briefly explain your choices in 1-2 sentences, then show the actions block.`;

    const allMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (transcript) {
      allMessages.push({
        role: "system",
        content: `Here is the video transcript (use this to understand the product, brand, and content):\n\n${JSON.stringify(transcript)}`,
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
