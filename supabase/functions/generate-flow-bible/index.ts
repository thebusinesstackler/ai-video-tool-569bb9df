// Generate Flow Bible: takes a script + N shots, returns a shared character/setting bible
// + per-shot {prompt, dialogue} for Google Veo 3 multi-shot Flow Mode in Video Repo Pro.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface FlowShot {
  shotNumber: number;
  prompt: string;   // full Veo 3 prompt for this 8s shot
  dialogue: string; // the spoken line that goes inside the Veo 3 prompt
}

interface FlowPlan {
  bible: {
    character: string;
    wardrobe: string;
    setting: string;
    lighting: string;
    voiceTone: string;
    audioStyle: string;
  };
  shots: FlowShot[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const script: string = String(body.script || "").trim();
    const shotCountRaw = Number(body.shotCount);
    const shotCount = Math.max(2, Math.min(6, Number.isFinite(shotCountRaw) ? Math.round(shotCountRaw) : 3));
    const aspectRatio: string = body.aspectRatio === "16:9" ? "16:9" : "9:16";
    const referenceContext: string = String(body.referenceContext || "").slice(0, 4000);

    if (!script || script.length < 10) {
      return new Response(JSON.stringify({ error: "script is required (min 10 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalSeconds = shotCount * 8;
    const wordsPerShot = 20; // ~2.5 wps × 8s

    const systemPrompt = `You are a senior commercial director writing a multi-shot Google Veo 3 "Flow" plan.

OUTPUT: ${shotCount} sequential 8-second Veo 3 shots that flow together as ONE continuous ${totalSeconds}-second ad in ${aspectRatio} format. Veo 3 generates each shot independently with its own native synchronized audio + lip-synced dialogue, so consistency between shots depends entirely on the shared "Bible".

YOU MUST RETURN VALID JSON matching this exact shape (no markdown, no preamble):
{
  "bible": {
    "character": "1-2 sentences: who appears in EVERY shot — age, ethnicity, body type, hair, distinguishing features, vibe",
    "wardrobe": "1 sentence: exact outfit (top, bottom, accessories) worn in every shot",
    "setting": "1 sentence: location + key props that recur across shots",
    "lighting": "1 sentence: lighting recipe (e.g. bright natural daylight from camera-left, soft window bounce)",
    "voiceTone": "1 short phrase describing the speaker's voice (e.g. warm female 30s, conversational, intimate)",
    "audioStyle": "1 short phrase for ambient sound (e.g. soft room tone + subtle warm background music)"
  },
  "shots": [
    {
      "shotNumber": 1,
      "prompt": "FULL 90-160 word Veo 3 prompt for shot 1. Must include: SHOT (subject, framing, lens, lighting), ACTION (what subject does in 8s), DIALOGUE line written EXACTLY as 'The [character] says: \\"...\\"' (max ${wordsPerShot} words, complete sentence), AUDIO line, and ENDING (final-frame description so the cut lands cleanly). Re-state wardrobe + setting from the Bible so Veo 3 keeps consistency.",
      "dialogue": "the exact spoken line, max ${wordsPerShot} words, complete self-contained sentence"
    }
    // ... shotCount total shots
  ]
}

HARD RULES:
- Exactly ${shotCount} shots, each numbered 1..${shotCount}
- Each shot's dialogue is ONE complete sentence (≤ ${wordsPerShot} words). No trailing prepositions/articles.
- Together the ${shotCount} dialogue lines must read as a single coherent ad: Hook → Problem/Insight → Product Reveal → Benefit → CTA (compress as needed for shot count).
- Every shot's prompt restates the same character + wardrobe + setting + lighting from the Bible (so Veo 3 doesn't drift).
- No "[TEXT FREEZE]", no scene numbers in the prompt body, no "Subtitles:" / "Caption:" instructions.
- Aspect ratio: ${aspectRatio}. Mention vertical/handheld feel for 9:16, cinematic landscape feel for 16:9.
- Plain cinematic English. Veo 3 dislikes camera-jargon overload.

Return ONLY the JSON object. No markdown fences, no commentary.`;

    const userPrompt = `SCRIPT TO BREAK INTO ${shotCount} VEO 3 SHOTS:
${script}

${referenceContext ? `REFERENCE CONTEXT (style, brand, product details to honor):\n${referenceContext}\n` : ""}
Generate the JSON now.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[generate-flow-bible] AI gateway error", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Lovable AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "";

    let plan: FlowPlan | null = null;
    try {
      plan = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      if (match) {
        try { plan = JSON.parse(match[0]); } catch { plan = null; }
      }
    }

    if (!plan || !plan.bible || !Array.isArray(plan.shots) || plan.shots.length === 0) {
      console.error("[generate-flow-bible] failed to parse plan from AI:", raw?.slice?.(0, 500));
      return new Response(JSON.stringify({ error: "AI returned malformed plan" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize shot numbers + clamp count
    plan.shots = plan.shots.slice(0, shotCount).map((s, i) => ({
      shotNumber: i + 1,
      prompt: String(s.prompt || "").trim(),
      dialogue: String(s.dialogue || "").trim(),
    }));

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-flow-bible] unexpected error", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
