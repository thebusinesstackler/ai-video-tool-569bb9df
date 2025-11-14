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

    const googleCloudApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    if (!googleCloudApiKey) {
      throw new Error('Google Cloud TTS API key not configured');
    }

    // Map voice names to Google Cloud Neural2 voices
    const voiceMapping: Record<string, { languageCode: string, name: string }> = {
      'alloy': { languageCode: 'en-US', name: 'en-US-Neural2-F' },    // Female, neutral, professional
      'echo': { languageCode: 'en-US', name: 'en-US-Neural2-D' },     // Male, mature, authoritative
      'fable': { languageCode: 'en-US', name: 'en-US-Neural2-C' },    // Female, warm, friendly
      'onyx': { languageCode: 'en-US', name: 'en-US-Neural2-A' },     // Male, deep, commanding
      'nova': { languageCode: 'en-US', name: 'en-US-Neural2-E' },     // Female, young, bright
      'shimmer': { languageCode: 'en-US', name: 'en-US-Neural2-G' },  // Female, soft, gentle
    };

    const voiceConfig = voiceMapping[voice] || voiceMapping['alloy'];
    
    console.log('Generating TTS with Google Cloud for text length:', text.length, 'voice:', voice);

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleCloudApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            text: text.length > 5000 ? text.substring(0, 5000) : text,
          },
          voice: {
            languageCode: voiceConfig.languageCode,
            name: voiceConfig.name,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Cloud TTS error:', response.status, errorText);
      throw new Error(`Google Cloud TTS API error: ${response.status}`);
    }

    const data = await response.json();
    const base64Audio = data.audioContent;

    console.log('TTS generation successful with Google Cloud');

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
