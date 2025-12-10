import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const GOOGLE_CLOUD_TTS_API_KEY = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    if (!GOOGLE_CLOUD_TTS_API_KEY) {
      throw new Error('GOOGLE_CLOUD_TTS_API_KEY is not configured');
    }

    console.log('Starting Google Cloud voice cloning process');
    console.log('Reference audio URL:', audioUrl);
    console.log('Consent audio URL:', consentAudioUrl);

    // Download both audio files
    console.log('Downloading reference audio...');
    const referenceAudioBase64 = await downloadAudio(audioUrl);
    console.log(`Reference audio size: ${referenceAudioBase64.length} chars`);

    console.log('Downloading consent audio...');
    const consentAudioBase64 = await downloadAudio(consentAudioUrl);
    console.log(`Consent audio size: ${consentAudioBase64.length} chars`);

    // Call Google Cloud TTS API to generate voice cloning key
    // Using the voices:generateVoiceCloningKey endpoint
    const generateKeyUrl = `https://texttospeech.googleapis.com/v1beta1/voices:generateVoiceCloningKey?key=${GOOGLE_CLOUD_TTS_API_KEY}`;
    
    const requestBody = {
      reference_audio: {
        audio_config: {
          audio_encoding: "LINEAR16",
          sample_rate_hertz: 24000
        },
        content: referenceAudioBase64
      },
      voice_talent_consent: {
        audio_config: {
          audio_encoding: "LINEAR16",
          sample_rate_hertz: 24000
        },
        content: consentAudioBase64
      },
      consent_script: consentScript || "I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.",
      language_code: "en-US"
    };

    console.log('Calling Google Cloud generateVoiceCloningKey API...');
    
    const response = await fetch(generateKeyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Cloud API error:', response.status, errorText);
      
      // Parse error for more details
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.error?.message || 'Failed to generate voice cloning key';
        throw new Error(errorMessage);
      } catch (e) {
        throw new Error(`Google API error (${response.status}): ${errorText.substring(0, 200)}`);
      }
    }

    const data = await response.json();
    console.log('Google Cloud API response received');

    if (!data.voiceCloningKey) {
      console.error('No voiceCloningKey in response:', JSON.stringify(data));
      throw new Error('Google Cloud did not return a voice cloning key');
    }

    console.log('Voice cloning key generated successfully');

    return new Response(
      JSON.stringify({ 
        voiceCloningKey: data.voiceCloningKey,
        message: 'Voice profile created successfully. Your cloned voice is ready for use.',
        provider: 'google-cloud-chirp3'
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