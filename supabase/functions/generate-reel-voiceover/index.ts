import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// WaveSpeed MiniMax voice IDs mapped from legacy OpenAI voice names
const VOICE_MAP: Record<string, string> = {
  'nova': 'English_compelling_lady1',
  'alloy': 'English_Trustworth_Man',
  'echo': 'Deep_Voice_Man',
  'fable': 'English_magnetic_voiced_man',
  'onyx': 'Casual_Guy',
  'shimmer': 'English_radiant_girl',
};

// Direct WaveSpeed voice IDs pass through
const WAVESPEED_VOICES = [
  'English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl',
  'English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man',
  'English_expressive_narrator',
];

const MALE_VOICES = ['English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man'];
const FEMALE_VOICES = ['English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl'];

function cleanTextForTTS(text: string): string {
  return text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .replace(/\.(\s|$)/g, '—$1')
    .replace(/–/g, '—')
    .replace(/\s+/g, ' ')
    .replace(/(\b\w+\b)\s+\1\b/gi, '$1')
    .replace(/,([A-Za-z])/g, ', $1')
    .trim();
}

async function pollWaveSpeedResult(taskId: string, apiKey: string, maxAttempts: number = 60): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) { await new Promise(r => setTimeout(r, 1000)); continue; }
      const data = await response.json();
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          return data.data.outputs?.[0] || null;
        } else if (data.data.status === 'failed') return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  return null;
}

async function generateWaveSpeedTTS(text: string, voiceId: string, apiKey: string, gender?: string): Promise<string> {
  console.log(`Generating voiceover with WaveSpeed MiniMax voice: ${voiceId}, gender: ${gender || 'unknown'}`);
  
  // Adjust speed and emotion based on gender and voice for natural delivery
  const isFemale = FEMALE_VOICES.includes(voiceId) || gender === 'female';
  const speed = isFemale ? 0.95 : 0.92; // Slightly slower for gravitas, natural pace for female
  const pitch = isFemale ? 2 : -1; // Subtle pitch adjustment for warmth
  const emotion = 'happy'; // 'happy' gives a more engaged, natural delivery vs flat 'neutral'
  
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
    throw new Error(`WaveSpeed TTS error: ${ttsResponse.status}`);
  }

  const ttsData = await ttsResponse.json();
  if (ttsData.code !== 200 || !ttsData.data?.id) {
    throw new Error('WaveSpeed TTS task creation failed');
  }

  const audioUrl = await pollWaveSpeedResult(ttsData.data.id, apiKey);
  if (!audioUrl) throw new Error('WaveSpeed TTS polling failed');

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error('Failed to download WaveSpeed audio');

  const arrayBuffer = await audioResponse.arrayBuffer();
  return base64Encode(arrayBuffer);
}

// Google Cloud TTS voice mapping (fallback)
const GOOGLE_VOICES: Record<string, { name: string; languageCode: string }> = {
  'English_compelling_lady1': { name: 'en-US-Journey-F', languageCode: 'en-US' },
  'English_radiant_girl': { name: 'en-US-Journey-F', languageCode: 'en-US' },
  'English_magnetic_voiced_man': { name: 'en-US-Journey-D', languageCode: 'en-US' },
  'English_Trustworth_Man': { name: 'en-US-Journey-D', languageCode: 'en-US' },
  'nova': { name: 'en-US-Journey-F', languageCode: 'en-US' },
  'alloy': { name: 'en-US-Journey-D', languageCode: 'en-US' },
};

async function generateGoogleTTS(text: string, voice: string, apiKey: string): Promise<string> {
  const voiceConfig = GOOGLE_VOICES[voice] || { name: 'en-US-Journey-D', languageCode: 'en-US' };
  
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: voiceConfig.languageCode, name: voiceConfig.name },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google TTS error: ${response.status}`);
  }

  const data = await response.json();
  return data.audioContent;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'English_Trustworth_Man', sceneNumber, gender } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanedText = cleanTextForTTS(text);
    console.log('Generating voiceover for scene:', sceneNumber, 'with voice:', voice);

    // Resolve voice ID
    let resolvedVoice = voice;
    if (voice === 'ai-auto') {
      if (gender === 'female') {
        resolvedVoice = FEMALE_VOICES[Math.floor(Math.random() * FEMALE_VOICES.length)];
      } else {
        resolvedVoice = MALE_VOICES[Math.floor(Math.random() * MALE_VOICES.length)];
      }
    } else if (VOICE_MAP[voice]) {
      resolvedVoice = VOICE_MAP[voice];
    } else if (voice.startsWith('en-')) {
      // Legacy Google voice ID
      resolvedVoice = voice.includes('-F') || voice.includes('-O') ? 'English_compelling_lady1' : 'English_Trustworth_Man';
    }

    // Try WaveSpeed MiniMax HD first (best quality)
    const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
    
    if (WAVESPEED_API_KEY) {
      try {
        const base64Audio = await generateWaveSpeedTTS(cleanedText, resolvedVoice, WAVESPEED_API_KEY, gender);
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        
        console.log('Voiceover generated with WaveSpeed MiniMax for scene:', sceneNumber);
        
        return new Response(
          JSON.stringify({ audioUrl, sceneNumber, provider: 'wavespeed', voiceUsed: resolvedVoice }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (wsError) {
        console.error('WaveSpeed TTS failed, falling back to Google:', wsError);
      }
    }

    // Fallback to Google Cloud TTS
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    if (GOOGLE_API_KEY) {
      try {
        const base64Audio = await generateGoogleTTS(cleanedText, resolvedVoice, GOOGLE_API_KEY);
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        
        console.log('Voiceover generated with Google TTS for scene:', sceneNumber);
        
        return new Response(
          JSON.stringify({ audioUrl, sceneNumber, provider: 'google-fallback' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (googleError) {
        console.error('Google TTS also failed:', googleError);
        throw googleError;
      }
    }

    console.error('No TTS API key configured');
    return new Response(
      JSON.stringify({ error: 'No TTS API configured.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating voiceover:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate voiceover' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
