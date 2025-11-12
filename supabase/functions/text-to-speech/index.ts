import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'alloy' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Map voice names to ElevenLabs voice IDs
    const voiceMapping: Record<string, string> = {
      'alloy': '9BWtsMINqrJLrRacOk9x',
      'echo': 'CwhRBWXzGAHq8TQ4Fs17',
      'fable': 'EXAVITQu4vr4xnSDxMaL',
      'onyx': 'JBFqnCBsd6RMkjVDRZzb',
      'nova': 'XB0fDUnXU5powFXDhCwa',
      'shimmer': 'pFZP5JQG7iQjIQuC4Bku',
    };

    const voiceId = voiceMapping[voice] || voiceMapping['alloy'];
    
    console.log('Generating TTS for text length:', text.length, 'voice:', voice);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: text.length > 2500 ? text.substring(0, 2500) : text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorText);
      throw new Error(`TTS API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binaryString = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64Audio = btoa(binaryString);

    console.log('TTS generation successful');

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
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
