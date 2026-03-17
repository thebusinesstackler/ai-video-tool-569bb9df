import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DialogueLine {
  character: string;
  line: string;
  emotion?: string;
}

interface VoiceAssignment {
  characterName: string;
  voiceCloningKey?: string;
  speechifyVoiceId?: string;
  defaultVoice?: string;
  gender?: string;
  voiceEngine?: string;
  googleVoiceId?: string;
}

interface MultiVoiceTTSRequest {
  dialogue: DialogueLine[];
  voiceAssignments: VoiceAssignment[];
}

// WaveSpeed MiniMax voices by gender
const MALE_WAVESPEED_VOICES = ['English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man', 'Determined_Man', 'Elegant_Man'];
const FEMALE_WAVESPEED_VOICES = ['English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl', 'Lively_Girl', 'Lovely_Girl'];

// ── WaveSpeed MiniMax TTS ──────────────────────────────────────────
async function pollWaveSpeedResult(taskId: string, apiKey: string): Promise<string | null> {
  const timeout = 90_000;
  const startTime = Date.now();
  for (let i = 0; i < 60; i++) {
    if (Date.now() - startTime > timeout) return null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok) { await new Promise(r => setTimeout(r, 1000)); continue; }
      const data = await res.json();
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          return data.data.outputs?.[0] || null;
        }
        if (data.data.status === 'failed') return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function generateWaveSpeedTTS(
  text: string,
  apiKey: string,
  voiceId: string,
): Promise<Uint8Array | null> {
  try {
    console.log(`WaveSpeed MiniMax TTS: voice=${voiceId}, text="${text.substring(0, 50)}..."`);
    const res = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.length > 10000 ? text.substring(0, 10000) : text,
        voice_id: voiceId,
        speed: 1,
        volume: 1,
        pitch: 0,
        emotion: 'neutral',
        english_normalization: true,
      }),
    });
    if (!res.ok) { console.error('WaveSpeed TTS error:', res.status); return null; }
    const data = await res.json();
    if (data.code !== 200 || !data.data?.id) return null;

    const audioUrl = await pollWaveSpeedResult(data.data.id, apiKey);
    if (!audioUrl) return null;

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return null;
    return new Uint8Array(await audioRes.arrayBuffer());
  } catch (e) {
    console.error('WaveSpeed TTS error:', e);
    return null;
  }
}

// ── Google Cloud TTS (cloned voice) ────────────────────────────────
async function generateClonedVoiceTTS(
  text: string, apiKey: string, voiceCloningKey: string
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.substring(0, 5000) },
        voice: { languageCode: 'en-US', voiceClone: { voiceCloningKey } },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioContent) return null;
    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

// ── Google Cloud TTS (standard voice) ──────────────────────────────
async function generateGoogleTTS(
  text: string, apiKey: string, voiceName: string
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.substring(0, 5000) },
        voice: {
          languageCode: 'en-US',
          name: voiceName,
          ssmlGender: voiceName.includes('-F') || voiceName.includes('-O') || voiceName.includes('-C') ? 'FEMALE' : 'MALE',
        },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0, effectsProfileId: ['headphone-class-device'] },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.audioContent) return null;
    const bin = atob(data.audioContent);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

// ── Speechify TTS ──────────────────────────────────────────────────
async function generateSpeechifyTTS(
  text: string, apiKey: string, voiceId: string
): Promise<Uint8Array | null> {
  try {
    const res = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text.substring(0, 5000), voice_id: voiceId, audio_format: 'mp3' }),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json();
      if (!json.audio_data) return null;
      const bin = atob(json.audio_data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } else {
      return new Uint8Array(await res.arrayBuffer());
    }
  } catch { return null; }
}

