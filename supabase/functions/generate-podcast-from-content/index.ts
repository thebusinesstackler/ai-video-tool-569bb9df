import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DialogueLine {
  speaker: 'A' | 'B';
  text: string;
}

// Strip HTML to readable text
function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '\"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PodcastBot/1.0)',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  const html = await res.text();
  return stripHtml(html);
}

// Sanitize for TTS — remove brackets, em-dashes, etc.
function sanitizeForTTS(text: string): string {
  let c = text || '';
  c = c.replace(/\([^)]*\)/g, '');
  c = c.replace(/\[[^\]]*\]/g, '');
  c = c.replace(/\*[^*]*\*/g, '');
  c = c.replace(/—/g, ', ');
  c = c.replace(/–/g, ', ');
  c = c.replace(/…/g, '.');
  c = c.replace(/\s+/g, ' ').trim();
  return c;
}

async function generateDialogue(
  content: string,
  hostAName: string,
  hostBName: string,
  targetMinutes: number,
): Promise<DialogueLine[]> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) throw new Error('LOVABLE_API_KEY not configured');

  // Cap input to keep prompt sane
  const trimmed = content.length > 12000 ? content.slice(0, 12000) : content;
  const targetExchanges = Math.max(8, Math.round(targetMinutes * 6)); // ~6 exchanges/min

  const systemPrompt = `You are a podcast scriptwriter creating a NotebookLM-style two-host conversation.
Hosts:
- A = ${hostAName} (curious, asks questions, reacts)
- B = ${hostBName} (knowledgeable, explains, gives examples)

Rules:
- Natural spoken language, contractions, short sentences (8-18 words).
- Hosts interrupt, agree, build on each other. Avoid robotic Q&A.
- Open with a hook from A, end with a clean wrap-up from B.
- ~${targetExchanges} total turns. Alternate A/B; occasional doubles allowed.
- NO stage directions, NO sound cues, NO timestamps, NO markdown.
- Return ONLY valid JSON: { "dialogue": [ { "speaker": "A" | "B", "text": "..." }, ... ] }`;

  const userPrompt = `Source material to discuss in the podcast:\n\n${trimmed}`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch {
    // Try to extract JSON
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI returned invalid JSON');
    parsed = JSON.parse(m[0]);
  }
  const dialogue = parsed.dialogue || parsed.lines || [];
  if (!Array.isArray(dialogue) || dialogue.length === 0) {
    throw new Error('No dialogue generated');
  }
  return dialogue
    .filter((d: any) => d?.text && (d.speaker === 'A' || d.speaker === 'B'))
    .map((d: any) => ({ speaker: d.speaker, text: String(d.text).trim() }));
}

async function speechifyTTS(
  text: string,
  voiceId: string,
  apiKey: string,
): Promise<Uint8Array> {
  const res = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      input: sanitizeForTTS(text),
      voice_id: voiceId,
      audio_format: 'mp3',
      model: 'simba-english',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Speechify TTS error ${res.status}: ${t}`);
  }
  const data = await res.json();
  // Speechify returns base64 audio in `audio_data`
  const b64: string = data.audio_data || data.audioData;
  if (!b64) throw new Error('Speechify returned no audio_data');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Concatenate raw MP3 buffers — naive concat works for streamable MP3
function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
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
    const {
      inputType, // 'text' | 'url' | 'pdf'
      content,   // raw text, URL, or extracted PDF text
      hostAName = 'Alex',
      hostBName = 'Jordan',
      voiceA = 'george',
      voiceB = 'kristy',
      targetMinutes = 3,
    } = body || {};

    if (!inputType || !content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'inputType and content required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const speechifyKey = Deno.env.get('SPEECHIFY_API_KEY');
    if (!speechifyKey) {
      return new Response(JSON.stringify({ error: 'TTS provider not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Normalize input → text
    let sourceText = '';
    if (inputType === 'url') {
      console.log('Fetching URL content:', content);
      sourceText = await fetchUrlText(content);
    } else {
      sourceText = content;
    }
    sourceText = sourceText.trim();
    if (sourceText.length < 100) {
      return new Response(JSON.stringify({ error: 'Source content too short (min 100 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Generate dialogue
    console.log('Generating dialogue, source length:', sourceText.length);
    const dialogue = await generateDialogue(sourceText, hostAName, hostBName, targetMinutes);
    console.log('Dialogue lines:', dialogue.length);

    // 3. Render each line with Speechify
    const audioBuffers: Uint8Array[] = [];
    for (let i = 0; i < dialogue.length; i++) {
      const line = dialogue[i];
      const voice = line.speaker === 'A' ? voiceA : voiceB;
      try {
        const buf = await speechifyTTS(line.text, voice, speechifyKey);
        audioBuffers.push(buf);
      } catch (e) {
        console.error(`TTS failed on line ${i}:`, e);
        throw e;
      }
    }

    // 4. Concat + upload
    const merged = concatBuffers(audioBuffers);
    const adminClient = createClient(supabaseUrl, serviceKey);
    const fileName = `${userId}/podcast-content/${Date.now()}.mp3`;
    const { error: upErr } = await adminClient.storage
      .from('reels')
      .upload(fileName, merged, { contentType: 'audio/mpeg', upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const { data: pub } = adminClient.storage.from('reels').getPublicUrl(fileName);

    const transcript = dialogue
      .map((l) => `${l.speaker === 'A' ? hostAName : hostBName}: ${l.text}`)
      .join('\n\n');

    return new Response(
      JSON.stringify({
        audioUrl: pub.publicUrl,
        transcript,
        dialogue,
        lineCount: dialogue.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('generate-podcast-from-content error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
