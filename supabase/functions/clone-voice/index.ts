import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// Download audio from Supabase storage or external URL
async function downloadAudio(audioUrl: string): Promise<string> {
  const urlParts = audioUrl.split('/storage/v1/object/public/');
  
  if (urlParts.length === 2) {
    // Supabase storage URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const pathParts = urlParts[1].split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    
    console.log(`Downloading from bucket: ${bucket}, path: ${filePath}`);
    
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }
    
    const audioBuffer = await data.arrayBuffer();
    return arrayBufferToBase64(audioBuffer);
  } else {
    // External URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio file from URL');
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    return arrayBufferToBase64(audioBuffer);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioUrl, consentAudioUrl, consentScript } = await req.json();

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ error: 'audioUrl (reference audio) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!consentAudioUrl) {
      return new Response(
        JSON.stringify({ error: 'consentAudioUrl is required for Google Cloud voice cloning' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Chirp 3 API key
    const chirp3ApiKey = Deno.env.get('CHIRP3_API_KEY');
    if (!chirp3ApiKey) {
      throw new Error('CHIRP3_API_KEY is not configured');
    }

    console.log('Starting Chirp 3 Instant Custom Voice cloning process');
    console.log('Reference audio URL:', audioUrl);
    console.log('Consent audio URL:', consentAudioUrl);

    // Download both audio files
    console.log('Downloading reference audio...');
    const referenceAudioBase64 = await downloadAudio(audioUrl);
    console.log(`Reference audio size: ${referenceAudioBase64.length} chars`);

    console.log('Downloading consent audio...');
    const consentAudioBase64 = await downloadAudio(consentAudioUrl);
    console.log(`Consent audio size: ${consentAudioBase64.length} chars`);

    // Use regional endpoint for Chirp 3 Instant Custom Voice
    const generateKeyUrl = 'https://us-texttospeech.googleapis.com/v1beta1/voices:generateVoiceCloningKey';
    
    // Detect audio format from file extension
    const getAudioEncoding = (url: string): string => {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('.wav')) return 'LINEAR16';
      if (lowerUrl.includes('.mp3')) return 'MP3';
      if (lowerUrl.includes('.m4a')) return 'M4A';
      if (lowerUrl.includes('.pcm')) return 'PCM';
      return 'LINEAR16';
    };
    
    const referenceEncoding = getAudioEncoding(audioUrl);
    const consentEncoding = getAudioEncoding(consentAudioUrl);
    
    console.log(`Reference audio encoding: ${referenceEncoding}`);
    console.log(`Consent audio encoding: ${consentEncoding}`);
    
    const requestBody = {
      reference_audio: {
        audio_config: {
          audio_encoding: referenceEncoding
        },
        content: referenceAudioBase64
      },
      voice_talent_consent: {
        audio_config: {
          audio_encoding: consentEncoding
        },
        content: consentAudioBase64
      },
      consent_script: consentScript || "I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.",
      language_code: "en-US"
    };

    console.log('Calling Chirp 3 generateVoiceCloningKey API...');
    console.log('Request body structure:', JSON.stringify({
      reference_audio: { audio_config: requestBody.reference_audio.audio_config, content_length: referenceAudioBase64.length },
      voice_talent_consent: { audio_config: requestBody.voice_talent_consent.audio_config, content_length: consentAudioBase64.length },
      consent_script: requestBody.consent_script,
      language_code: requestBody.language_code
    }));
    
    const response = await fetch(generateKeyUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': chirp3ApiKey,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chirp 3 API error:', response.status, errorText);
      
      if (response.status === 404) {
        throw new Error('Voice cloning API endpoint not found. Please verify the Chirp 3 API is enabled for your project.');
      }
      
      if (response.status === 403) {
        throw new Error('Permission denied. Please verify the Chirp 3 API key has the required permissions.');
      }

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your CHIRP3_API_KEY is correct.');
      }
      
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.error?.message || 'Failed to generate voice cloning key';
        throw new Error(errorMessage);
      } catch (e) {
        if (e instanceof Error && !e.message.includes('Failed to generate')) {
          throw e;
        }
        throw new Error(`Chirp 3 API error (${response.status}): ${errorText.substring(0, 300)}`);
      }
    }

    const data = await response.json();
    console.log('Chirp 3 API response received');

    if (!data.voiceCloningKey) {
      console.error('No voiceCloningKey in response:', JSON.stringify(data));
      throw new Error('Chirp 3 API did not return a voice cloning key');
    }

    console.log('Voice cloning key generated successfully');

    return new Response(
      JSON.stringify({ 
        voiceCloningKey: data.voiceCloningKey,
        message: 'Voice profile created successfully. Your cloned voice is ready for use.',
        provider: 'chirp3-instant-custom-voice'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in clone-voice:', error);
    const message = error instanceof Error ? error.message : 'Failed to clone voice';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
