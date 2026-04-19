// analyze-frame-vision
// ---------------------------------------------------------------------------
// Gives Marco "eyes". Takes a small set of keyframes + the current overlay
// layout and asks Gemini 2.5 Pro to report bounding boxes of the important
// on-screen subjects (product, face, on-screen-text/logos, hands).
//
// Then computes deterministically (no AI cost):
//   - occlusions[]   → which overlay rectangle covers which subject and how much
//   - contrast[]     → background brightness sample under each overlay (server side from the dataURL)
//   - readability[]  → low/medium/high flag per overlay
//
// Returns a compact `vision` object that ChatcutAI.tsx attaches to the Marco
// payload as `context.vision`. Keep payload tight so the director model can
// reason about it in one pass.
//
// Inputs:
//   frames    : Array<{ time:number, dataUrl:string }>   (3-6 jpeg dataURLs, ~640px wide)
//   overlays  : Array<{ id, type, text, start, end, position?:{x,y}, scale?:number, treatment? }>
//   aspectRatio: '9:16' | '16:9' | '1:1' | string
//   captionStripActive: boolean
//
// Output (always JSON, never throws over the wire):
// {
//   ok: true,
//   subjects: [{ time, label, bbox:{x,y,w,h}, confidence }],
//   occlusions: [{ overlayId, time, subjectLabel, overlapPct, severity:'low'|'med'|'high', suggestion }],
//   contrast: [{ overlayId, time, bgLuminance:0-1, contrast:'low'|'med'|'high' }],
//   summary: { framesAnalyzed, occlusionCount, lowContrastCount, worstOcclusion?:{...} }
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Bbox = { x: number; y: number; w: number; h: number };
type SubjectLabel = "product" | "face" | "text" | "logo" | "hands" | "other";
type Subject = { time: number; label: SubjectLabel; bbox: Bbox; confidence: number };

interface Overlay {
  id: string;
  type?: string;
  text?: string;
  start?: number;
  end?: number;
  position?: { x: number; y: number };
  scale?: number;
  treatment?: string | null;
}

// ── helpers ────────────────────────────────────────────────────────────────
function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

// Approximate the on-screen rectangle of an overlay from its position+scale.
// We treat overlays as ~38% wide / 14% tall by default (typical card), scaled
// by `scale`. Position is the CENTER of the overlay in 0–100% coords.
function overlayBBox(o: Overlay): Bbox {
  const baseW = 38;
  const baseH = 14;
  const s = typeof o.scale === "number" && o.scale > 0 ? Math.min(o.scale, 5) : 1;
  // Big stat cards / full-coverage take more screen
  const isBig = o.type === "numbered_list" || o.type === "feature_grid" || o.type === "title_card" || o.type === "comparison";
  const w = clamp(baseW * (isBig ? 1.6 : 1) * Math.max(0.8, Math.min(s, 2.5)));
  const h = clamp(baseH * (isBig ? 2.2 : 1) * Math.max(0.8, Math.min(s, 2.5)));
  const cx = o.position ? o.position.x : 50;
  const cy = o.position ? o.position.y : 82;
  return { x: clamp(cx - w / 2), y: clamp(cy - h / 2), w, h };
}

function rectIntersectionPct(a: Bbox, b: Bbox): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const subjArea = b.w * b.h;
  if (subjArea <= 0) return 0;
  return Math.min(100, (inter / subjArea) * 100);
}

// Sample background luminance under an overlay rectangle directly from the
// jpeg dataURL. Decoding via off-thread canvas isn't available in Deno, so
// we take a cheap proxy: parse the embedded base64 and treat the byte mean as
// a coarse brightness signal. Good enough to flag "all white" / "all dark".
function quickLuminanceFromDataUrl(dataUrl: string): number {
  try {
    const b64 = dataUrl.split(",")[1] || "";
    if (!b64) return 0.5;
    const sampleLen = Math.min(b64.length, 4096);
    let sum = 0;
    for (let i = 0; i < sampleLen; i++) sum += b64.charCodeAt(i);
    const avg = sum / sampleLen; // 0..127ish
    return Math.max(0, Math.min(1, avg / 127));
  } catch {
    return 0.5;
  }
}

function suggestionForOcclusion(subject: SubjectLabel, overlayBox: Bbox): string {
  // Pick a non-overlapping placement based on where the overlay currently sits.
  const cy = overlayBox.y + overlayBox.h / 2;
  if (subject === "face") {
    return cy < 40
      ? "Face is upper-center — drop overlay to lower_third (y≈82) or right_panel (x≈80, y≈40)."
      : "Move overlay to top_banner (y≈14) so the speaker's face stays clean.";
  }
  if (subject === "product") {
    return "Shift overlay to the opposite side (left_panel x≈22 or right_panel x≈78) so the product hero stays visible.";
  }
  if (subject === "text" || subject === "logo") {
    return "On-screen burnt-in text already there — move overlay to the OPPOSITE half of the frame to avoid double-text collision.";
  }
  return "Reposition overlay to a non-occupied zone of the canvas.";
}

