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
    if (!waveSpeedApiKey) {
      throw new Error('WaveSpeed API key not configured');
    }

    console.log('Generating TTS with WaveSpeed English TTS for text length:', text.length);

    // Use standard English Azure Neural voice
    const voiceId = 'en-US-AriaNeural';
    console.log('Using voice_id:', voiceId);

    // Start TTS generation with WaveSpeed English TTS endpoint
    const ttsResponse = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/tts-english', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waveSpeedApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.length > 5000 ? text.substring(0, 5000) : text,
        voice: voiceId,
        speed: speed
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('WaveSpeed TTS error:', ttsResponse.status, errorText);
      throw new Error(`WaveSpeed TTS API error: ${ttsResponse.status}`);
    }

    const ttsData = await ttsResponse.json();
    console.log('WaveSpeed TTS response:', ttsData);

    if (ttsData.code !== 200 || !ttsData.data?.id) {
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

    console.log('TTS generation successful with WaveSpeed English TTS');

    return new Response(
      JSON.stringify({ audioContent: base64Audio, audioUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
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