// ── Silence generator ──────────────────────────────────────────────
function generateSilence(durationMs: number = 300): Uint8Array {
  const frameCount = Math.ceil(durationMs / 26);
  const frame = new Uint8Array([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const result = new Uint8Array(frame.length * frameCount);
  for (let i = 0; i < frameCount; i++) result.set(frame, i * frame.length);
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dialogue, voiceAssignments } = await req.json() as MultiVoiceTTSRequest;

    if (!dialogue || !Array.isArray(dialogue) || dialogue.length === 0) {
      throw new Error('Dialogue array is required');
    }

    console.log(`Processing ${dialogue.length} lines with ${voiceAssignments?.length || 0} voice assignments`);

    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');

    // Build character → voice assignment map
    const voiceMap = new Map<string, VoiceAssignment>();
    if (voiceAssignments) {
      for (const a of voiceAssignments) voiceMap.set(a.characterName.toLowerCase(), a);
    }

    // Track which WaveSpeed voice each unassigned character gets (deterministic per-character)
    const assignedWaveSpeedVoices = new Map<string, string>();
    let maleIdx = 0;
    let femaleIdx = 0;

    function pickWaveSpeedVoice(charLower: string, gender: string): string {
      const existing = assignedWaveSpeedVoices.get(charLower);
      if (existing) return existing;
      let voice: string;
      if (gender === 'female') {
        voice = FEMALE_WAVESPEED_VOICES[femaleIdx % FEMALE_WAVESPEED_VOICES.length];
        femaleIdx++;
      } else {
        voice = MALE_WAVESPEED_VOICES[maleIdx % MALE_WAVESPEED_VOICES.length];
        maleIdx++;
      }
      assignedWaveSpeedVoices.set(charLower, voice);
      console.log(`Assigned WaveSpeed voice "${voice}" to character "${charLower}" (gender: ${gender})`);
      return voice;
    }

    const audioBuffers: Uint8Array[] = [];
    const silence = generateSilence(400);

    for (let i = 0; i < dialogue.length; i++) {
      const line = dialogue[i];
      const charLower = line.character.toLowerCase();

      // Clean text
      let text = line.line
        .replace(/\([^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\*[^*]*\*/g, '')
        .replace(/^[A-Z][a-zA-Z\s]*:\s*/i, '')
        .trim();
      if (!text) continue;

      let audioData: Uint8Array | null = null;
      const assignment = voiceMap.get(charLower);

      if (assignment) {
        // Priority 1: Speechify cloned voice
        if (assignment.speechifyVoiceId && speechifyApiKey) {
          audioData = await generateSpeechifyTTS(text, speechifyApiKey, assignment.speechifyVoiceId);
        }
        // Priority 2: Google cloned voice
        if (!audioData && assignment.voiceCloningKey && googleApiKey) {
          audioData = await generateClonedVoiceTTS(text, googleApiKey, assignment.voiceCloningKey);
        }
        // Priority 3: Google Cloud TTS engine with specific voice
        if (!audioData && assignment.voiceEngine === 'google-cloud' && assignment.googleVoiceId && googleApiKey) {
          audioData = await generateGoogleTTS(text, googleApiKey, assignment.googleVoiceId);
        }
        // Priority 4: WaveSpeed gender-appropriate voice
        if (!audioData && waveSpeedApiKey) {
          const wsVoice = pickWaveSpeedVoice(charLower, assignment.gender || 'male');
          audioData = await generateWaveSpeedTTS(text, waveSpeedApiKey, wsVoice);
        }
      }

      // No assignment at all → WaveSpeed with default male
      if (!audioData && waveSpeedApiKey) {
        const wsVoice = pickWaveSpeedVoice(charLower, 'male');
        audioData = await generateWaveSpeedTTS(text, waveSpeedApiKey, wsVoice);
      }

      // Last resort: Google standard voice
      if (!audioData && googleApiKey) {
        audioData = await generateGoogleTTS(text, googleApiKey, 'en-US-Journey-D');
      }

      if (audioData) {
        audioBuffers.push(audioData);
        if (i < dialogue.length - 1) audioBuffers.push(silence);
        console.log(`✓ Audio for ${line.character}: "${text.substring(0, 30)}..."`);
      } else {
        console.error(`✗ Failed audio for ${line.character}`);
      }
    }

    if (audioBuffers.length === 0) throw new Error('Failed to generate any audio');

    // Merge buffers
    const totalLength = audioBuffers.reduce((a, b) => a + b.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) { merged.set(buf, offset); offset += buf.length; }

    // Base64 encode
    let binary = '';
    const chunk = 32768;
    for (let i = 0; i < merged.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(merged.subarray(i, i + chunk)));
    }
    const base64 = btoa(binary);

    return new Response(
      JSON.stringify({ audioContent: base64, audioUrl: `data:audio/mp3;base64,${base64}`, lineCount: dialogue.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Multi-voice TTS error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
