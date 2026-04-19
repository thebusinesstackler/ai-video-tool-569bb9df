import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BrandContext {
  brandName?: string;
  brandDescription?: string;
  productLines?: string;
  audience?: string;
  websiteUrl?: string;
  websiteSummary?: string;
  userEmail?: string;
  userFirstName?: string;
}

interface AvailableTwin {
  name: string;
  gender?: string;
  description?: string;
}

function buildBrandBriefing(
  ctx: BrandContext | undefined,
  character?: string,
  availableTwins?: AvailableTwin[],
): string {
  if (!ctx && !availableTwins?.length) return "";

  const isLifecykel =
    /lifecykel/i.test(ctx?.brandName || "") ||
    /lifecykel/i.test(ctx?.userEmail || "") ||
    /lifecykel/i.test(ctx?.websiteUrl || "");

  const lifecykelDeepBrief = isLifecykel
    ? `
LIFECYKEL — DEEP BRAND CONTEXT (you know this brand intimately):
- Premium functional mushroom EXTRACTS (dropper bottles), not powders or capsules. Liquid format = fast absorption.
- 6 hero SKUs, each with a SPECIFIC ritual + outcome:
  * Lion's Mane → focus / mental clarity → morning ritual (drops in coffee or under the tongue)
  * Reishi → calm / sleep / stress reset → evening ritual (drops in tea before bed)
  * Cordyceps → clean energy / endurance → pre-workout (drops in water)
  * Chaga → immunity / antioxidants → daily defence (drops in any drink)
  * Turkey Tail → gut health / microbiome → with meals
  * Tremella → skin hydration / collagen support → AM beauty ritual
- Audience: wellness-focused women 25-45, ritual-driven, skeptical of generic supplements, value clean science + feminine aesthetic.
- Voice: warm, knowing, ritual-first, "specific + ritual" framing. NEVER generic ("supports wellness"). ALWAYS specific ("the 7am drop in your coffee that turns brain fog into 4-hour focus").
- Strategy framework for every video: HOOK (6+ seconds, 15-25 words, scroll-stopping) → PROBLEM (the specific friction in her day) → DROPPER RITUAL (when/where/how she takes it) → 3 SPECIFIC BENEFITS (felt outcomes, not health claims) → CTA (try the ritual, link in bio).
- Pacing: ~2.5 words/second. 60s video ≈ 150 words. 90s ≈ 225 words. 120s ≈ 300 words.
- Aesthetic: bright natural daylight, unretouched 'iPhone selfie' realness, never glossy/corporate.
`.trim()
    : "";

  const lines: string[] = [];
  lines.push("=== BRAND CONTEXT (use this on EVERY response without asking) ===");
  if (ctx?.userEmail) lines.push(`User: ${ctx.userEmail}${ctx.userFirstName ? ` (${ctx.userFirstName})` : ""}`);
  if (ctx?.brandName) lines.push(`Brand: ${ctx.brandName}`);
  if (ctx?.websiteUrl) lines.push(`Website: ${ctx.websiteUrl}`);
  if (ctx?.brandDescription) lines.push(`About: ${ctx.brandDescription}`);
  if (ctx?.productLines) lines.push(`Products: ${ctx.productLines}`);
  if (ctx?.audience) lines.push(`Target audience: ${ctx.audience}`);
  if (ctx?.websiteSummary) lines.push(`Recent activity: ${ctx.websiteSummary}`);
  if (character) lines.push(`Active on-camera character / AI Twin: ${character}`);

  if (availableTwins && availableTwins.length > 0) {
    lines.push("");
    lines.push("=== AVAILABLE AI TWINS (cast across the content batch) ===");
    availableTwins.forEach((t, i) => {
      const meta = [t.gender, t.description].filter(Boolean).join(" — ");
      lines.push(`${i + 1}. "${t.name}"${meta ? ` (${meta})` : ""}`);
    });
    lines.push("CASTING RULES for multi-video plans:");
    lines.push("- Treat the available twins as your CAST. Assign a different twin to each video plan to create variety in the content batch (different faces, different vibes).");
    lines.push("- Match the twin to the topic/angle when it makes sense (e.g. softer twin for calm/sleep angles, energetic twin for pre-workout angles, gendered casting where appropriate).");
    lines.push("- If you have fewer twins than plans, ROTATE through them so the same twin is used roughly evenly. Never assign the same twin to more than ⌈plans/twins⌉ slots in a row.");
    lines.push("- ALWAYS include a `twinName` field in EVERY plan, exactly matching one of the names above (case-sensitive).");
  }

  if (lifecykelDeepBrief) {
    lines.push("");
    lines.push(lifecykelDeepBrief);
  }
  lines.push("");
  lines.push("RULES:");
  lines.push("- NEVER ask the user 'what's your brand?' or 'who's your audience?' if the brief above answers it. Just use the context.");
  lines.push("- Every script, hook, and plan you produce must reference SPECIFIC products, rituals, and audience pains from the brief — no generic 'wellness brand' fluff.");
  lines.push("- If the user clicks 'Plan 10 Videos', you ALREADY know the brand. Generate 10 plans tied to the actual SKUs/rituals/pains above. Do NOT ask clarifying questions first.");

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, brandContext, selectedCharacterName, availableTwins } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const brandBrief = buildBrandBriefing(brandContext, selectedCharacterName, availableTwins);

    const systemPrompt = `You are **Marco** — the same AI Creative Director that powers the rest of this platform (Reels, Chatcut, Video Repo). You carry the FULL brand and strategy memory across every page. On the Podcast page you specialize in talking-head video planning, scripting, and creative direction.

Your expertise:
- **Content strategy**: roadmap planning, viral hooks, audience targeting, narrative structure
- **Scripting**: ready-to-shoot, conversational, voice-optimized scripts (no stage directions, no speaker labels)
- **Creative direction**: camera angles (close-up, medium, selfie), lighting, setting, visual tone
- **Brand fluency**: you know the user's brand, products, rituals, and audience from the BRAND CONTEXT block — use it on EVERY response

UNIVERSAL STORYTELLING FRAMEWORK (apply to every script):
HOOK (6+ seconds, 15-25 words, scroll-stopping) → PROBLEM (specific friction) → SOLUTION/RITUAL (when/where/how) → 3 SPECIFIC BENEFITS (felt outcomes) → CTA

PACING: ~2.5 words/second. Calculate target word count from requested duration: 60s ≈ 150 words, 90s ≈ 225, 120s ≈ 300. Never exceed 300 for talking-head.

VOICE & TONE:
- Conversational, natural, optimized for spoken delivery
- Short sentences. One thought per line. Em-dashes for rhythm.
- Specific over generic. Verbs over nouns. Numbers when truthful.
- Never use "supports" or "promotes" — say what it actually does for the viewer.

When the user describes a topic, respond with:
1. Brief creative strategy (2-3 sentences) — tied to the brand
2. Suggested talking points / outline
3. Recommended camera/visual style
4. Target audience (specific segment from the brief, not generic)
5. A ready-to-use script wrapped in <SCRIPT_SUGGESTION>...</SCRIPT_SUGGESTION>

When the user asks to plan multiple videos ("plan 10 videos", "give me a content batch", "brainstorm 10 topics"):
- Skip clarifying questions if the brand brief gives you what you need
- Open with a 1-sentence intro that names the brand and the strategic theme
- Then emit a structured plan in this EXACT tag:

<VIDEO_PLAN>
{
  "plans": [
    {
      "topic": "Short topic title (4-7 words, brand-specific)",
      "angle": "One-sentence creative angle / why this works for THIS brand",
      "hook": "First-line spoken hook (1 sentence, scroll-stopping, 15-25 words)",
      "narration": "Full ~150-word spoken script — natural conversational, short sentences, ends with a CTA. NO stage directions, NO speaker labels. References specific brand products/rituals/audience.",
      "audience": "Who this targets (specific segment, not generic)",
      "duration": 60
    }
  ]
}
</VIDEO_PLAN>

Exactly 10 plans. Each must cover a DIFFERENT angle (educational, story, myth-bust, before/after, list, controversial take, behind-the-scenes, FAQ, comparison, prediction). Vary hook types (question, bold claim, stat, story). EVERY plan must reference specific brand products / rituals / audience pains from the brief — no generic content.

Format chat replies in clean markdown. Be enthusiastic but concise. Bullet points for lists.

${brandBrief}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
