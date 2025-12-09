import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Poll for WaveSpeed TTS result
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
          // Audio URL is in outputs array
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

// Google Cloud TTS fallback
async function generateGoogleTTS(text: string, apiKey: string): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Falling back to Google Cloud TTS...');
    
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Neural2-D', // Male neural voice
          ssmlGender: 'MALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0
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
      console.log('Google Cloud TTS successful');
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'neutral', speed = 1, emotion = 'neutral' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    
    // Try WaveSpeed first if available
    if (waveSpeedApiKey) {
      console.log('Generating TTS with WaveSpeed MiniMax Speech-02-HD for text length:', text.length);

      // Use English voice from MiniMax - pick based on desired tone
      const voiceId = 'English_Trustworth_Man';
      console.log('Using voice_id:', voiceId);

      try {
        // Start TTS generation with WaveSpeed MiniMax Speech-02-HD endpoint
        const ttsResponse = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${waveSpeedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text.length > 10000 ? text.substring(0, 10000) : text,
            voice_id: voiceId,
            speed: speed,
            volume: 1,
            pitch: 0,
            emotion: emotion || 'neutral',
            english_normalization: true
          }),
        });

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          console.error('WaveSpeed TTS error:', ttsResponse.status, errorText);
          
          // Check if it's a credits issue - fallback to Google
          if (errorText.includes('Insufficient credits') || ttsResponse.status === 400 || ttsResponse.status === 402) {
            console.log('WaveSpeed credits exhausted, trying Google Cloud TTS fallback...');
            if (googleApiKey) {
              const googleResult = await generateGoogleTTS(text, googleApiKey);
              if (googleResult) {
                return new Response(
                  JSON.stringify(googleResult),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }
          
          throw new Error(`WaveSpeed TTS API error: ${ttsResponse.status}. ${errorText.includes('Insufficient credits') ? 'Please top up your WaveSpeed credits or enable VEO3 mode for video generation.' : ''}`);
        }

        const ttsData = await ttsResponse.json();
        console.log('WaveSpeed TTS response:', ttsData);

        if (ttsData.code !== 200 || !ttsData.data?.id) {
          // Check for insufficient credits in response
          if (ttsData.message?.includes('Insufficient credits')) {
            console.log('WaveSpeed credits exhausted (from response), trying Google Cloud TTS fallback...');
            if (googleApiKey) {
              const googleResult = await generateGoogleTTS(text, googleApiKey);
              if (googleResult) {
                return new Response(
                  JSON.stringify(googleResult),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }
          throw new Error(`WaveSpeed TTS error: ${ttsData.message || 'Unknown error'}`);
        }

        // Poll for result
        const audioUrl = await pollWaveSpeedTTSResult(ttsData.data.id, waveSpeedApiKey);
        
        if (!audioUrl) {
          throw new Error('TTS generation timed out or failed');
        }

        // Fetch the audio file and convert to base64
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          throw new Error('Failed to fetch generated audio');
        }

        const audioArrayBuffer = await audioResponse.arrayBuffer();
        const audioBytes = new Uint8Array(audioArrayBuffer);
        
        // Convert to base64 in chunks to avoid stack overflow
        let binary = '';
        const chunkSize = 32768;
        for (let i = 0; i < audioBytes.length; i += chunkSize) {
          const chunk = audioBytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Audio = btoa(binary);

        console.log('TTS generation successful with WaveSpeed MiniMax Speech-02-HD');

        return new Response(
          JSON.stringify({ audioContent: base64Audio, audioUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (waveSpeedError) {
        console.error('WaveSpeed TTS failed:', waveSpeedError);
        
        // Try Google fallback
        if (googleApiKey) {
          console.log('Attempting Google Cloud TTS fallback after WaveSpeed error...');
          const googleResult = await generateGoogleTTS(text, googleApiKey);
          if (googleResult) {
            return new Response(
              JSON.stringify(googleResult),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        throw waveSpeedError;
      }
    }
    
    // If no WaveSpeed key, try Google directly
    if (googleApiKey) {
      console.log('Using Google Cloud TTS (no WaveSpeed key configured)');
      const googleResult = await generateGoogleTTS(text, googleApiKey);
      if (googleResult) {
        return new Response(
          JSON.stringify(googleResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Google Cloud TTS failed');
    }
    
    throw new Error('No TTS API key configured (WaveSpeed or Google Cloud)');
    
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
