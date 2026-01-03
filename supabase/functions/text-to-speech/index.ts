import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation limits
const MAX_TEXT_LENGTH = 10000;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2.0;

// Voice configuration mapping
interface VoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE';
}

const GOOGLE_VOICES: Record<string, VoiceConfig> = {
  'en-US-Journey-F': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' },
  'en-US-Neural2-F': { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  'en-US-Studio-O': { languageCode: 'en-US', name: 'en-US-Studio-O', ssmlGender: 'FEMALE' },
  'en-GB-Neural2-F': { languageCode: 'en-GB', name: 'en-GB-Neural2-F', ssmlGender: 'FEMALE' },
  'en-US-Journey-D': { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' },
  'en-US-Neural2-D': { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
  'en-US-Studio-Q': { languageCode: 'en-US', name: 'en-US-Studio-Q', ssmlGender: 'MALE' },
  'en-GB-Neural2-D': { languageCode: 'en-GB', name: 'en-GB-Neural2-D', ssmlGender: 'MALE' },
};

const DEFAULT_VOICE: VoiceConfig = { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' };

async function generateClonedVoiceTTS(
  text: string,
  apiKey: string,
  voiceCloningKey: string,
  speakingRate: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Generating TTS with Google Cloud cloned voice');

    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: 'en-US',
          voiceClone: { voiceCloningKey: voiceCloningKey }
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speakingRate,
          pitch: 0,
        },
      }),
    });

    if (!response.ok) {
      console.error('Google Cloud cloned voice TTS error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      return {
        audioContent: data.audioContent,
        audioUrl: `data:audio/mp3;base64,${data.audioContent}`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Cloned voice TTS error:', error);
    return null;
  }
}

async function generateGoogleTTS(
  text: string, 
  apiKey: string, 
  voiceConfig: VoiceConfig,
  speakingRate: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log(`Generating TTS with Google Cloud TTS using voice: ${voiceConfig.name}`);
    
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speakingRate,
          pitch: 0,
          effectsProfileId: ['headphone-class-device']
        }
      }),
    });

    if (!response.ok) {
      console.error('Google TTS error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      return {
        audioContent: data.audioContent,
        audioUrl: `data:audio/mp3;base64,${data.audioContent}`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Google TTS error:', error);
    return null;
  }
}

async function pollWaveSpeedTTSResult(taskId: string, apiKey: string, maxAttempts: number = 60): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          return data.data.outputs?.[0] || null;
        } else if (data.data.status === 'failed') {
          return null;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return null;
}

async function generateWaveSpeedTTS(
  text: string, 
  apiKey: string,
  speed: number = 1
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Generating TTS with WaveSpeed');
    
    const ttsResponse = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.length > 10000 ? text.substring(0, 10000) : text,
        voice_id: 'English_Trustworth_Man',
        speed: speed,
        volume: 1,
        pitch: 0,
        emotion: 'neutral',
        english_normalization: true
      }),
    });

    if (!ttsResponse.ok) {
      return null;
    }

    const ttsData = await ttsResponse.json();
    
    if (ttsData.code !== 200 || !ttsData.data?.id) {
      return null;
    }

    const audioUrl = await pollWaveSpeedTTSResult(ttsData.data.id, apiKey);
    
    if (!audioUrl) {
      return null;
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return null;
    }

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);
    
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    return { audioContent: base64Audio, audioUrl };
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
    console.log('Generating TTS with Speechify cloned voice:', voiceId);

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
      console.error('Speechify TTS error:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    let base64Audio: string;
    
    if (contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      if (jsonResponse.audio_data) {
        base64Audio = jsonResponse.audio_data;
      } else {
        return null;
      }
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

    return {
      audioContent: base64Audio,
      audioUrl: `data:audio/mp3;base64,${base64Audio}`
    };
  } catch (error) {
    console.error('Speechify TTS error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists (JWT verified by Supabase)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, voice = 'en-US-Journey-D', speed = 1, voiceCloningKey, speechifyVoiceId } = await req.json();

    // Validate text
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate speed
    const validatedSpeed = typeof speed === 'number' ? Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed)) : 1.0;

    // Validate voice
    if (voice && typeof voice !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Voice must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`TTS request - Voice: ${voice}, Text length: ${text.length}`);

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');
    
    // Priority 1: Speechify cloned voice
    if (speechifyVoiceId && speechifyApiKey) {
      const speechifyResult = await generateSpeechifyTTS(text, speechifyApiKey, speechifyVoiceId, validatedSpeed);
      if (speechifyResult) {
        return new Response(
          JSON.stringify({ ...speechifyResult, isClonedVoice: true, provider: 'speechify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Priority 2: Google Cloud cloned voice
    if (voiceCloningKey && googleApiKey) {
      const clonedResult = await generateClonedVoiceTTS(text, googleApiKey, voiceCloningKey, validatedSpeed);
      if (clonedResult) {
        return new Response(
          JSON.stringify({ ...clonedResult, isClonedVoice: true, provider: 'google' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const voiceConfig = GOOGLE_VOICES[voice] || DEFAULT_VOICE;
    
    // Try Google Cloud TTS
    if (googleApiKey) {
      const googleResult = await generateGoogleTTS(text, googleApiKey, voiceConfig, validatedSpeed);
      if (googleResult) {
        return new Response(
          JSON.stringify(googleResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Fallback to WaveSpeed
    if (waveSpeedApiKey) {
      const waveSpeedResult = await generateWaveSpeedTTS(text, waveSpeedApiKey, validatedSpeed);
      if (waveSpeedResult) {
        return new Response(
          JSON.stringify(waveSpeedResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
