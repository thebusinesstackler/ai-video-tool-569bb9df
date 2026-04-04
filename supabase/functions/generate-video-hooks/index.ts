import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callLovableAI(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable AI error:", response.status, errText);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, videoTitle, videoDescription, transcript, contextSettings, hookToRefine, refineInstruction } = await req.json();

    const ctx = contextSettings || {};
    const contextBlock = [
      ctx.platform && `Platform: ${ctx.platform}`,
      ctx.targetAudience && `Target Audience: ${ctx.targetAudience}`,
      ctx.videoGoal && `Video Goal: ${ctx.videoGoal}`,
      ctx.niche && `Niche: ${ctx.niche}`,
      ctx.toneOfVoice && `Tone of Voice: ${ctx.toneOfVoice}`,
      ctx.ctaGoal && `CTA Goal: ${ctx.ctaGoal}`,
      ctx.videoType && `Video Type: ${ctx.videoType}`,
      ctx.brandVoice && `Brand Voice: ${ctx.brandVoice}`,
      ctx.offer && `Offer: ${ctx.offer}`,
      ctx.contentMode && `Content Mode: ${ctx.contentMode}`,
    ].filter(Boolean).join("\n");

    if (action === "analyze") {
      const prompt = `You are an elite video performance analyst. Analyze the following video content.

VIDEO TITLE: ${videoTitle || "Untitled"}
VIDEO DESCRIPTION / TRANSCRIPT:
${videoDescription || transcript || "No content provided"}

${contextBlock ? `CONTEXT:\n${contextBlock}` : ""}

Produce a JSON object with these fields:
{
  "mainTopic": "...", "keyPromise": "...", "problemBeingSolved": "...", "emotionalTone": "...",
  "strongestClaims": ["..."], "ctaIntent": "...", "bestAudienceAngle": "...", "likelyUseCase": "...",
  "pacing": "fast|medium|slow", "contentType": "ad|educational|testimonial|promo|founder|product-demo|social|ugc",
  "keyInsights": ["..."]
}
Return ONLY valid JSON, no markdown fences.`;

      const result = await callLovableAI(prompt);
      let summary;
      try {
        const cleaned = result.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        summary = JSON.parse(cleaned);
      } catch {
        summary = { mainTopic: result, keyPromise: "", problemBeingSolved: "", emotionalTone: "neutral", strongestClaims: [], ctaIntent: "", bestAudienceAngle: "", likelyUseCase: "social", pacing: "medium", contentType: "social", keyInsights: [] };
      }
      return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate") {
      const summary = ctx.contentSummary || {};
      const style = ctx.hookStyle || "balanced";

      const styleInstructions: Record<string, string> = {
        "aggressive": "Be bold, provocative, and attention-grabbing.",
        "professional": "Be polished, authoritative, and credible.",
        "emotional": "Lead with feelings, empathy, and human connection.",
        "high-converting": "Focus on benefits, urgency, and clear value propositions.",
        "natural": "Be conversational and authentic.",
        "luxury": "Be refined, aspirational, and exclusive.",
        "ugc": "Be raw, relatable, and unscripted-feeling.",
        "corporate": "Be measured, trustworthy, and results-oriented.",
        "viral": "Be unexpected, shareable, and pattern-interrupting.",
        "direct-response": "Hard-hitting benefit-first hooks.",
        "balanced": "A mix of styles optimized for the specific video content.",
      };

      const prompt = `You are the world's best video hook strategist.

VIDEO ANALYSIS: ${JSON.stringify(summary, null, 2)}
VIDEO TITLE: ${videoTitle || "Untitled"}
VIDEO TRANSCRIPT/DESCRIPTION: ${videoDescription || transcript || "N/A"}
${contextBlock ? `CONTEXT:\n${contextBlock}` : ""}

STYLE DIRECTION: ${style}
${styleInstructions[style] || styleInstructions["balanced"]}

Generate exactly 8 unique, high-performing video hooks for the first 5 seconds. Use DIFFERENT hook frameworks.

Each hook object must have: hookText, hookType (one of: curiosity, shocking, problem-solution, pain-point, transformation, social-proof, fomo, direct-benefit, contrarian, emotional-story, urgency, authority, question, list-style, myth-busting, educational), whyChosen, bestPlatform, onScreenText, voiceoverVersion, visualDirection, scores (object with scrollStop, clarity, emotionalPull, conversionIntent, curiosity, adSuitability, organicSuitability as numbers 1-10), bestFor (array of strings).

Return ONLY a valid JSON array, no markdown fences.`;

      const result = await callLovableAI(prompt);
      let hooks;
      try {
        const cleaned = result.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        hooks = JSON.parse(cleaned);
      } catch { hooks = []; }
      return new Response(JSON.stringify({ hooks }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "refine") {
      const prompt = `You are a video hook optimization expert.

ORIGINAL HOOK: ${JSON.stringify(hookToRefine, null, 2)}
INSTRUCTION: ${refineInstruction}
VIDEO CONTEXT: Title: ${videoTitle || "Untitled"}
${contextBlock ? `\n${contextBlock}` : ""}

Rewrite this hook following the instruction. Return a single JSON object with the same structure (hookText, hookType, whyChosen, bestPlatform, onScreenText, voiceoverVersion, visualDirection, scores, bestFor). Return ONLY valid JSON, no markdown fences.`;

      const result = await callLovableAI(prompt);
      let refined;
      try {
        const cleaned = result.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        refined = JSON.parse(cleaned);
      } catch { refined = hookToRefine; }
      return new Response(JSON.stringify({ hook: refined }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-video-hooks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
