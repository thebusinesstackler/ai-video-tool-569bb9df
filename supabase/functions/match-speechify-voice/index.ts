import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SpeechifyVoice {
  id: string;
  type: string;
  display_name: string;
  gender: string;
  locale: string;
  preview_audio: string | null;
  tags: string[] | null;
}

// In-memory cache for Speechify voice catalog (reset on cold start)
let cachedVoices: SpeechifyVoice[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchSpeechifyVoices(apiKey: string): Promise<SpeechifyVoice[]> {
  const now = Date.now();
  if (cachedVoices && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedVoices;
  }

  const resp = await fetch('https://api.sws.speechify.com/v1/voices', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch Speechify voices: ${resp.status}`);
  }
  const all: SpeechifyVoice[] = await resp.json();
  // Only shared (library) English voices with tags — exclude personal clones
  const filtered = all.filter(v =>
    v.type === 'shared' &&
    v.locale?.startsWith('en') &&
    Array.isArray(v.tags) &&
    v.tags.length > 0
  );
  cachedVoices = filtered;
  cacheTimestamp = now;
  console.log(`Cached ${filtered.length} Speechify shared voices`);
  return filtered;
}

function pickFallbackVoice(voices: SpeechifyVoice[], gender?: string): SpeechifyVoice | null {
  const g = (gender || '').toLowerCase();
  const isFemale = g === 'female' || g === 'woman';
  const candidates = voices.filter(v =>
    isFemale ? v.gender === 'female' : v.gender === 'male'
  );
  return (candidates[0] || voices[0]) ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const speechifyKey = Deno.env.get('SPEECHIFY_API_KEY');
    if (!speechifyKey) throw new Error('SPEECHIFY_API_KEY not configured');

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    const { characterDescription = '', gender, tone, scriptSample } = await req.json().catch(() => ({}));

    const voices = await fetchSpeechifyVoices(speechifyKey);
    if (voices.length === 0) throw new Error('No Speechify voices available');

    // Restrict pool by gender when known
    const g = (gender || '').toLowerCase();
    const isFemale = g === 'female' || g === 'woman';
    const isMale = g === 'male' || g === 'man';
    const pool = voices.filter(v => {
      if (isFemale) return v.gender === 'female';
      if (isMale) return v.gender === 'male';
      return true;
    });
    const finalPool = pool.length > 0 ? pool : voices;

    // If no Lovable AI key, fallback
    if (!lovableKey) {
      const fb = pickFallbackVoice(finalPool, gender);
      return new Response(JSON.stringify({
        voiceId: fb?.id,
        displayName: fb?.display_name,
        gender: fb?.gender,
        previewAudio: fb?.preview_audio,
        tags: fb?.tags,
        reasoning: 'fallback (no AI key)',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build a compact catalog for the AI
    const catalog = finalPool.slice(0, 60).map(v => ({
      id: v.id,
      name: v.display_name,
      gender: v.gender,
      tags: v.tags || [],
    }));

    const sysPrompt = `You are a casting director matching voiceover talent to characters. Pick the SINGLE Speechify voice ID from the catalog that best fits the character description, gender, and tone. Consider tags like age (young, middle-aged, senior), style (warm, bold, calm, energetic, conversational, authoritative), pitch (low, high), and use-case (audiobook, podcast, e-learning, advertising). Return ONLY the voice via the tool call.`;

    const userPrompt = `Character description: ${characterDescription || '(none provided)'}
Gender: ${gender || 'unspecified'}
Desired tone: ${tone || '(infer from description)'}
Script sample: ${scriptSample ? scriptSample.slice(0, 300) : '(none)'}

Available Speechify voices (pick ONE id):
${JSON.stringify(catalog, null, 2)}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'pick_voice',
            description: 'Select the best matching Speechify voice for the character.',
            parameters: {
              type: 'object',
              properties: {
                voiceId: { type: 'string', description: 'The id of the chosen voice from the catalog' },
                reasoning: { type: 'string', description: 'One sentence explaining the choice' },
              },
              required: ['voiceId', 'reasoning'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'pick_voice' } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, errText);
      const fb = pickFallbackVoice(finalPool, gender);
      return new Response(JSON.stringify({
        voiceId: fb?.id,
        displayName: fb?.display_name,
        gender: fb?.gender,
        previewAudio: fb?.preview_audio,
        tags: fb?.tags,
        reasoning: `fallback (AI error ${aiResp.status})`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let chosenId: string | undefined;
    let reasoning = '';
    try {
      const args = JSON.parse(toolCall?.function?.arguments || '{}');
      chosenId = args.voiceId;
      reasoning = args.reasoning || '';
    } catch (e) {
      console.warn('Failed to parse tool call args');
    }

    const chosen = finalPool.find(v => v.id === chosenId) || pickFallbackVoice(finalPool, gender);
    if (!chosen) throw new Error('No voice selected');

    return new Response(JSON.stringify({
      voiceId: chosen.id,
      displayName: chosen.display_name,
      gender: chosen.gender,
      previewAudio: chosen.preview_audio,
      tags: chosen.tags,
      reasoning,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('match-speechify-voice error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
