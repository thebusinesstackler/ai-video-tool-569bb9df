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

// Generate image using OpenAI gpt-image-1
async function generateImageWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  console.log('Generating image with OpenAI gpt-image-1');
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI image error:', response.status, errorText);
    throw new Error(`OpenAI image error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  const url = data.data?.[0]?.url;
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('No image in OpenAI response');
}

// Call OpenAI GPT-4o for text completion (fallback when Claude fails)
async function callOpenAIText(messages: any[], apiKey: string): Promise<string> {
  console.log('Falling back to OpenAI GPT-4o for text');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI text error:', response.status, errorText);
    throw new Error(`OpenAI text error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
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

    // IMAGE REQUESTS: Use OpenAI gpt-image-1
    if (isImageRequest(body)) {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract text prompt from messages
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
        const imageUrl = await generateImageWithOpenAI(textPrompt, OPENAI_API_KEY);
        return new Response(JSON.stringify({ response: '', imageUrl, choices: [{ message: { content: '', images: [{ image_url: { url: imageUrl } }] } }] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error('OpenAI image generation failed:', error);
        return new Response(JSON.stringify({ error: 'Failed to generate image' }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // TEXT REQUESTS: Use Claude Opus with extended thinking, fallback to OpenAI GPT-4o
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
      console.warn('Claude failed, trying OpenAI GPT-4o fallback:', error instanceof Error ? error.message : error);
      
      // Fallback to OpenAI GPT-4o
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        if (error instanceof ClaudeError) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      try {
        const text = await callOpenAIText(chatMessages, OPENAI_API_KEY);
        return new Response(JSON.stringify({ response: text, imageUrl: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (openaiError) {
        console.error('OpenAI fallback also failed:', openaiError);
        if (error instanceof ClaudeError) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }
    }
  } catch (error) {
    console.error("Error in AI call:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
