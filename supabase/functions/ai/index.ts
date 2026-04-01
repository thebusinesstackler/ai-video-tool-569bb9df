import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGE_LENGTH = 5000;
const MAX_MESSAGES_COUNT = 50;

function extractText(message: any): string | null {
  if (!message) return null;
  if (typeof message.content === 'string' && message.content.trim()) return message.content;
  if (Array.isArray(message.content)) {
    const textParts = message.content
      .filter((p: any) => (p.type === 'text' && p.text) || (p.type === 'output_text' && p.text))
      .map((p: any) => p.text);
    if (textParts.length > 0) return textParts.join('\n');
  }
  return null;
}

function extractImageUrl(message: any): string | null {
  if (!message) return null;
  if (message.images && Array.isArray(message.images) && message.images.length > 0) {
    const img = message.images[0];
    if (typeof img === 'string') return img;
    if (img?.image_url?.url) return img.image_url.url;
    if (img?.url) return img.url;
    if (img?.b64_json) return `data:image/png;base64,${img.b64_json}`;
    if (img?.base64) return `data:image/png;base64,${img.base64}`;
    if (img?.data) return `data:image/png;base64,${img.data}`;
  }
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'image_url' && part.image_url?.url) return part.image_url.url;
      if (part.type === 'image' && part.url) return part.url;
      if (part.type === 'output_image' && part.url) return part.url;
      if (part.type === 'output_image' && part.image_url?.url) return part.image_url.url;
      if (part.type === 'image' && part.b64_json) return `data:image/png;base64,${part.b64_json}`;
      if (part.type === 'output_image' && part.b64_json) return `data:image/png;base64,${part.b64_json}`;
    }
  }
  return null;
}
function isImageRequest(body: any): boolean {
  if (body.modalities && Array.isArray(body.modalities) && body.modalities.includes('image')) return true;
  const model = (body.model || '').toLowerCase();
  if (model.includes('image')) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { message, messages, model, modalities } = body;

    if (!message && (!messages || !Array.isArray(messages) || messages.length === 0)) {
      return new Response(JSON.stringify({ error: "Message or messages array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message) {
      if (typeof message !== 'string') {
        return new Response(JSON.stringify({ error: "Message must be a string" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (messages) {
      if (messages.length > MAX_MESSAGES_COUNT) {
        return new Response(JSON.stringify({ error: `Messages array exceeds maximum of ${MAX_MESSAGES_COUNT} messages` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const msg of messages) {
        if (!msg.role || !msg.content) {
          return new Response(JSON.stringify({ error: "Each message must have role and content" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
          return new Response(JSON.stringify({ error: `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // IMAGE REQUESTS: Use Lovable AI (Claude can't generate images)
    if (isImageRequest(body)) {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "AI service unavailable" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chatMessages = messages || [
        { role: "system", content: "You are a professional video script writer." },
        { role: "user", content: message },
      ];

      const requestBody: any = { model: model || "google/gemini-2.5-flash", messages: chatMessages };
      if (modalities) requestBody.modalities = modalities;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI Gateway error:", response.status, errText);
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required / quota exceeded" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Failed to get AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const aiMessage = data.choices?.[0]?.message;
      const textContent = extractText(aiMessage);
      const imageUrl = extractImageUrl(aiMessage);

      if (!textContent && !imageUrl) {
        return new Response(JSON.stringify({ response: '', imageUrl: null, choices: data.choices, warning: 'empty_ai_output' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ response: textContent || '', imageUrl: imageUrl || null, choices: data.choices }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TEXT REQUESTS: Use Claude Opus with extended thinking
    const chatMessages = messages || [
      { role: "system", content: "You are a professional video script writer. Create engaging, clear video scripts optimized for the specified duration, style, audience, and tone." },
      { role: "user", content: message },
    ];

    try {
      const result = await callClaude({
        messages: chatMessages,
        thinkingBudget: 4000,
      });

      return new Response(JSON.stringify({ response: result.text || '', imageUrl: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      if (error instanceof ClaudeError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in AI call:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
  } catch (error) {
    console.error("Error in AI call:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});