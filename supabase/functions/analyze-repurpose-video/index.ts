const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { callClaude } from "../_shared/claude.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, videoUrl, platform, analysis, additionalNotes } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze") {
      const systemPrompt = `You are an elite video content strategist and creative director. You analyze viral video content to reverse-engineer why it performs well.

Given a video URL or description, provide a comprehensive breakdown in STRICT JSON format. Your analysis must cover:
- Hook (text, type, strength rating)
- Core messaging (topic, key promise, emotional angle)  
- Script structure (sections with names, durations, purposes)
- Scene sequence (each scene with description, visual style, duration)
- Pacing (overall, hook speed, build-up, climax)
- Visual style (aesthetic, color palette, transitions)
- Captions (style, placement, animation)
- CTA (text, type, placement)
- Creative direction (list of reasons why it works, winning formula summary)
- Overall performance score (0-100)

Be specific and actionable. This analysis will be used to create a repurposed version.`;

      const userPrompt = `Analyze this video for repurposing. Target platform: ${platform || "TikTok"}.

Video URL: ${videoUrl}

Respond ONLY with valid JSON in this exact shape:
{
  "analysis": {
    "hook": { "text": "...", "type": "curiosity|controversy|story|shock|question", "strength": "weak|moderate|strong|viral" },
    "messaging": { "coreTopic": "...", "keyPromise": "...", "emotionalAngle": "..." },
    "scriptStructure": { "sections": [{ "name": "...", "duration": "...", "purpose": "..." }] },
    "sceneSequence": { "scenes": [{ "description": "...", "visualStyle": "...", "duration": "..." }] },
    "pacing": { "overall": "...", "hookSpeed": "...", "buildUp": "...", "climax": "..." },
    "visualStyle": { "aesthetic": "...", "colorPalette": "...", "transitions": "..." },
    "captions": { "style": "...", "placement": "...", "animation": "..." },
    "cta": { "text": "...", "type": "...", "placement": "..." },
    "creativeDirection": { "whyItWorks": ["..."], "winningFormula": "..." },
    "overallScore": 85
  }
}`;

      const result = await callClaude(systemPrompt, userPrompt, { thinkingBudget: 8000 });

      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch?.[0] || result);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse analysis" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "repurpose") {
      if (!analysis) {
        return new Response(JSON.stringify({ error: "analysis is required for repurpose" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `You are an elite AI Video Director who specializes in repurposing winning video content. Given the full analysis of a successful video, you create a NEW script that:

1. Preserves the winning formula (hook psychology, pacing rhythm, emotional arc)
2. Refreshes ALL visuals with new b-roll directions
3. Tightens the pacing and improves scene flow
4. Enhances storytelling with better transitions
5. Makes the output feel like a STRONGER, UPDATED version — NOT a duplicate
6. Optimizes for the target platform

The repurposed script must be production-ready with clear narration and visual directions.`;

      const userPrompt = `Repurpose this video for ${platform || "TikTok"}.

ORIGINAL VIDEO ANALYSIS:
${JSON.stringify(analysis, null, 2)}

${additionalNotes ? `USER NOTES: ${additionalNotes}` : ""}

Create a repurposed script. Respond ONLY with valid JSON:
{
  "script": {
    "title": "...",
    "scenes": [
      {
        "sceneNumber": 1,
        "narration": "Exact words to say",
        "visualDirection": "Detailed b-roll/visual description for AI generation",
        "duration": "3s",
        "improvement": "What's better vs original"
      }
    ],
    "improvements": ["Tighter hook", "Better pacing", "Stronger CTA", ...],
    "estimatedDuration": "30s"
  }
}`;

      const result = await callClaude(systemPrompt, userPrompt, { thinkingBudget: 10000 });

      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch?.[0] || result);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse repurposed script" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
