import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_TEXT_LENGTH = 10000;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2.0;

// ── TTS Text Sanitizer ──────────────────────────────────────────────────────
// Prevents em-dashes, ellipses, and other punctuation from causing
// 4-second silences or unnatural pauses in generated voiceovers.
function sanitizeForTTS(text: string): string {
  if (!text) return '';
  let c = text;
  c = c.replace(/\([^)]*\)/g, '');
  c = c.replace(/\[[^\]]*\]/g, '');
  c = c.replace(/\*[^*]*\*/g, '');
  c = c.replace(/—/g, ', ');
  c = c.replace(/–/g, ', ');
  c = c.replace(/--/g, ', ');
  c = c.replace(/…/g, '.');
  c = c.replace(/\.{2,}/g, '.');
  c = c.replace(/[""]/g, '"');
  c = c.replace(/['']/g, "'");
  c = c.replace(/;/g, ',');
  c = c.replace(/:(?!\d)/g, ',');
  c = c.replace(/(\b\w+\b)\s+\1\b/gi, '$1');
  c = c.replace(/,([A-Za-z])/g, ', $1');
  c = c.replace(/,{2,}/g, ',');
  c = c.replace(/\.{2,}/g, '.');
  c = c.replace(/,\s*\./g, '.');
  c = c.replace(/\s+/g, ' ').trim();
  return c;
}

// WaveSpeed MiniMax TTS removed — Sora-2 native audio used for non-cloned voices

async function generateOpenAITTS(
  text: string,
  apiKey: string,
  voice: string = 'nova',
  speed: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: text.length > 4096 ? text.substring(0, 4096) : text,
        voice: voice,
        response_format: 'mp3',
        speed: speed,
      }),
    });
    if (!response.ok) {
      console.error('OpenAI TTS error:', response.status, await response.text());
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);
    return { audioContent: base64Audio, audioUrl: `data:audio/mp3;base64,${base64Audio}` };
  } catch (e) {
    console.error('OpenAI TTS exception:', e);
    return null;
  }
}

  text: string,
  apiKey: string,
  voiceId: string,
  speed: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    const response = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text.length > 5000 ? text.substring(0, 5000) : text,
        voice_id: voiceId,
        audio_format: 'mp3'
      }),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    let base64Audio: string;
    
    if (contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      if (jsonResponse.audio_data) base64Audio = jsonResponse.audio_data;
      else return null;
    } else {
      const audioBuffer = await response.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);
      let binary = '';
      const chunkSize = 32768;
      for (let i = 0; i < audioBytes.length; i += chunkSize) {
        const chunk = audioBytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64Audio = btoa(binary);
    }

    return { audioContent: base64Audio, audioUrl: `data:audio/mp3;base64,${base64Audio}` };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { text: rawText, voice = 'ai-auto', speed = 1, pitch: rawPitch = 0, voiceCloningKey, speechifyVoiceId, gender } = await req.json();

    // Sanitize text before any TTS engine sees it
    const text = sanitizeForTTS(rawText);

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validatedSpeed = typeof speed === 'number' ? Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed)) : 1.0;
    const validatedPitch = typeof rawPitch === 'number' ? Math.max(-10, Math.min(10, rawPitch)) : 0;

    console.log(`TTS request - Voice: ${voice}, Pitch: ${validatedPitch}, Text length: ${text.length}`);

    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');

    // Priority 1: Speechify cloned voice
    if (speechifyVoiceId && speechifyApiKey) {
      const result = await generateSpeechifyTTS(text, speechifyApiKey, speechifyVoiceId, validatedSpeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: true, provider: 'speechify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    // Priority 2: Google Cloud cloned voice (cloning only, not standard voices)
    if (voiceCloningKey) {
      const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
      if (googleApiKey) {
        const result = await generateClonedVoiceTTS(text, googleApiKey, voiceCloningKey, validatedSpeed);
        if (result) {
          return new Response(JSON.stringify({ ...result, isClonedVoice: true, provider: 'google' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }
    
    // Priority 3: OpenAI TTS for non-cloned voices (clear, natural speech)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiApiKey) {
      // Map gender to voice selection
      const genderLower = (gender || '').toLowerCase();
      const isFemale = genderLower === 'female' || genderLower === 'woman';
      const maleVoices = ['onyx', 'echo', 'ash'];
      const femaleVoices = ['nova', 'shimmer', 'coral'];
      const voicePool = isFemale ? femaleVoices : maleVoices;
      const selectedVoice = voice === 'ai-auto'
        ? voicePool[Math.floor(Math.random() * voicePool.length)]
        : voice;
      
      console.log(`Using OpenAI TTS with voice: ${selectedVoice}`);
      const result = await generateOpenAITTS(text, openaiApiKey, selectedVoice, validatedSpeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: false, provider: 'openai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    throw new Error('No TTS engine available or all attempts failed');
    
  } catch (error) {
    console.error('TTS error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