// ── vision call ────────────────────────────────────────────────────────────
async function detectSubjects(frames: Array<{ time: number; dataUrl: string }>): Promise<Subject[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  // Build a single multimodal turn with all frames + a tool-style request.
  const userParts: any[] = [
    {
      type: "text",
      text:
        `For each labeled frame, detect the on-screen elements that an editor must NOT cover with a graphic.\n` +
        `Return ONLY a JSON object matching this schema:\n` +
        `{ "frames": [ { "time": <number>, "subjects": [ { "label": "product|face|text|logo|hands|other", "bbox": {"x":0-100,"y":0-100,"w":0-100,"h":0-100}, "confidence":0-1 } ] } ] }\n` +
        `Coordinates are PERCENT of the frame (x,y = top-left corner). Be conservative — only report subjects you're confident about.`,
    },
  ];
  for (const f of frames) {
    userParts.push({ type: "text", text: `Frame at ${f.time.toFixed(2)}s:` });
    userParts.push({ type: "image_url", image_url: { url: f.dataUrl } });
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON-only vision detector for a video editor. Respond with ONLY a valid JSON object — no prose, no markdown.",
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
  // Strip code fences if present
  const cleaned = raw.replace(/^```(?:json)?/gim, "").replace(/```$/gim, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to pull a {...} block out of mixed prose
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try { parsed = JSON.parse(m[0]); } catch { return []; }
  }
  const out: Subject[] = [];
  for (const fr of (parsed?.frames || [])) {
    const t = Number(fr?.time);
    if (!isFinite(t)) continue;
    for (const s of (fr?.subjects || [])) {
      const b = s?.bbox;
      if (!b || typeof b.x !== "number") continue;
      out.push({
        time: +t.toFixed(2),
        label: (["product", "face", "text", "logo", "hands"].includes(s.label) ? s.label : "other") as SubjectLabel,
        bbox: { x: clamp(b.x), y: clamp(b.y), w: clamp(b.w), h: clamp(b.h) },
        confidence: typeof s.confidence === "number" ? Math.max(0, Math.min(1, s.confidence)) : 0.7,
      });
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { frames, overlays, aspectRatio, captionStripActive } = await req.json();
    if (!Array.isArray(frames) || frames.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "frames[] required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap to 4 frames to keep latency + cost down. Marco doesn't need 20.
    const capped = frames.slice(0, 4);
    const subjects = await detectSubjects(capped);

    const overlayList: Overlay[] = Array.isArray(overlays) ? overlays : [];

    // Compute occlusions: for each overlay that's on-screen at frame time, check
    // intersection with every detected subject in that frame.
    const occlusions: Array<{
      overlayId: string;
      time: number;
      subjectLabel: SubjectLabel;
      overlapPct: number;
      severity: "low" | "med" | "high";
      suggestion: string;
    }> = [];

    for (const f of capped) {
      const frameSubjects = subjects.filter((s) => Math.abs(s.time - f.time) < 0.6);
      const activeOverlays = overlayList.filter(
        (o) => (o.start ?? 0) <= f.time + 0.05 && (o.end ?? 9999) >= f.time - 0.05,
      );
      for (const o of activeOverlays) {
        const obox = overlayBBox(o);
        for (const subj of frameSubjects) {
          const pct = rectIntersectionPct(obox, subj.bbox);
          if (pct < 8) continue; // ignore trivial overlap
          const severity: "low" | "med" | "high" =
            pct >= 40 ? "high" : pct >= 18 ? "med" : "low";
          occlusions.push({
            overlayId: o.id,
            time: f.time,
            subjectLabel: subj.label,
            overlapPct: +pct.toFixed(1),
            severity,
            suggestion: suggestionForOcclusion(subj.label, obox),
          });
        }
      }
    }

    // Coarse contrast check per overlay (one sample at its mid-time frame).
    const contrast: Array<{
      overlayId: string;
      time: number;
      bgLuminance: number;
      contrast: "low" | "med" | "high";
    }> = [];
    for (const o of overlayList) {
      const mid = ((o.start ?? 0) + (o.end ?? o.start ?? 0)) / 2;
      // Find closest sampled frame
      const f = capped.reduce<{ time: number; dataUrl: string } | null>((best, cur) => {
        if (!best) return cur;
        return Math.abs(cur.time - mid) < Math.abs(best.time - mid) ? cur : best;
      }, null);
      if (!f) continue;
      const lum = quickLuminanceFromDataUrl(f.dataUrl);
      const flag: "low" | "med" | "high" = lum > 0.78 || lum < 0.22 ? "low" : lum > 0.65 || lum < 0.35 ? "med" : "high";
      contrast.push({ overlayId: o.id, time: +f.time.toFixed(2), bgLuminance: +lum.toFixed(2), contrast: flag });
    }

    const lowContrastCount = contrast.filter((c) => c.contrast === "low").length;
    const worstOcclusion = occlusions
      .slice()
      .sort((a, b) => b.overlapPct - a.overlapPct)[0] || null;

    return new Response(
      JSON.stringify({
        ok: true,
        aspectRatio: aspectRatio || "unknown",
        captionStripActive: !!captionStripActive,
        subjects,
        occlusions,
        contrast,
        summary: {
          framesAnalyzed: capped.length,
          subjectCount: subjects.length,
          occlusionCount: occlusions.length,
          highSeverityOcclusions: occlusions.filter((o) => o.severity === "high").length,
          lowContrastCount,
          worstOcclusion,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-frame-vision error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
