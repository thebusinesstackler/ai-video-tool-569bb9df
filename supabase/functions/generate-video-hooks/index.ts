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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const {
      action,
      videoTitle,
      videoDescription,
      transcript,
      contextSettings,
      existingHooks,
      hookToRefine,
      refineInstruction,
    } = await req.json();

    // Build context from settings
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
    ]
      .filter(Boolean)
      .join("\n");

    if (action === "analyze") {
      // Step 1: Analyze the video content
      const analysisPrompt = `You are an elite video performance analyst. Analyze the following video content and produce a comprehensive content summary.

VIDEO TITLE: ${videoTitle || "Untitled"}
VIDEO DESCRIPTION / TRANSCRIPT:
${videoDescription || transcript || "No content provided"}

${contextBlock ? `CONTEXT:\n${contextBlock}` : ""}

Produce a JSON object with these fields:
{
  "mainTopic": "...",
  "keyPromise": "...",
  "problemBeingSolved": "...",
  "emotionalTone": "...",
  "strongestClaims": ["..."],
  "ctaIntent": "...",
  "bestAudienceAngle": "...",
  "likelyUseCase": "...",
  "pacing": "fast|medium|slow",
  "contentType": "ad|educational|testimonial|promo|founder|product-demo|social|ugc",
  "keyInsights": ["..."]
}

Return ONLY valid JSON, no markdown.`;

      const analysisRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.4,
          }),
        }
      );

      if (!analysisRes.ok) {
        const status = analysisRes.status;
        const text = await analysisRes.text();
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status} ${text}`);
      }

      const analysisData = await analysisRes.json();
      const rawContent = analysisData.choices?.[0]?.message?.content || "{}";
      let summary;
      try {
        const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        summary = JSON.parse(cleaned);
      } catch {
        summary = { mainTopic: rawContent, keyPromise: "", problemBeingSolved: "", emotionalTone: "neutral", strongestClaims: [], ctaIntent: "", bestAudienceAngle: "", likelyUseCase: "social", pacing: "medium", contentType: "social", keyInsights: [] };
      }

      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      // Step 2: Generate hooks based on analysis
      const summary = contextSettings?.contentSummary || {};
      const style = contextSettings?.hookStyle || "balanced";

      const styleInstructions: Record<string, string> = {
        "aggressive": "Be bold, provocative, and attention-grabbing. Use power words. Challenge assumptions.",
        "professional": "Be polished, authoritative, and credible. Use data-driven language.",
        "emotional": "Lead with feelings, empathy, and human connection. Make viewers feel something immediately.",
        "high-converting": "Focus on benefits, urgency, and clear value propositions. Direct response style.",
        "natural": "Be conversational and authentic. Sound like a friend sharing something important.",
        "luxury": "Be refined, aspirational, and exclusive. Premium positioning.",
        "ugc": "Be raw, relatable, and unscripted-feeling. First-person perspective.",
        "corporate": "Be measured, trustworthy, and results-oriented. B2B appropriate.",
        "viral": "Be unexpected, shareable, and pattern-interrupting. Designed for maximum shares.",
        "direct-response": "Hard-hitting benefit-first hooks. Clear problem-solution framing with urgency.",
        "balanced": "A mix of styles optimized for the specific video content and platform.",
      };

      const hookPrompt = `You are the world's best video hook strategist. Your hooks have generated billions of views.

VIDEO ANALYSIS:
${JSON.stringify(summary, null, 2)}

VIDEO TITLE: ${videoTitle || "Untitled"}
VIDEO TRANSCRIPT/DESCRIPTION: ${videoDescription || transcript || "N/A"}

${contextBlock ? `CONTEXT:\n${contextBlock}` : ""}

STYLE DIRECTION: ${style}
${styleInstructions[style] || styleInstructions["balanced"]}

Generate exactly 8 unique, high-performing video hooks for the first 5 seconds.

For each hook, use a DIFFERENT hook framework from this list:
- curiosity: Creates an information gap the viewer must close
- shocking: Disrupts expectations with a bold statement
- problem-solution: Names a pain point the viewer recognizes
- pain-point: Amplifies a frustration the audience feels
- transformation: Shows a before/after or outcome
- social-proof: Leverages numbers, testimonials, or authority
- fomo: Creates fear of missing out on something valuable
- direct-benefit: Leads with the #1 benefit immediately
- contrarian: Challenges conventional wisdom
- emotional-story: Opens with a compelling personal narrative
- urgency: Creates time pressure or scarcity
- authority: Positions the speaker as an expert
- question: Asks a thought-provoking question
- list-style: "3 things...", "5 reasons...", pattern
- myth-busting: "Stop believing this lie..."
- educational: "Most people don't know..."

Return a JSON array of hook objects:
[
  {
    "hookText": "The actual hook script (2-3 sentences max, designed for 5 seconds)",
    "hookType": "one of the framework names above",
    "whyChosen": "1-2 sentence explanation of why this hook fits this video",
    "bestPlatform": "tiktok|instagram|youtube-shorts|facebook|youtube-ads|landing-page",
    "onScreenText": "Short punchy text overlay version (max 8 words)",
    "voiceoverVersion": "Slightly longer spoken version optimized for voiceover",
    "visualDirection": "Brief description of what should be on screen during this hook",
    "scores": {
      "scrollStop": 1-10,
      "clarity": 1-10,
      "emotionalPull": 1-10,
      "conversionIntent": 1-10,
      "curiosity": 1-10,
      "adSuitability": 1-10,
      "organicSuitability": 1-10
    },
    "bestFor": ["attention-grabbing", "conversions", "educational", "ugc", "paid-ads", "founder-led"]
  }
]

CRITICAL RULES:
- Each hook must be DIFFERENT in style, angle, and framework
- Hooks must be specific to THIS video, not generic
- First hook should be the strongest overall performer
- Include at least 2 ad-style hooks and 2 organic-style hooks
- Voiceover versions should sound natural when spoken aloud
- On-screen text should be 3-8 words max, punchy
- Scores should be honest and differentiated, not all 8+

Return ONLY valid JSON array, no markdown.`;

      const hookRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: hookPrompt }],
            temperature: 0.8,
          }),
        }
      );

      if (!hookRes.ok) {
        const status = hookRes.status;
        const text = await hookRes.text();
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status} ${text}`);
      }

      const hookData = await hookRes.json();
      const rawHooks = hookData.choices?.[0]?.message?.content || "[]";
      let hooks;
      try {
        const cleaned = rawHooks.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        hooks = JSON.parse(cleaned);
      } catch {
        hooks = [];
      }

      return new Response(JSON.stringify({ hooks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refine") {
      const refinePrompt = `You are a video hook optimization expert.

ORIGINAL HOOK:
${JSON.stringify(hookToRefine, null, 2)}

INSTRUCTION: ${refineInstruction}

VIDEO CONTEXT:
Title: ${videoTitle || "Untitled"}
${contextBlock ? `\n${contextBlock}` : ""}

Rewrite this hook according to the instruction. Return a single JSON object with the same structure as the input hook, but with improved content.

Return ONLY valid JSON, no markdown.`;

      const refineRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: refinePrompt }],
            temperature: 0.7,
          }),
        }
      );

      if (!refineRes.ok) {
        const status = refineRes.status;
        await refineRes.text();
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const refineData = await refineRes.json();
      const rawRefine = refineData.choices?.[0]?.message?.content || "{}";
      let refined;
      try {
        const cleaned = rawRefine.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        refined = JSON.parse(cleaned);
      } catch {
        refined = hookToRefine;
      }

      return new Response(JSON.stringify({ hook: refined }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-video-hooks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
