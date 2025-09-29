import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map common voice names to ElevenLabs voice IDs
const voiceMapping: Record<string, string> = {
  'alloy': '9BWtsMINqrJLrRacOk9x', // Aria
  'echo': 'CwhRBWXzGAHq8TQ4Fs17', // Roger  
  'fable': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'onyx': 'JBFqnCBsd6RMkjVDRZzb', // George
  'nova': 'XB0fDUnXU5powFXDhCwa', // Charlotte
  'shimmer': 'pFZP5JQG7iQjIQuC4Bku', // Lily
  'default': '9BWtsMINqrJLrRacOk9x', // Aria
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'alloy', model = 'eleven_multilingual_v2' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Get the ElevenLabs voice ID
    const voiceId = voiceMapping[voice] || voice; // Allow direct voice ID or mapped voice name
    
    console.log('Generating TTS for text length:', text.length, 'voice:', voice, 'voiceId:', voiceId);

    // Generate speech from text using ElevenLabs TTS
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
        body: JSON.stringify({
          text: text.length > 2500 ? text.substring(0, 2500) : text, // Conservative limit for reliability
          model_id: model === 'tts-1' ? 'eleven_multilingual_v2' : model, // Handle legacy OpenAI model names
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    // Convert audio buffer to base64
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Process in chunks to avoid maximum call stack size exceeded error
    let binaryString = '';
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64Audio = btoa(binaryString);

    console.log('TTS generation successful, audio size:', base64Audio.length);

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('TTS generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});