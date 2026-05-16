// Reels & Stories Pro — Claude-driven agentic talking-head generator
// Streams NDJSON events: { type: 'text'|'tool_call'|'tool_result'|'done'|'error', ... }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const SYSTEM_PROMPT = `You are Marco Pro, an elite AI Reel Director for long-form talking-head Reels & Stories.

You generate vertical (9:16) talking-head videos using the user's AI Twin and InfiniteTalk HD lip-sync (no 20-second segment limit — up to 300s total).

WORKFLOW (always follow in order):
1. Call list_twins to see available AI Twins. Confirm which twin to use (ask if more than one).
2. Call draft_script with topic + duration. Show the result to the user and ask for approval or edits.
3. After approval, call synthesize_voice to produce the narration audio (uses the twin's cloned voice).
4. Call generate_talking_head with the audio + twin's portrait image. This returns a wavespeed taskId.
5. Call poll_video_task in a loop (you can call it repeatedly — wait 15s between polls) until status is completed or failed.
6. When complete, call save_to_library to persist the final reel.

SCRIPT RULES:
- Hook (first 6+ seconds, 15-25 words): psychological trigger (curiosity gap, pattern interrupt, controversial claim)
- Pacing ~2.5 words/second. 60s = ~150 words. Max 300s = ~750 words.
- Structure: Hook → Problem → Solution/Ritual → 3 Benefits → CTA
- Never use the word "seriously" — it's overused
- Conversational, not corporate. First person.

VOICE RULES:
- Always use the selected twin's voice_cloning_key. Never invent a voice.

Be concise in chat — let the tool results speak. After each tool call, briefly summarize what happened (1 sentence) and what's next.`;

interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'list_twins',
      description: 'List the user\'s AI Twins available for talking-head video.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_script',
      description: 'Draft a pacing-aware talking-head script with hook, body, CTA.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'What the reel is about' },
          durationSeconds: { type: 'number', description: 'Target duration in seconds (15-300)' },
          tone: { type: 'string', description: 'e.g. educational, hype, calm, witty' },
          callToAction: { type: 'string', description: 'Optional CTA' },
        },
        required: ['topic', 'durationSeconds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'synthesize_voice',
      description: 'Generate the narration audio using the selected twin\'s cloned voice.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Full narration text (no stage directions)' },
          twinId: { type: 'string', description: 'AI Twin id from list_twins' },
        },
        required: ['text', 'twinId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_talking_head',
      description: 'Start an InfiniteTalk HD lip-sync video. Returns a wavespeed taskId — must be polled.',
      parameters: {
        type: 'object',
        properties: {
          audioUrl: { type: 'string', description: 'audioUrl from synthesize_voice' },
          twinId: { type: 'string', description: 'AI Twin id' },
          durationSec: { type: 'number', description: 'Audio duration in seconds' },
        },
        required: ['audioUrl', 'twinId', 'durationSec'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'poll_video_task',
      description: 'Check status of a wavespeed video task. Call repeatedly (every ~15s) until completed.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_to_library',
      description: 'Save the completed reel to the user\'s library.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          videoUrl: { type: 'string' },
          audioUrl: { type: 'string' },
          script: { type: 'string' },
          durationSec: { type: 'number' },
        },
        required: ['topic', 'videoUrl', 'durationSec'],
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Tool implementations
// ──────────────────────────────────────────────────────────────────────────
async function invokeEdgeFn(name: string, body: unknown, authHeader: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `${name} failed: ${res.status}`);
  return data;
}

async function runTool(
  name: string,
  args: any,
  ctx: { authHeader: string; userId: string; userClient: any }
): Promise<any> {
  switch (name) {
    case 'list_twins': {
      const { data, error } = await ctx.userClient.rpc('get_twins_summary', { _user_id: ctx.userId });
      if (error) throw new Error(error.message);
      return {
        twins: (data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          gender: t.gender,
          hasVoiceClone: !!t.voice_cloning_key,
          portrait: t.first_image,
        })),
      };
    }

    case 'draft_script': {
      const data = await invokeEdgeFn('generate-reel-script', {
        topic: args.topic,
        duration: args.durationSeconds,
        tone: args.tone || 'conversational',
        callToAction: args.callToAction || '',
        style: 'talking-head',
      }, ctx.authHeader);
      // Normalise — different edge fns return different shapes
      const scenes = data.scenes || data.script?.scenes || [];
      const fullText = scenes.length
        ? scenes.map((s: any) => s.narration || s.text || '').join(' ').trim()
        : (data.script?.full || data.fullScript || data.text || '');
      return {
        script: fullText,
        scenes,
        wordCount: fullText.split(/\s+/).filter(Boolean).length,
        estimatedSeconds: Math.round(fullText.split(/\s+/).filter(Boolean).length / 2.5),
      };
    }

    case 'synthesize_voice': {
      // Get twin's voice cloning key
      const { data: twin } = await ctx.userClient
        .from('ai_twins')
        .select('voice_cloning_key, voice_engine, google_voice_id, gender')
        .eq('id', args.twinId)
        .single();
      const data = await invokeEdgeFn('text-to-speech', {
        text: args.text,
        voiceCloningKey: twin?.voice_cloning_key || undefined,
        speechifyVoiceId: twin?.voice_cloning_key && /^[0-9a-f-]{36}$/.test(twin.voice_cloning_key) ? twin.voice_cloning_key : undefined,
        voice: 'alloy',
        gender: twin?.gender,
      }, ctx.authHeader);
      const audioUrl = data.audioUrl || (data.audioContent ? `data:audio/mp3;base64,${data.audioContent}` : null);
      if (!audioUrl) throw new Error('TTS returned no audio');
      // Estimate duration from word count
      const words = args.text.split(/\s+/).filter(Boolean).length;
      const durationSec = Math.max(5, Math.round(words / 2.5));
      return { audioUrl, durationSec };
    }

    case 'generate_talking_head': {
      const { data: twin } = await ctx.userClient
        .from('ai_twins')
        .select('reference_images')
        .eq('id', args.twinId)
        .single();
      const portraitUrl = twin?.reference_images?.[0];
      if (!portraitUrl) throw new Error('Twin has no reference image');
      const data = await invokeEdgeFn('generate-talking-head-from-audio', {
        audioUrl: args.audioUrl,
        portraitUrl,
        durationSec: args.durationSec,
        aspectRatio: '9:16',
        source: 'reels-pro',
      }, ctx.authHeader);
      return { taskId: data.taskId, model: data.model };
    }

    case 'poll_video_task': {
      const data = await invokeEdgeFn('wavespeed-video', {
        action: 'status',
        taskId: args.taskId,
      }, ctx.authHeader);
      return {
        status: data.status,
        progress: data.progress,
        videoUrl: data.videoUrl,
        error: data.error,
      };
    }

    case 'save_to_library': {
      const { data, error } = await ctx.userClient
        .from('reels')
        .insert({
          user_id: ctx.userId,
          topic: args.topic,
          video_url: args.videoUrl,
          audio_url: args.audioUrl || null,
          total_duration: Math.round(args.durationSec),
          scenes: args.script ? [{ narration: args.script }] : [],
          is_draft: false,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return { reelId: data.id, success: true };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Agent loop
// ──────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const userMessages: any[] = body.messages || [];
    const model: string = body.model || 'google/gemini-3-flash-preview';

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...userMessages,
    ];

    const ctx = { authHeader, userId, userClient };

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (ev: any) => controller.enqueue(enc.encode(JSON.stringify(ev) + '\n'));

        try {
          const MAX_STEPS = 50;
          for (let step = 0; step < MAX_STEPS; step++) {
            const aiRes = await fetch(GATEWAY_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                messages,
                tools: TOOLS,
                tool_choice: 'auto',
              }),
            });

            if (!aiRes.ok) {
              const errText = await aiRes.text();
              if (aiRes.status === 429) {
                send({ type: 'error', message: 'Rate limited. Try again in a moment.' });
              } else if (aiRes.status === 402) {
                send({ type: 'error', message: 'AI credits exhausted. Add credits in Settings.' });
              } else {
                send({ type: 'error', message: `Gateway error ${aiRes.status}: ${errText.slice(0, 200)}` });
              }
              controller.close();
              return;
            }

            const data = await aiRes.json();
            const msg = data.choices?.[0]?.message;
            if (!msg) {
              send({ type: 'error', message: 'No response from model' });
              controller.close();
              return;
            }

            messages.push(msg);

            const toolCalls = msg.tool_calls || [];
            if (msg.content) {
              send({ type: 'text', text: msg.content });
            }

            if (!toolCalls.length) {
              send({ type: 'done' });
              controller.close();
              return;
            }

            for (const tc of toolCalls) {
              const name = tc.function?.name;
              let args: any = {};
              try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
              send({ type: 'tool_call', id: tc.id, name, args });
              try {
                const result = await runTool(name, args, ctx);
                send({ type: 'tool_result', id: tc.id, name, result });
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                });
              } catch (err: any) {
                const errMsg = err?.message || String(err);
                send({ type: 'tool_result', id: tc.id, name, error: errMsg });
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: errMsg }),
                });
              }
            }
          }
          send({ type: 'error', message: 'Max steps reached' });
          controller.close();
        } catch (err: any) {
          console.error('Agent loop error', err);
          send({ type: 'error', message: err?.message || 'Internal error' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
