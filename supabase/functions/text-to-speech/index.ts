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

// WaveSpeed MiniMax voice IDs
const WAVESPEED_VOICES = [
  'English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl',
  'English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man',
  'English_expressive_narrator', 'English_Aussie_Bloke', 'Elegant_Man', 'Lovely_Girl',
  'Determined_Man', 'Patient_Man', 'Lively_Girl', 'Wise_Woman', 'Decent_Boy',
];

// Gender mapping for AI auto-select
const MALE_VOICES = ['English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man'];
const FEMALE_VOICES = ['English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl'];

function isWaveSpeedVoice(voice: string): boolean {
  return WAVESPEED_VOICES.includes(voice);
}

// Legacy Google mapping for cloned voice support
interface VoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE';
}

const GOOGLE_VOICES: Record<string, VoiceConfig> = {
  'en-US-Studio-O': { languageCode: 'en-US', name: 'en-US-Studio-O', ssmlGender: 'FEMALE' },
  'en-US-Studio-M': { languageCode: 'en-US', name: 'en-US-Studio-M', ssmlGender: 'MALE' },
  'en-US-Studio-Q': { languageCode: 'en-US', name: 'en-US-Studio-Q', ssmlGender: 'MALE' },
  'en-US-Neural2-A': { languageCode: 'en-US', name: 'en-US-Neural2-A', ssmlGender: 'MALE' },
  'en-US-Neural2-C': { languageCode: 'en-US', name: 'en-US-Neural2-C', ssmlGender: 'FEMALE' },
};

async function generateClonedVoiceTTS(
  text: string,
  apiKey: string,
  voiceCloningKey: string,
  speakingRate: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: 'en-US',
          voiceClone: { voiceCloningKey }
        },
        audioConfig: { audioEncoding: 'MP3', speakingRate, pitch: 0 },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.audioContent) {
      return { audioContent: data.audioContent, audioUrl: `data:audio/mp3;base64,${data.audioContent}` };
    }
    return null;
  } catch { return null; }
}

async function pollWaveSpeedTTSResult(taskId: string, apiKey: string, maxAttempts: number = 60): Promise<string | null> {
  const timeout = 90_000; // 90 second total timeout
  const startTime = Date.now();
  for (let i = 0; i < maxAttempts; i++) {
    if (Date.now() - startTime > timeout) {
      console.error(`WaveSpeed TTS polling timed out after ${timeout}ms`);
      return null;
    }
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);
      if (!response.ok) { await new Promise(r => setTimeout(r, 1000)); continue; }
      const data = await response.json();
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          return data.data.outputs?.[0] || null;
        } else if (data.data.status === 'failed') return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        console.warn('WaveSpeed poll request timed out, retrying...');
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function generateWaveSpeedTTS(
  text: string,
  apiKey: string,
  voiceId: string = 'English_Trustworth_Man',
  speed: number = 1,
  emotion: string = 'neutral',
  pitch: number = 0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log(`Generating TTS with WaveSpeed MiniMax voice: ${voiceId}`);
    
    const ttsResponse = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.length > 10000 ? text.substring(0, 10000) : text,
        voice_id: voiceId,
        speed,
        volume: 1,
        pitch,
        emotion,
        english_normalization: true
      }),
    });

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error('WaveSpeed TTS error:', ttsResponse.status, errText);
      return null;
    }

    const ttsData = await ttsResponse.json();
    if (ttsData.code !== 200 || !ttsData.data?.id) return null;

    const audioUrl = await pollWaveSpeedTTSResult(ttsData.data.id, apiKey);
    if (!audioUrl) return null;

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) return null;

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);
    
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    return { audioContent: base64Audio, audioUrl: `data:audio/mp3;base64,${base64Audio}` };
  } catch (error) {
    console.error('WaveSpeed TTS error:', error);
    return null;
  }
}

async function generateSpeechifyTTS(
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

    const { text: rawText, voice = 'English_Trustworth_Man', speed = 1, pitch: rawPitch = 0, voiceCloningKey, speechifyVoiceId, gender } = await req.json();

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

    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');

    // Priority 1: Speechify cloned voice
    if (speechifyVoiceId && speechifyApiKey) {
      const result = await generateSpeechifyTTS(text, speechifyApiKey, speechifyVoiceId, validatedSpeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: true, provider: 'speechify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    // Priority 2: Google Cloud cloned voice
    if (voiceCloningKey && googleApiKey) {
      const result = await generateClonedVoiceTTS(text, googleApiKey, voiceCloningKey, validatedSpeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: true, provider: 'google' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    // Priority 3: WaveSpeed MiniMax HD (primary for standard voices)
    if (waveSpeedApiKey) {
      // Resolve AI auto-select or legacy Google voice IDs
      let resolvedVoice = voice;
      
      if (voice === 'ai-auto') {
        // Pick based on gender hint or default to male
        if (gender === 'female') {
          resolvedVoice = FEMALE_VOICES[Math.floor(Math.random() * FEMALE_VOICES.length)];
        } else {
          resolvedVoice = MALE_VOICES[Math.floor(Math.random() * MALE_VOICES.length)];
        }
      } else if (voice.startsWith('en-')) {
        // Map legacy Google voice IDs to WaveSpeed equivalents
        if (voice.includes('-F') || voice.includes('-O')) {
          resolvedVoice = 'English_compelling_lady1';
        } else {
          resolvedVoice = 'English_Trustworth_Man';
        }
      } else if (!WAVESPEED_VOICES.includes(voice)) {
        // Unknown voice ID — fall back to default
        console.warn(`Unknown voice ID "${voice}", falling back to English_Trustworth_Man`);
        resolvedVoice = 'English_Trustworth_Man';
      }
      
      const result = await generateWaveSpeedTTS(text, waveSpeedApiKey, resolvedVoice, validatedSpeed, 'neutral', validatedPitch);
      if (result) {
        return new Response(JSON.stringify({ ...result, provider: 'wavespeed', voiceUsed: resolvedVoice }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    
    // Fallback: Google Cloud TTS (only if voice was explicitly a Google voice)
    if (googleApiKey && voice.startsWith('en-') && GOOGLE_VOICES[voice]) {
      const voiceConfig = GOOGLE_VOICES[voice];
      
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
          voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name, ssmlGender: voiceConfig.ssmlGender },
          audioConfig: { audioEncoding: 'MP3', speakingRate: validatedSpeed, pitch: validatedPitch, effectsProfileId: ['headphone-class-device'] }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioContent) {
          return new Response(JSON.stringify({ audioContent: data.audioContent, audioUrl: `data:audio/mp3;base64,${data.audioContent}`, provider: 'google-fallback' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
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
