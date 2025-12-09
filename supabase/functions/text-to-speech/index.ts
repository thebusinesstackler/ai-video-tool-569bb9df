import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Voice configuration mapping
interface VoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE';
}

const GOOGLE_VOICES: Record<string, VoiceConfig> = {
  // Female voices
  'en-US-Journey-F': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' },
  'en-US-Neural2-F': { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  'en-US-Studio-O': { languageCode: 'en-US', name: 'en-US-Studio-O', ssmlGender: 'FEMALE' },
  'en-GB-Neural2-F': { languageCode: 'en-GB', name: 'en-GB-Neural2-F', ssmlGender: 'FEMALE' },
  // Male voices
  'en-US-Journey-D': { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' },
  'en-US-Neural2-D': { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
  'en-US-Studio-Q': { languageCode: 'en-US', name: 'en-US-Studio-Q', ssmlGender: 'MALE' },
  'en-GB-Neural2-D': { languageCode: 'en-GB', name: 'en-GB-Neural2-D', ssmlGender: 'MALE' },
};

// Default voice if none specified or not found
const DEFAULT_VOICE: VoiceConfig = { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' };

// Google Cloud TTS - Primary engine
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
      headers: {
        'Content-Type': 'application/json',
      },
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
          effectsProfileId: ['headphone-class-device'] // Better audio quality
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google TTS error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      console.log('Google Cloud TTS successful with voice:', voiceConfig.name);
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

// Poll for WaveSpeed TTS result (fallback)
async function pollWaveSpeedTTSResult(taskId: string, apiKey: string, maxAttempts: number = 60): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        console.error('TTS poll error:', response.status);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const data = await response.json();
      console.log('TTS poll result:', data.data?.status);
      
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          const audioUrl = data.data.outputs?.[0];
          if (audioUrl) {
            console.log('TTS completed, audio URL:', audioUrl);
            return audioUrl;
          }
        } else if (data.data.status === 'failed') {
          console.error('TTS task failed:', data.data.error);
          return null;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('TTS poll error:', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('TTS polling timed out');
  return null;
}

// WaveSpeed TTS fallback
async function generateWaveSpeedTTS(
  text: string, 
  apiKey: string,
  speed: number = 1
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Generating TTS with WaveSpeed MiniMax Speech-02-HD');
    
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
      const errorText = await ttsResponse.text();
      console.error('WaveSpeed TTS error:', ttsResponse.status, errorText);
      return null;
    }

    const ttsData = await ttsResponse.json();
    
    if (ttsData.code !== 200 || !ttsData.data?.id) {
      console.error('WaveSpeed TTS error:', ttsData.message);
      return null;
    }

    // Poll for result
    const audioUrl = await pollWaveSpeedTTSResult(ttsData.data.id, apiKey);
    
    if (!audioUrl) {
      return null;
    }

    // Fetch the audio file and convert to base64
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return null;
    }

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);
    
    // Convert to base64 in chunks
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    console.log('WaveSpeed TTS generation successful');
    return { audioContent: base64Audio, audioUrl };
  } catch (error) {
    console.error('WaveSpeed TTS error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'en-US-Journey-D', speed = 1 } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    console.log(`TTS request - Voice: ${voice}, Text length: ${text.length}`);

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    
    // Get voice configuration - use selected voice or default
    const voiceConfig = GOOGLE_VOICES[voice] || DEFAULT_VOICE;
    
    // Try Google Cloud TTS first (primary engine for natural voices)
    if (googleApiKey) {
      const googleResult = await generateGoogleTTS(text, googleApiKey, voiceConfig, speed);
      if (googleResult) {
        return new Response(
          JSON.stringify(googleResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Google TTS failed, trying fallback...');
    }
    
    // Fallback to WaveSpeed if Google fails
    if (waveSpeedApiKey) {
      console.log('Attempting WaveSpeed TTS fallback...');
      const waveSpeedResult = await generateWaveSpeedTTS(text, waveSpeedApiKey, speed);
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
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
