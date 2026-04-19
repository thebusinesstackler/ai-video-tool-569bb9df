// analyze-frame-vision (medium tier)
// ---------------------------------------------------------------------------
// Marco's "eyes". Takes 1–6 keyframes (jpeg dataURLs) and returns per-frame:
//   - subject position (left | center | right)
//   - face bbox (% coords) when visible
//   - dominant negative-space side (top|bottom|left|right)
//   - busy/calm rating (low|medium|high)
//   - dominant colors (top 3 hex)
// Plus a summary the director prompt can read in one pass.
//
// Inputs:
//   frames: Array<{ time:number, dataUrl:string }>  (server caps to 6)
//
// Output (always JSON, never throws over the wire):
// { ok: true, frames: [{ time, subjectPosition, faceBbox?, negativeSpaceSide,
//   busyRating, dominantColors }], summary: { framesAnalyzed, mostCommonSubjectPosition,
//   mostCommonNegativeSpaceSide, dominantBusyRating } }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FrameAnalysis {
  time: number;
  subjectPosition: "left" | "center" | "right" | "none";
  faceBbox?: { x: number; y: number; w: number; h: number };
  negativeSpaceSide: "top" | "bottom" | "left" | "right" | "none";
  busyRating: "low" | "medium" | "high";
  dominantColors: string[];
}

function pickMode<T extends string>(arr: T[]): T | null {
  if (!arr.length) return null;
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as T;
}

async function analyzeFrames(frames: Array<{ time: number; dataUrl: string }>): Promise<FrameAnalysis[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const userParts: any[] = [
    {
      type: "text",
      text:
        `For each labeled frame, analyze composition for an editor placing on-screen text/graphics.\n` +
        `Return ONLY a JSON object matching this schema:\n` +
        `{ "frames": [ { "time": <number>, "subjectPosition": "left"|"center"|"right"|"none", ` +
        `"faceBbox": {"x":0-100,"y":0-100,"w":0-100,"h":0-100} | null, ` +
        `"negativeSpaceSide": "top"|"bottom"|"left"|"right"|"none", ` +
        `"busyRating": "low"|"medium"|"high", ` +
        `"dominantColors": ["#rrggbb", "#rrggbb", "#rrggbb"] } ] }\n` +
        `Coordinates are PERCENT of the frame (top-left origin). Negative-space side is the LARGEST empty area where text could go safely.`,
    },
  ];
  for (const f of frames) {
    userParts.push({ type: "text", text: `Frame at ${f.time.toFixed(2)}s:` });
    userParts.push({ type: "image_url", image_url: { url: f.dataUrl } });
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON-only composition analyst. Respond with ONLY a valid JSON object — no prose, no markdown.",
        },
        { role: "user", content: userParts },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.warn("[analyze-frame-vision] gateway error", resp.status, t.slice(0, 300));
    return [];
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") return [];
  const cleaned = raw.replace(/^```(?:json)?/gim, "").replace(/```$/gim, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try { parsed = JSON.parse(m[0]); } catch { return []; }
  }

  const out: FrameAnalysis[] = [];
  for (const fr of (parsed?.frames || [])) {
    const t = Number(fr?.time);
    if (!isFinite(t)) continue;
    const sp = ["left", "center", "right", "none"].includes(fr?.subjectPosition) ? fr.subjectPosition : "center";
    const ns = ["top", "bottom", "left", "right", "none"].includes(fr?.negativeSpaceSide) ? fr.negativeSpaceSide : "bottom";
    const busy = ["low", "medium", "high"].includes(fr?.busyRating) ? fr.busyRating : "medium";
    const colors: string[] = Array.isArray(fr?.dominantColors)
      ? fr.dominantColors.filter((c: any) => typeof c === "string" && /^#?[0-9a-f]{6}$/i.test(c.replace("#", ""))).slice(0, 3)
      : [];
    const fb = fr?.faceBbox;
    out.push({
      time: +t.toFixed(2),
      subjectPosition: sp,
      faceBbox: fb && typeof fb.x === "number"
        ? { x: Math.max(0, Math.min(100, fb.x)), y: Math.max(0, Math.min(100, fb.y)), w: Math.max(0, Math.min(100, fb.w)), h: Math.max(0, Math.min(100, fb.h)) }
        : undefined,
      negativeSpaceSide: ns,
      busyRating: busy,
      dominantColors: colors.map((c) => (c.startsWith("#") ? c : `#${c}`)),
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { frames } = await req.json();
    if (!Array.isArray(frames) || frames.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "frames[] required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const capped = frames.slice(0, 6);
    const analyses = await analyzeFrames(capped);

    const summary = {
      framesAnalyzed: analyses.length,
      mostCommonSubjectPosition: pickMode(analyses.map((a) => a.subjectPosition)) || "center",
      mostCommonNegativeSpaceSide: pickMode(analyses.map((a) => a.negativeSpaceSide)) || "bottom",
      dominantBusyRating: pickMode(analyses.map((a) => a.busyRating)) || "medium",
    };

    return new Response(JSON.stringify({ ok: true, frames: analyses, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-frame-vision error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
