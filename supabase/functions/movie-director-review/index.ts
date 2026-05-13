// Movie Director Review — 39-year veteran film director persona.
// Routes through Lovable AI Gateway (Gemini 2.5 Pro for vision + reasoning).
// Audits the full storyboard (Story Bible + every scene's start/end frames + dialogue) BEFORE video render.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PRIMARY_MODEL = "google/gemini-2.5-pro";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

interface SceneInput {
  sceneNumber: number;
  title?: string;
  location?: string;
  timeOfDay?: string;
  description?: string;
  mood?: string;
  charactersInScene?: string[];
  dialogue?: any;
  cameraAngle?: string;
  transitionAction?: string;
  startFrameUrl?: string | null;
  endFrameUrl?: string | null;
}

interface ReviewBody {
  storyBible?: any;
  scenes: SceneInput[];
  movieIdea?: string;
  movieLength?: string;
}

const SYSTEM_PROMPT = `You are a 39-year veteran film director — Spielberg / Villeneuve / Fincher pedigree.
You are auditing this AI-generated storyboard BEFORE the studio commits money to video generation.
Your job: make this feel like a real film, not AI slop.
Be ruthless about continuity (wardrobe, props, time-of-day, location), character casting consistency across frames,
emotional arc, pacing, and whether each frame earns its place.
Suggest concrete fixes the team can apply in one click — never vague notes.

Return ONLY a single valid JSON object matching this exact shape (no markdown, no preamble):
{
  "overallVerdict": "ship" | "revise" | "block",
  "overallScore": 1-10,
  "storyNotes": "2-4 sentences on pacing, theme cohesion, emotional arc",
  "continuityIssues": [{ "sceneNumber": number, "issue": "...", "fix": "..." }],
  "castingNotes": [{ "characterName": "...", "issue": "...", "fix": "..." }],
  "sceneNotes": [
    {
      "sceneNumber": number,
      "score": 1-10,
      "strengthens": "what works",
      "weakens": "what doesn't",
      "recommendedKeyframeRewrite": { "startFrame": "new prompt or null", "endFrame": "new prompt or null" },
      "recommendedDialogueRewrite": "new dialogue line or null",
      "recommendedCameraMove": "e.g. slow push-in on eyes or null",
      "recommendedTransitionToNext": "match-cut idea or null"
    }
  ],
  "finalShootingOrder": [scene numbers in your recommended order, or null if same as input]
}`;

function buildUserContent(body: ReviewBody): any[] {
  // OpenAI-compatible multimodal: array of { type: "text" | "image_url" } parts
  const content: any[] = [];

  const header = [
    body.movieIdea ? `MOVIE IDEA:\n${body.movieIdea}` : "",
    body.movieLength ? `FORMAT: ${body.movieLength}` : "",
    body.storyBible ? `STORY BIBLE:\n${JSON.stringify(body.storyBible, null, 2)}` : "",
    `\nReview every scene below. Each scene includes its start frame and end frame images when available.
Return the JSON now.`,
  ].filter(Boolean).join("\n\n");

  content.push({ type: "text", text: header });

  for (const s of body.scenes) {
    const dialogueText = typeof s.dialogue === "string"
      ? s.dialogue
      : Array.isArray(s.dialogue)
        ? s.dialogue.map((d: any) => `${d.character}: ${d.line}`).join(" | ")
        : "";

    const sceneText = [
      `--- SCENE ${s.sceneNumber}${s.title ? `: ${s.title}` : ""} ---`,
      s.location ? `Location: ${s.location}` : "",
      s.timeOfDay ? `Time: ${s.timeOfDay}` : "",
      s.mood ? `Mood: ${s.mood}` : "",
      s.cameraAngle ? `Camera: ${s.cameraAngle}` : "",
      s.charactersInScene?.length ? `Characters: ${s.charactersInScene.join(", ")}` : "",
      s.description ? `Action: ${s.description}` : "",
      dialogueText ? `Dialogue: ${dialogueText}` : "",
      s.transitionAction ? `Transition out: ${s.transitionAction}` : "",
    ].filter(Boolean).join("\n");

    content.push({ type: "text", text: sceneText });

    if (s.startFrameUrl) {
      content.push({ type: "image_url", image_url: { url: s.startFrameUrl } });
      content.push({ type: "text", text: `↑ Scene ${s.sceneNumber} START frame` });
    }
    if (s.endFrameUrl) {
      content.push({ type: "image_url", image_url: { url: s.endFrameUrl } });
      content.push({ type: "text", text: `↑ Scene ${s.sceneNumber} END frame` });
    }
  }

  return content;
}

async function callGateway(model: string, body: ReviewBody) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserContent(body) },
      ],
      response_format: { type: "json_object" },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReviewBody;
    if (!body || !Array.isArray(body.scenes) || body.scenes.length === 0) {
      return new Response(JSON.stringify({ error: "scenes[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap at 30 scenes to keep tokens reasonable
    const trimmed: ReviewBody = { ...body, scenes: body.scenes.slice(0, 30) };

    let res = await callGateway(PRIMARY_MODEL, trimmed);
    if (!res.ok && [402, 403, 404, 429, 500, 502, 503].includes(res.status)) {
      console.warn(`[director-review] ${PRIMARY_MODEL} returned ${res.status}, falling back to ${FALLBACK_MODEL}`);
      res = await callGateway(FALLBACK_MODEL, trimmed);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[director-review] Gateway error", res.status, errText);
      const userMsg = res.status === 402
        ? "AI credits exhausted. Add funds in Settings → Workspace → Usage."
        : res.status === 429
          ? "Rate limit reached. Try again in a moment."
          : "Director review failed";
      return new Response(JSON.stringify({ error: userMsg, detail: errText }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    let review: any = null;
    try {
      review = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { review = JSON.parse(m[0]); } catch { /* noop */ } }
    }
    if (!review) {
      return new Response(JSON.stringify({ error: "Director returned malformed JSON", raw: raw.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ review }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[director-review] unexpected", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
