import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Cloud TTS voice mapping
const GOOGLE_VOICES: Record<string, { name: string; languageCode: string }> = {
  'nova': { name: 'en-US-Journey-F', languageCode: 'en-US' },
  'alloy': { name: 'en-US-Journey-D', languageCode: 'en-US' },
  'echo': { name: 'en-US-Wavenet-D', languageCode: 'en-US' },
  'fable': { name: 'en-GB-Wavenet-B', languageCode: 'en-GB' },
  'onyx': { name: 'en-US-Wavenet-A', languageCode: 'en-US' },
  'shimmer': { name: 'en-US-Wavenet-F', languageCode: 'en-US' },
};

async function generateGoogleTTS(text: string, voice: string, apiKey: string): Promise<string> {
  const voiceConfig = GOOGLE_VOICES[voice] || GOOGLE_VOICES['nova'];
  
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google TTS error:', response.status, errorText);
    throw new Error(`Google TTS error: ${response.status}`);
  }

  const data = await response.json();
  return data.audioContent; // Already base64 encoded
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'nova', sceneNumber } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating voiceover for scene:', sceneNumber, 'with voice:', voice);

    // Try Google Cloud TTS first (already configured)
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    
    if (GOOGLE_API_KEY) {
      try {
        const base64Audio = await generateGoogleTTS(text, voice, GOOGLE_API_KEY);
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        
        console.log('Voiceover generated with Google TTS for scene:', sceneNumber);
        
        return new Response(
          JSON.stringify({ audioUrl, sceneNumber }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (googleError) {
        console.error('Google TTS failed:', googleError);
      }
    }

    // Fallback to OpenAI TTS if available
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI TTS error:', response.status, errorText);
        throw new Error(`OpenAI TTS error: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      console.log('Voiceover generated with OpenAI for scene:', sceneNumber);

      return new Response(
        JSON.stringify({ audioUrl, sceneNumber }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No TTS API configured
    console.error('No TTS API key configured (GOOGLE_CLOUD_TTS_API_KEY or OPENAI_API_KEY)');
    return new Response(
      JSON.stringify({ error: 'No TTS API configured. Please add GOOGLE_CLOUD_TTS_API_KEY or OPENAI_API_KEY.' }),
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
