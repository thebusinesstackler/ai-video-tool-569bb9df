// generate-conversation-video
// Orchestrates a multi-speaker conversation video:
//  1. For each dialogue line: TTS via shared `text-to-speech` (Speechify/Google clone)
//  2. Upload audio to `reels` storage bucket
//  3. Kick off `generate-talking-head-from-audio` for that twin's portrait + audio
//  4. Return array of {taskId, character, line, twinId, audioUrl, estDuration}
// Client polls each taskId via `wavespeed-video` then stitches via `creatomate-stitch`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DialogueLine { character: string; line: string; emotion?: string }
interface Speaker {
  characterName: string;
  twinId?: string;
  voice_cloning_key?: string | null;
  voice?: string | null; // built-in voice name (alloy/nova/onyx/etc.) when no twin
  gender?: string | null;
  portraitUrl: string;
}

async function ttsLine(supabaseUrl: string, anon: string, authHeader: string, text: string, speaker: Speaker): Promise<Uint8Array | null> {
  const key = speaker.voice_cloning_key || undefined;
  const speechifyVoiceId = key && UUID_RE.test(key) ? key : undefined;
  const voiceCloningKey = key && !speechifyVoiceId ? key : undefined;
  const hasClonedVoice = !!(speechifyVoiceId || voiceCloningKey);
  const builtInVoice = !hasClonedVoice ? (speaker.voice || 'ai-auto') : undefined;

  const resp = await fetch(`${supabaseUrl}/functions/v1/text-to-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader, apikey: anon },
    body: JSON.stringify({
      text,
      voice: hasClonedVoice ? 'cloned' : builtInVoice,
      speechifyVoiceId,
      voiceCloningKey,
      gender: speaker.gender || undefined,
      voiceSeed: speaker.characterName, // stable voice per character
    }),
  });
  if (!resp.ok) {
    console.warn(`text-to-speech failed for ${speaker.characterName}: ${resp.status}`);
    return null;
  }
  const data = await resp.json();
  const b64 = data?.audioContent;
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function uploadAudio(supabase: any, bytes: Uint8Array, idx: number): Promise<string> {
  const fileName = `conversation/${Date.now()}-line-${idx}.mp3`;
  const { error } = await supabase.storage.from('reels').upload(fileName, bytes, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`Audio upload failed: ${error.message}`);
  const { data } = supabase.storage.from('reels').getPublicUrl(fileName);
  return data.publicUrl;
}

function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2, Math.min(Math.round(words / 2.5) + 1, 30));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const dialogue: DialogueLine[] = body.dialogue;
    const speakers: Speaker[] = body.speakers;
    const aspectRatio: string = body.aspectRatio || '9:16';
    const source: string = body.source || 'reels';

    if (!Array.isArray(dialogue) || dialogue.length === 0) {
      return new Response(JSON.stringify({ error: 'dialogue required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!Array.isArray(speakers) || speakers.length < 2 || speakers.length > 4) {
      return new Response(JSON.stringify({ error: 'speakers must contain 2-4 entries' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const speakerMap = new Map<string, Speaker>(speakers.map(s => [s.characterName, s]));

    console.log(`[conversation-video] user=${userId} lines=${dialogue.length} speakers=${speakers.length} aspect=${aspectRatio}`);

    // Process lines sequentially to avoid overwhelming the gateway; could parallelize later.
    const results: Array<{ index: number; character: string; line: string; twinId: string; audioUrl: string; taskId: string | null; estDuration: number; error?: string }> = [];

    for (let i = 0; i < dialogue.length; i++) {
      const entry = dialogue[i];
      const speaker = speakerMap.get(entry.character) || speakers[0];

      try {
        const audioBytes = await ttsLine(supabaseUrl, anonKey, authHeader, entry.line, speaker);
        if (!audioBytes) throw new Error('TTS returned no audio');
        const audioUrl = await uploadAudio(supabase, audioBytes, i);
        const estDuration = estimateDuration(entry.line);

        const wsRes = await fetch(`${supabaseUrl}/functions/v1/generate-talking-head-from-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader, apikey: anonKey },
          body: JSON.stringify({
            audioUrl,
            portraitUrl: speaker.portraitUrl,
            durationSec: estDuration,
            aspectRatio,
            source,
          }),
        });
        const wsData = await wsRes.json();
        if (!wsRes.ok || !wsData?.taskId) throw new Error(wsData?.error || `talking-head failed (${wsRes.status})`);

        results.push({
          index: i,
          character: entry.character,
          line: entry.line,
          twinId: speaker.twinId,
          audioUrl,
          taskId: wsData.taskId,
          estDuration,
        });
        console.log(`[conversation-video] line ${i + 1}/${dialogue.length} task=${wsData.taskId} char=${entry.character}`);
      } catch (lineErr: any) {
        console.error(`[conversation-video] line ${i} failed:`, lineErr?.message);
        results.push({
          index: i,
          character: entry.character,
          line: entry.line,
          twinId: speaker.twinId,
          audioUrl: '',
          taskId: null,
          estDuration: estimateDuration(entry.line),
          error: lineErr?.message || 'unknown error',
        });
      }
    }

    return new Response(JSON.stringify({ lines: results, aspectRatio }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[conversation-video] error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
