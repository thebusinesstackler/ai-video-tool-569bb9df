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

// ── Google Cloud OAuth (service-account → access token) ─────────────────────
let _gToken: { token: string; exp: number } | null = null;
function _b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') bytes = new TextEncoder().encode(input);
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function getGoogleAccessToken(): Promise<string | null> {
  const raw = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT');
  if (!raw) return null;
  if (_gToken && _gToken.exp - 60 > Math.floor(Date.now() / 1000)) return _gToken.token;
  try {
    const sa = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
    const signingInput = `${_b64url(JSON.stringify(header))}.${_b64url(JSON.stringify(payload))}`;
    const key = await crypto.subtle.importKey('pkcs8', _pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
    const jwt = `${signingInput}.${_b64url(sig)}`;
    const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
    if (!resp.ok) { console.error('Google OAuth failed', resp.status, await resp.text()); return null; }
    const data = await resp.json();
    _gToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
    return _gToken.token;
  } catch (e) { console.error('Google OAuth exception', e); return null; }
}


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
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`Speechify ${voiceId} → ${response.status}: ${errText.substring(0, 200)}`);
      return null;
    }

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

async function generateClonedVoiceTTS(
  text: string,
  apiKey: string,
  voiceCloningKey: string,
  speed: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  // (unchanged below — see original implementation)
  return _origGoogleClonedVoiceTTS(text, apiKey, voiceCloningKey, speed);
}

// ── WaveSpeed Gemini 2.5 Pro TTS (single-speaker) ───────────────────────────
// Same provider used by Movie Scene Creator. Plenty of credits, no per-user billing.
const MALE_GEMINI_VOICES = ['Charon', 'Fenrir', 'Puck', 'Orus', 'Enceladus', 'Iapetus'];
const FEMALE_GEMINI_VOICES = ['Kore', 'Aoede', 'Zephyr', 'Leda', 'Despina', 'Callirrhoe'];

async function pollWaveSpeedResult(taskId: string, apiKey: string): Promise<string | null> {
  const start = Date.now();
  for (let i = 0; i < 90; i++) {
    if (Date.now() - start > 90_000) return null;
    try {
      const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code === 200 && data.data) {
          if (data.data.status === 'completed' || data.data.status === 'succeeded') {
            return data.data.outputs?.[0] || null;
          }
          if (data.data.status === 'failed') return null;
        }
      }
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

async function generateWavespeedGeminiTTS(
  text: string,
  apiKey: string,
  gender?: string,
  voiceSeed?: string,
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    const genderLower = (gender || '').toLowerCase();
    const isFemale = genderLower === 'female' || genderLower === 'woman';
    const pool = isFemale ? FEMALE_GEMINI_VOICES : MALE_GEMINI_VOICES;
    // Deterministic voice selection: same seed → same voice across all scenes
    let idx = 0;
    if (voiceSeed) {
      let h = 0;
      for (let i = 0; i < voiceSeed.length; i++) h = ((h << 5) - h + voiceSeed.charCodeAt(i)) | 0;
      idx = Math.abs(h) % pool.length;
    }
    const voiceName = pool[idx];
    const scriptText = `Narrator: ${text}`;
    console.log(`WaveSpeed Gemini TTS → voice ${voiceName}`);

    const res = await fetch('https://api.wavespeed.ai/api/v3/google/gemini-2.5-pro/text-to-speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: scriptText,
        language: 'English (United States)',
        speakers: [{ speaker: 'Narrator', voice: voiceName }],
      }),
    });
    if (!res.ok) {
      console.error(`WaveSpeed Gemini TTS error ${res.status}: ${(await res.text()).substring(0, 300)}`);
      return null;
    }
    const data = await res.json();
    if (data.code !== 200 || !data.data?.id) return null;

    const audioUrl = await pollWaveSpeedResult(data.data.id, apiKey);
    if (!audioUrl) return null;

    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) return null;
    const buf = new Uint8Array(await audioResp.arrayBuffer());
    let binary = '';
    const CHUNK = 32768;
    for (let i = 0; i < buf.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)));
    }
    const base64Audio = btoa(binary);
    return { audioContent: base64Audio, audioUrl: `data:audio/mp3;base64,${base64Audio}` };
  } catch (e) {
    console.error('WaveSpeed Gemini TTS exception:', e);
    return null;
  }
}

