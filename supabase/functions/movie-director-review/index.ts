// Movie Director Review — Claude Sonnet 4.5 acting as a 39-year veteran film director.
// Audits the full storyboard (Story Bible + every scene's start/end frames + dialogue) BEFORE video render,
// returning structured notes the UI can apply with one click.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const PRIMARY_MODEL = "claude-sonnet-4-5-20250929";
const FALLBACK_MODEL = "claude-3-5-sonnet-20241022";

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
      content.push({ type: "image", source: { type: "url", url: s.startFrameUrl }, });
      content.push({ type: "text", text: `↑ Scene ${s.sceneNumber} START frame` });
    }
    if (s.endFrameUrl) {
      content.push({ type: "image", source: { type: "url", url: s.endFrameUrl } });
      content.push({ type: "text", text: `↑ Scene ${s.sceneNumber} END frame` });
    }
  }

  return content;
}

async function callClaude(model: string, body: ReviewBody) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(body) }],
    }),
  });
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReviewBody;
    if (!body || !Array.isArray(body.scenes) || body.scenes.length === 0) {
      return new Response(JSON.stringify({ error: "scenes[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap at 30 scenes worth of images to keep tokens reasonable
    const trimmed: ReviewBody = {
      ...body,
      scenes: body.scenes.slice(0, 30),
    };

    let res = await callClaude(PRIMARY_MODEL, trimmed);
    if (!res.ok && [402, 403, 404, 429].includes(res.status)) {
      console.warn(`[director-review] ${PRIMARY_MODEL} returned ${res.status}, falling back`);
      res = await callClaude(FALLBACK_MODEL, trimmed);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[director-review] Anthropic error", res.status, errText);
      return new Response(JSON.stringify({ error: "Director review failed", detail: errText }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw = data?.content?.[0]?.text || "";
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
