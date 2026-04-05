const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callLovableAI(system: string, userContent: any[]): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch(LOVABLE_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lovable AI error:", response.status, errText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, videoUrl, platform, analysis, additionalNotes, frames, transcript } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze") {
      const hasFrames = frames && Array.isArray(frames) && frames.length > 0;
      const hasTranscript = transcript && transcript.length > 10;

      const systemPrompt = `You are an elite video content strategist and creative director. You analyze viral video content to reverse-engineer why it performs well.

You will be provided with ${hasFrames ? 'actual video frames extracted from the video' : 'a video URL'} ${hasTranscript ? 'AND the full audio transcript from speech-to-text' : ''}.

Analyze EVERYTHING you can see and hear. Be specific about what's actually shown and said — do NOT guess or hallucinate content. Use the transcript for exact quotes.

Provide a comprehensive breakdown in STRICT JSON format covering:
- Hook (exact text from transcript if available, type, strength rating)
- Core messaging (topic, key promise, emotional angle)  
- Script structure (sections with names, durations, purposes)
- Scene sequence (each scene with description based on actual frames, visual style, duration)
- Pacing (overall, hook speed, build-up, climax)
- Visual style (aesthetic, color palette, transitions — based on actual frames)
- Captions (style, placement, animation)
- CTA (text, type, placement)
- Creative direction (list of reasons why it works, winning formula summary)
- Overall performance score (0-100)

Be specific and actionable. This analysis will be used to create a repurposed version.`;

      // Build multimodal content array
      const contentParts: any[] = [];

      // Add transcript info
      if (hasTranscript) {
        contentParts.push({
          type: "text",
          text: `📝 AUDIO TRANSCRIPT (from speech-to-text):\n"${transcript}"\n\nUse the exact words from this transcript in your analysis. Do NOT guess what's being said.`,
        });
      } else {
        contentParts.push({
          type: "text",
          text: "⚠️ No audio transcript available. Analyze based on visual frames only.",
        });
      }

      // Add frames as images
      if (hasFrames) {
        contentParts.push({
          type: "text",
          text: `\n🎬 ${frames.length} KEY FRAMES extracted from the video (in chronological order):`,
        });
        for (const frame of frames) {
          contentParts.push({
            type: "image_url",
            image_url: { url: frame },
          });
        }
      }

      contentParts.push({
        type: "text",
        text: `\nTarget platform: ${platform || "TikTok"}.\nVideo URL: ${videoUrl || "uploaded file"}\n\nRespond ONLY with valid JSON in this exact shape:
{
  "analysis": {
    "hook": { "text": "exact words from transcript", "type": "curiosity|controversy|story|shock|question", "strength": "weak|moderate|strong|viral" },
    "messaging": { "coreTopic": "...", "keyPromise": "...", "emotionalAngle": "..." },
    "scriptStructure": { "sections": [{ "name": "...", "duration": "...", "purpose": "..." }] },
    "sceneSequence": { "scenes": [{ "description": "what's actually shown in the frames", "visualStyle": "...", "duration": "..." }] },
    "pacing": { "overall": "...", "hookSpeed": "...", "buildUp": "...", "climax": "..." },
    "visualStyle": { "aesthetic": "...", "colorPalette": "...", "transitions": "..." },
    "captions": { "style": "...", "placement": "...", "animation": "..." },
    "cta": { "text": "...", "type": "...", "placement": "..." },
    "creativeDirection": { "whyItWorks": ["..."], "winningFormula": "..." },
    "overallScore": 85
  }
}`,
      });

      const result = await callLovableAI(systemPrompt, contentParts);

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

      const userContent = [{
        type: "text",
        text: `Repurpose this video for ${platform || "TikTok"}.

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
}`,
      }];

      const result = await callLovableAI(systemPrompt, userContent);

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