async function _origGoogleClonedVoiceTTS(
  text: string,
  apiKey: string,
  voiceCloningKey: string,
  speed: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
          voice: {
            languageCode: 'en-US',
            name: voiceCloningKey,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speed,
          },
        }),
      }
    );
    if (!response.ok) {
      console.error('Google cloned voice error:', response.status, await response.text());
      return null;
    }
    const data = await response.json();
    if (!data.audioContent) return null;
    return { audioContent: data.audioContent, audioUrl: `data:audio/mp3;base64,${data.audioContent}` };
  } catch (e) {
    console.error('Google cloned voice exception:', e);
    return null;
  }
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

    const { text: rawText, voice = 'ai-auto', speed = 1, pitch: rawPitch = 0, voiceCloningKey, speechifyVoiceId, gender, voiceSeed } = await req.json();

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
    const wavespeedApiKey = Deno.env.get('WAVESPEED_API_KEY');

    // Priority 1: Speechify cloned voice
    if (speechifyVoiceId && speechifyApiKey) {
      const result = await generateSpeechifyTTS(text, speechifyApiKey, speechifyVoiceId, validatedSpeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: true, provider: 'speechify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Priority 2: Google Cloud cloned voice
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

    // Priority 3: WaveSpeed Gemini 2.5 Pro TTS — same provider as Movie Scene Creator
    if (wavespeedApiKey) {
      const result = await generateWavespeedGeminiTTS(text, wavespeedApiKey, gender, voiceSeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: false, provider: 'wavespeed-gemini' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log('WaveSpeed Gemini TTS failed, falling through to other providers');
    }

    // Priority 3: Google Chirp3-HD fallback via OAuth service account
    const tryChirp3 = async () => {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) return null;
      const genderLower = (gender || '').toLowerCase();
      const isFemale = genderLower === 'female' || genderLower === 'woman';
      const voiceName = isFemale ? 'en-US-Chirp3-HD-Aoede' : 'en-US-Chirp3-HD-Charon';
      try {
        const sa = JSON.parse(Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT') || '{}');
        const resp = await fetch(
          'https://texttospeech.googleapis.com/v1beta1/text:synthesize',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              ...(sa.project_id ? { 'x-goog-user-project': sa.project_id } : {}),
            },
            body: JSON.stringify({
              input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
              voice: { languageCode: 'en-US', name: voiceName },
              audioConfig: { audioEncoding: 'MP3', speakingRate: validatedSpeed },
            }),
          }
        );
        if (!resp.ok) {
          console.error('Chirp3 error:', resp.status, await resp.text());
          return null;
        }
        const data = await resp.json();
        if (!data.audioContent) return null;
        return { audioContent: data.audioContent, audioUrl: `data:audio/mp3;base64,${data.audioContent}` };
      } catch (e) {
        console.error('Chirp3 exception:', e);
        return null;
      }
    };

    // Priority 4: OpenAI TTS for non-cloned voices (clear, natural speech)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiApiKey) {
      // Map legacy WaveSpeed/MiniMax voice IDs to valid OpenAI voices
      const wavespeedToOpenAI: Record<string, string> = {
        'English_magnetic_voiced_man': 'onyx',
        'English_Trustworth_Man': 'echo',
        'Deep_Voice_Man': 'ash',
        'Casual_Guy': 'echo',
        'Determined_Man': 'onyx',
        'English_expressive_narrator': 'ash',
        'English_compelling_lady1': 'nova',
        'English_radiant_girl': 'shimmer',
        'Calm_Woman': 'coral',
        'Inspirational_girl': 'nova',
        'Lively_Girl': 'shimmer',
      };
      
      const genderLower = (gender || '').toLowerCase();
      const isFemale = genderLower === 'female' || genderLower === 'woman';
      const maleVoices = ['onyx', 'echo', 'ash'];
      const femaleVoices = ['nova', 'shimmer', 'coral'];
      const validOpenAIVoices = [...maleVoices, ...femaleVoices, 'alloy', 'fable', 'verse', 'ballad', 'sage', 'marin', 'cedar'];
      const voicePool = isFemale ? femaleVoices : maleVoices;
      
      let selectedVoice: string;
      if (voice === 'ai-auto') {
        selectedVoice = voicePool[Math.floor(Math.random() * voicePool.length)];
      } else if (wavespeedToOpenAI[voice]) {
        selectedVoice = wavespeedToOpenAI[voice];
      } else if (validOpenAIVoices.includes(voice)) {
        selectedVoice = voice;
      } else {
        // Unknown voice ID — fallback to gender-based selection
        selectedVoice = voicePool[Math.floor(Math.random() * voicePool.length)];
      }
      
      console.log(`Using OpenAI TTS with voice: ${selectedVoice}`);
      const result = await generateOpenAITTS(text, openaiApiKey, selectedVoice, validatedSpeed);
      if (result) {
        return new Response(JSON.stringify({ ...result, isClonedVoice: false, provider: 'openai' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.log('OpenAI TTS failed, trying Chirp3-HD fallback');
    }

    // Google Cloud TTS via API key (uses billing-enabled project tied to key) — try BEFORE OAuth Chirp3
    const googleFallbackKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    if (googleFallbackKey) {
      const genderLower = (gender || '').toLowerCase();
      const isFemale = genderLower === 'female' || genderLower === 'woman';
      const voiceCandidates = isFemale
        ? ['en-US-Chirp3-HD-Aoede', 'en-US-Studio-O', 'en-US-Neural2-F']
        : ['en-US-Chirp3-HD-Charon', 'en-US-Studio-Q', 'en-US-Neural2-D'];
      for (const voiceName of voiceCandidates) {
        try {
          console.log(`Using Google Cloud TTS (api-key) with voice: ${voiceName}`);
          const gResp = await fetch(
            `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${googleFallbackKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
                voice: { languageCode: 'en-US', name: voiceName },
                audioConfig: { audioEncoding: 'MP3', speakingRate: validatedSpeed },
              }),
            }
          );
          if (gResp.ok) {
            const gData = await gResp.json();
            if (gData.audioContent) {
              return new Response(JSON.stringify({
                audioContent: gData.audioContent,
                audioUrl: `data:audio/mp3;base64,${gData.audioContent}`,
                isClonedVoice: false,
                provider: 'google-apikey',
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } else {
            console.warn(`Google TTS voice ${voiceName} → ${gResp.status}: ${(await gResp.text()).substring(0, 200)}`);
          }
        } catch (e) {
          console.error('Google TTS api-key exception:', e);
        }
      }
    }

    // OAuth Chirp3-HD fallback (requires service-account project to have billing enabled)
    const chirp3Result = await tryChirp3();
    if (chirp3Result) {
      return new Response(JSON.stringify({ ...chirp3Result, isClonedVoice: false, provider: 'chirp3' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Last-resort: Speechify generic public voice (works even with no twin / no cloned voice)
    if (speechifyApiKey) {
      const genderLower = (gender || '').toLowerCase();
      const isFemale = genderLower === 'female' || genderLower === 'woman';
      const speechifyDefaults = isFemale
        ? ['lisa', 'monica', 'kate']
        : ['henry', 'ben', 'george'];
      for (const vId of speechifyDefaults) {
        console.log(`Speechify fallback with voice: ${vId}`);
        const result = await generateSpeechifyTTS(text, speechifyApiKey, vId, validatedSpeed);
        if (result) {
          return new Response(JSON.stringify({ ...result, isClonedVoice: false, provider: 'speechify-fallback' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    throw new Error('All TTS providers failed (OpenAI quota / Google billing / Speechify). Your draft is saved — try again shortly.');
    
  } catch (error) {
    console.error('TTS error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
