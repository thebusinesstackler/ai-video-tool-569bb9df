/**
 * chatcut-support — lightweight GPT-5-mini support brain for Chatcut AI.
 *
 * Handles fast, cheap utility tasks that the heavy Director brain shouldn't burn cycles on:
 *  - rewrite_overlay_text  → 3 punchier headline variations for an existing graphic
 *  - suggest_hooks         → 3 hook rewrites for the opening 6s
 *  - clean_captions        → strip filler words from a transcript
 *  - generate_metadata     → social title + description + hashtags from the timeline
 *
 * Always non-streaming JSON (these are quick one-shots), tool-calling for structured output.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORT_MODEL = "openai/gpt-5-mini";

async function callGateway(body: Record<string, unknown>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI gateway ${r.status}: ${t}`);
  }
  return await r.json();
}

function extractToolArgs(data: any): any {
  const msg = data?.choices?.[0]?.message;
  const call = msg?.tool_calls?.[0];
  if (call?.function?.arguments) {
    try { return JSON.parse(call.function.arguments); } catch { /* fall through */ }
  }
  // Fallback: try to parse raw content as JSON
  if (typeof msg?.content === "string") {
    try { return JSON.parse(msg.content); } catch { /* ignore */ }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { task, brandSettings, brandVocabulary } = body;

    const brandLine = brandSettings
      ? `Brand: primary ${brandSettings.primaryColor || ''}, font ${brandSettings.font || ''}, website ${brandSettings.websiteUrl || ''}.`
      : '';
    const vocabLine = Array.isArray(brandVocabulary) && brandVocabulary.length
      ? `Spell these brand names EXACTLY: ${brandVocabulary.map((s: string) => `"${s}"`).join(", ")}.`
      : '';

    let systemPrompt = "";
    let userPrompt = "";
    let tool: any = null;

    if (task === "rewrite_overlay_text") {
      const { currentText, intent, treatment, contextLine } = body;
      systemPrompt = `You are a senior commercial copywriter. Rewrite an on-screen overlay headline to be punchier, more specific, and conversion-focused. Keep it under 7 words unless it's a quote. ${brandLine} ${vocabLine}`;
      userPrompt = `Current headline: "${currentText}"
Intent: ${intent || 'general'} (${treatment || 'text card'})
Spoken context at this moment: "${contextLine || ''}"

Give me 3 sharper variations.`;
      tool = {
        type: "function",
        function: {
          name: "return_variations",
          description: "Return 3 punchier headline variations.",
          parameters: {
            type: "object",
            properties: {
              variations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    why: { type: "string" },
                  },
                  required: ["text", "why"],
                  additionalProperties: false,
                },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ["variations"],
            additionalProperties: false,
          },
        },
      };
    } else if (task === "suggest_hooks") {
      const { transcript } = body;
      const opening = typeof transcript === "string"
        ? transcript.slice(0, 600)
        : JSON.stringify(transcript || {}).slice(0, 1200);
      systemPrompt = `You are a viral-hook expert. Rewrite the opening so it stops the scroll in the first 2 seconds. Use curiosity, specificity, contrarian framing, or a number. Keep each hook under 14 words. ${brandLine} ${vocabLine}`;
      userPrompt = `Current opening transcript:
"""${opening}"""

Give me 3 alternative spoken hooks the creator could re-record.`;
      tool = {
        type: "function",
        function: {
          name: "return_hooks",
          description: "Return 3 hook rewrites.",
          parameters: {
            type: "object",
            properties: {
              hooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    spoken: { type: "string", description: "What the creator says out loud." },
                    onScreen: { type: "string", description: "Optional bold on-screen overlay text (under 6 words)." },
                    why: { type: "string" },
                  },
                  required: ["spoken", "why"],
                  additionalProperties: false,
                },
                minItems: 3,
                maxItems: 3,
              },
            },
            required: ["hooks"],
            additionalProperties: false,
          },
        },
      };
    } else if (task === "clean_captions") {
      const { transcript } = body;
      systemPrompt = `You are a caption editor. Strip filler words ("um", "uh", "like", "you know", "so", "basically", "actually", "literally") and obvious throat-clears. Preserve meaning, voice, and brand-name spelling. Return cleaned plain text. ${brandLine} ${vocabLine}`;
      userPrompt = `Clean this transcript:
"""${typeof transcript === 'string' ? transcript : JSON.stringify(transcript)}"""`;
      tool = {
        type: "function",
        function: {
          name: "return_clean",
          description: "Return the cleaned transcript and a list of removed segments.",
          parameters: {
            type: "object",
            properties: {
              cleaned: { type: "string" },
              removedCount: { type: "number" },
              notes: { type: "string" },
            },
            required: ["cleaned", "removedCount"],
            additionalProperties: false,
          },
        },
      };
    } else if (task === "generate_metadata") {
      const { transcript, platform } = body;
      systemPrompt = `You are a social media editor. Produce a title (under 70 chars), a description (1-2 short paragraphs), and 6-10 relevant hashtags. Tone: confident, specific, no clickbait emojis. ${brandLine} ${vocabLine}`;
      userPrompt = `Platform: ${platform || 'short-form vertical (TikTok / Reels / Shorts)'}.
Transcript / script:
"""${typeof transcript === 'string' ? transcript : JSON.stringify(transcript || '')}"""`;
      tool = {
        type: "function",
        function: {
          name: "return_metadata",
          description: "Return title, description, hashtags.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } },
            },
            required: ["title", "description", "hashtags"],
            additionalProperties: false,
          },
        },
      };
    } else {
      return new Response(JSON.stringify({ error: `Unknown task "${task}"` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await callGateway({
      model: SUPPORT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    });

    const result = extractToolArgs(data);
    if (!result) {
      return new Response(JSON.stringify({ error: "Model returned no structured output" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ task, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("chatcut-support error:", e);
    const msg = e?.message || "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
