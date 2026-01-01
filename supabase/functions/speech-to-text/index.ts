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
    const { audioBase64 } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: 'Audio data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');

    // Try Google Cloud Speech-to-Text first (if API key available)
    if (googleApiKey) {
      console.log('Using Google Cloud Speech-to-Text');
      
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              encoding: 'WEBM_OPUS',
              sampleRateHertz: 48000,
              languageCode: 'en-US',
              enableAutomaticPunctuation: true,
              model: 'latest_long'
            },
            audio: {
              content: audioBase64
            }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const transcript = data.results
          ?.map((result: any) => result.alternatives?.[0]?.transcript)
          .filter(Boolean)
          .join(' ') || '';

        if (transcript) {
          console.log('Google STT successful, length:', transcript.length);
          return new Response(
            JSON.stringify({ text: transcript, provider: 'google' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const errorText = await response.text();
        console.error('Google STT error:', response.status, errorText);
      }
    }

    // Fallback to Lovable AI Gateway with Gemini (multimodal)
    if (lovableApiKey) {
      console.log('Using Lovable AI Gateway for transcription');
      
      // Convert base64 audio to data URL for Gemini
      const audioDataUrl = `data:audio/webm;base64,${audioBase64}`;
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe the following audio exactly as spoken. Only output the transcription, nothing else. If you cannot hear clear speech, respond with an empty string.'
                },
                {
                  type: 'input_audio',
                  input_audio: {
                    data: audioBase64,
                    format: 'webm'
                  }
                }
              ]
            }
          ]
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const transcript = data.choices?.[0]?.message?.content || '';
        
        if (transcript && transcript.trim()) {
          console.log('Lovable AI transcription successful, length:', transcript.length);
          return new Response(
            JSON.stringify({ text: transcript.trim(), provider: 'lovable-ai' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        const errorText = await response.text();
        console.error('Lovable AI STT error:', response.status, errorText);
      }
    }

    // No transcription available
    console.error('No speech-to-text service available');
    return new Response(
      JSON.stringify({ error: 'Speech-to-text service unavailable' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Speech-to-text error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Transcription failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
