import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Final Marco QA pass.
 * Compares up to 6 video keyframes against the user's reference product image
 * + brand context, and returns a structured verdict + a friendly Marco-style
 * chat message the client can drop straight into the conversation.
 *
 * Input:
 * {
 *   keyframes: [{ time: number, dataUrl: string }],
 *   product: { name, description, benefits, brand, imageUrl },
 *   brand: { tone, palette, audience, recurringPhrases },
 *   targetPlatform: string,
 *   targetAspect: '9:16' | '16:9' | '1:1',
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const keyframes = Array.isArray(body.keyframes) ? body.keyframes.slice(0, 6) : [];
    const product = body.product || null;
    const brand = body.brand || {};
    const targetPlatform = body.targetPlatform || "tiktok";
    const targetAspect = body.targetAspect || "9:16";

    if (keyframes.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "no_keyframes", message: "No keyframes provided" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!product || !product.imageUrl) {
      return new Response(
        JSON.stringify({
          ok: true,
          verdict: "skipped",
          productMatch: null,
          brandMatch: null,
          issues: [],
          marcoMessage:
            "Heads up — I couldn't run the final product check because there's no primary product image set in your Product Library yet 📦\n\nAdd one and I'll verify every shot next time.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productSummary = [
      `Name: ${product.name || "(unnamed)"}`,
      product.brand ? `Brand: ${product.brand}` : null,
      product.description ? `Description: ${product.description}` : null,
      Array.isArray(product.benefits) && product.benefits.length
        ? `Key benefits: ${product.benefits.slice(0, 5).join(", ")}`
        : null,
    ].filter(Boolean).join("\n");

    const brandSummary = [
      brand.tone ? `Tone: ${brand.tone}` : null,
      brand.audience ? `Audience: ${brand.audience}` : null,
      Array.isArray(brand.palette) && brand.palette.length
        ? `Palette: ${brand.palette.slice(0, 5).join(", ")}`
        : null,
      Array.isArray(brand.recurringPhrases) && brand.recurringPhrases.length
        ? `Recurring phrases: ${brand.recurringPhrases.slice(0, 5).join(" · ")}`
        : null,
    ].filter(Boolean).join("\n") || "(no brand context)";

    // Build multimodal user message: reference image first, then video frames
    const userContent: any[] = [
      {
        type: "text",
        text:
          `You are Marco doing the FINAL pre-export quality review of a marketing video.\n\n` +
          `THE USER'S OFFICIAL PRODUCT (source of truth):\n${productSummary}\n\n` +
          `BRAND CONTEXT:\n${brandSummary}\n\n` +
          `OUTPUT FORMAT: ${targetPlatform} (${targetAspect})\n\n` +
          `Below is (1) the official product reference image, then (2) up to 6 keyframes from the edited video at different timestamps.\n\n` +
          `YOUR JOB:\n` +
          `1. For EACH frame that contains a product/bottle/package/can/jar/tube — decide if it's a confident match for the official product (label color, shape, size, branding, text). If not the same, flag it.\n` +
          `2. Spot any visual or brand inconsistencies (wrong colors, off-tone scene, off-brand text, generic stock-looking shots when the real product should appear, low-quality moments).\n` +
          `3. Confirm the video opens with a strong hook visual and ends with a clear CTA moment (last 15%).\n` +
          `4. Be concise. Return JSON ONLY.\n\n` +
          `Return STRICT JSON:\n` +
          `{\n` +
          `  "productMatch": "match" | "mismatch" | "no_product_visible" | "uncertain",\n` +
          `  "productConfidence": 0.0-1.0,\n` +
          `  "brandMatch": "on_brand" | "off_brand" | "uncertain",\n` +
          `  "issues": [{ "time": <seconds:number>, "severity": "high" | "med" | "low", "type": "wrong_product" | "off_brand" | "low_quality" | "missing_cta" | "weak_hook" | "other", "what": "<short description>", "fix": "<one-sentence suggested fix>" }],\n` +
          `  "summary": "<one-sentence overall verdict>"\n` +
          `}`,
      },
      { type: "image_url", image_url: { url: product.imageUrl } },
      ...keyframes.map((kf: any) => ({ type: "image_url", image_url: { url: kf.dataUrl } })),
      {
        type: "text",
        text: `Frame timestamps (seconds, in order shown above): ${keyframes.map((k: any) => k.time?.toFixed?.(1) ?? k.time).join(", ")}`,
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are Marco, an expert AI video editor. Respond with STRICT JSON only — no markdown, no commentary." },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ ok: false, error: "rate_limited", message: "Rate limited — try again shortly" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ ok: false, error: "credits", message: "AI credits exhausted" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", status, t);
      return new Response(JSON.stringify({ ok: false, error: "ai_error", message: "Vision QA failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ai = await aiResp.json();
    const raw = ai?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      const cleaned = String(raw).replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("QA parse failed", raw);
      parsed = { productMatch: "uncertain", brandMatch: "uncertain", issues: [], summary: "Couldn't parse review." };
    }

    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const highIssues = issues.filter((i: any) => i.severity === "high");
    const wrongProduct = issues.filter((i: any) => i.type === "wrong_product");

    // Build a Marco-tone chat message
    let marcoMessage = "";
    const productName = product.name || "your product";

    if (parsed.productMatch === "match" && highIssues.length === 0 && parsed.brandMatch !== "off_brand") {
      marcoMessage =
        `Final QA done ✅\n\n` +
        `${productName} matches in every shot and the edit feels on-brand.\n\n` +
        `Cleared for export — sending it to render.`;
    } else {
      const lines: string[] = [`Hold up — final QA flagged a few things 🛑\n`];
      if (parsed.productMatch === "mismatch" || wrongProduct.length > 0) {
        const where = wrongProduct.map((i: any) => `${Number(i.time || 0).toFixed(1)}s`).join(", ");
        lines.push(`The bottle/product on screen doesn't look like **${productName}**${where ? ` (around ${where})` : ""}. We should swap or cover it before export.`);
      }
      if (parsed.brandMatch === "off_brand") {
        lines.push(`A few moments feel off-brand for the tone we set.`);
      }
      issues.slice(0, 4).forEach((i: any) => {
        const t = typeof i.time === "number" ? `${i.time.toFixed(1)}s` : "—";
        lines.push(`• **${t}** — ${i.what} → _${i.fix}_`);
      });
      lines.push(`\nWant me to auto-cover the wrong-product moments with real ${productName} B-roll, or do you want to fix it manually first?`);
      marcoMessage = lines.join("\n");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        verdict: highIssues.length > 0 || parsed.productMatch === "mismatch" ? "needs_review" : "approved",
        productMatch: parsed.productMatch,
        productConfidence: parsed.productConfidence,
        brandMatch: parsed.brandMatch,
        issues,
        summary: parsed.summary || "",
        marcoMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("qa-product-match error", e);
    return new Response(
      JSON.stringify({ ok: false, error: "exception", message: e instanceof Error ? e.message : "unknown" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
