import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, brandGuidelinesPath } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the PDF and extract text if a path is provided
    let pdfContext = "";
    if (brandGuidelinesPath) {
      try {
        const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from("brand-guidelines")
          .download(brandGuidelinesPath);

        if (!downloadError && fileData) {
          // Extract text from the PDF bytes
          const arrayBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          // Simple text extraction from PDF binary
          const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          // Extract readable strings between PDF stream markers
          const textParts: string[] = [];
          const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
          let match;
          while ((match = streamRegex.exec(rawText)) !== null) {
            const cleaned = match[1].replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim();
            if (cleaned.length > 10) textParts.push(cleaned);
          }
          // Also try extracting text operators (Tj, TJ, etc.)
          const tjRegex = /\(([^)]+)\)\s*Tj/g;
          while ((match = tjRegex.exec(rawText)) !== null) {
            textParts.push(match[1]);
          }
          // Fallback: grab any readable ASCII sequences
          if (textParts.length === 0) {
            const asciiMatches = rawText.match(/[A-Za-z][A-Za-z0-9 .,;:!?'"-]{10,}/g);
            if (asciiMatches) textParts.push(...asciiMatches);
          }
          pdfContext = textParts.join("\n").substring(0, 12000);
        }
      } catch (e) {
        console.error("PDF extraction error:", e);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a Brand Strategy Assistant. You help users understand, refine, and apply their brand guidelines.

${pdfContext ? `The user has uploaded brand guidelines. Here is the extracted content:\n\n---\n${pdfContext}\n---\n\nUse this content to answer questions about their brand colors, typography, tone of voice, logo usage, visual style, and any other brand elements. If you can identify specific values (hex colors, font names, etc.), mention them explicitly.` : "No brand guidelines have been uploaded yet. Encourage the user to upload their brand guidelines PDF so you can help them understand and apply their branding."}

Be helpful, specific, and actionable. When discussing colors, mention exact values if available. When discussing typography, mention font names. Keep responses concise but thorough.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("brand-guidelines-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
