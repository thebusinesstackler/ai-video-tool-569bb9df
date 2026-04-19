import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';

const MAX_MESSAGE_LENGTH = 50000;
const MAX_MESSAGES_COUNT = 100;

function isImageRequest(body: any): boolean {
  if (body.modalities && Array.isArray(body.modalities) && body.modalities.includes('image')) return true;
  const model = (body.model || '').toLowerCase();
  if (model.includes('image')) return true;
  return false;
}

async function generateImageWithGateway(prompt: string, apiKey: string): Promise<string> {
  const models = [IMAGE_MODEL, 'google/gemini-2.5-flash-image'];
  for (const model of models) {
    try {
      console.log(`Generating image with model: ${model}`);
      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text'],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI Gateway image error (${model}):`, response.status, errorText);
        continue; // try next model
      }

      const data = await response.json();
      const images = data.choices?.[0]?.message?.images;
      if (images?.length > 0) {
        return images[0].image_url?.url || '';
      }
      console.error(`No image in response for model ${model}`);
    } catch (e) {
      console.error(`Image generation exception (${model}):`, e);
    }
  }
  throw new Error('Image generation failed after all model attempts');
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // IMAGE REQUESTS
    if (isImageRequest(body)) {
      const chatMessages = messages || [{ role: "user", content: message }];
      let textPrompt = message || '';
      if (!textPrompt && chatMessages.length > 0) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (typeof lastMsg.content === 'string') textPrompt = lastMsg.content;
        else if (Array.isArray(lastMsg.content)) {
          textPrompt = lastMsg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
        }
      }

      try {
        const imageUrl = await generateImageWithGateway(textPrompt, LOVABLE_API_KEY);
        return new Response(JSON.stringify({ response: '', imageUrl, choices: [{ message: { content: '', images: [{ image_url: { url: imageUrl } }] } }] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error('Image generation failed:', error);
        return new Response(JSON.stringify({ 
          error: 'Image generation is temporarily unavailable. Please try again in a moment.',
          userMessage: 'Image generation is temporarily unavailable. Please try again in a moment.',
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // TEXT REQUESTS
    const chatMessages = messages || [
      { role: "system", content: "You are a professional video script writer. Create engaging, clear video scripts optimized for the specified duration, style, audience, and tone." },
      { role: "user", content: message },
    ];

    const result = await callClaude({ messages: chatMessages, model });

    return new Response(JSON.stringify({ response: result.text || '', imageUrl: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in AI call:", error);
    const errMsg = error instanceof Error ? error.message : '';
    const isBilling = errMsg.includes('429') || errMsg.includes('402') || errMsg.includes('credit');
    const userMessage = isBilling
      ? 'Our AI services are temporarily unavailable. Please try again later.'
      : 'Something went wrong. Please try this feature again later.';
    const status = error instanceof ClaudeError ? error.status : 500;
    return new Response(JSON.stringify({ error: userMessage, userMessage }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
