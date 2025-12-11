import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

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

// Get OAuth access token from service account
async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  project_id: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const scope = 'https://www.googleapis.com/auth/cloud-platform';
  
  // Import the private key
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
  
  // Create JWT
  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: scope,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange error:', errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
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

    // Get service account credentials
    const serviceAccountJson = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_CLOUD_SERVICE_ACCOUNT is not configured');
    }

    let serviceAccount: { client_email: string; private_key: string; project_id: string };
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      throw new Error('Invalid GOOGLE_CLOUD_SERVICE_ACCOUNT JSON format');
    }

    console.log('Starting Google Cloud voice cloning process');
    console.log('Project ID:', serviceAccount.project_id);
    console.log('Reference audio URL:', audioUrl);
    console.log('Consent audio URL:', consentAudioUrl);

    // Get OAuth access token
    console.log('Getting OAuth access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained successfully');

    // Download both audio files
    console.log('Downloading reference audio...');
    const referenceAudioBase64 = await downloadAudio(audioUrl);
    console.log(`Reference audio size: ${referenceAudioBase64.length} chars`);

    console.log('Downloading consent audio...');
    const consentAudioBase64 = await downloadAudio(consentAudioUrl);
    console.log(`Consent audio size: ${consentAudioBase64.length} chars`);

    // Call Google Cloud TTS API with OAuth Bearer token
    const generateKeyUrl = 'https://texttospeech.googleapis.com/v1beta1/voices:generateVoiceCloningKey';
    
    // Detect audio format from file extension
    // Google supports: LINEAR16, PCM, MP3, M4A (NOT webm/opus!)
    const getAudioEncoding = (url: string): string => {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('.wav')) return 'LINEAR16';
      if (lowerUrl.includes('.mp3')) return 'MP3';
      if (lowerUrl.includes('.m4a')) return 'M4A';
      if (lowerUrl.includes('.pcm')) return 'PCM';
      // Default to LINEAR16 for WAV files recorded by browser
      return 'LINEAR16';
    };
    
    const referenceEncoding = getAudioEncoding(audioUrl);
    const consentEncoding = getAudioEncoding(consentAudioUrl);
    
    console.log(`Reference audio URL: ${audioUrl}`);
    console.log(`Reference audio encoding: ${referenceEncoding}`);
    console.log(`Consent audio encoding: ${consentEncoding}`);
    
    // Log a warning for unsupported formats but try anyway (client should convert to WAV)
    if (audioUrl.toLowerCase().includes('.webm') || consentAudioUrl.toLowerCase().includes('.webm')) {
      console.warn('Warning: WebM format detected. This may fail - client should convert to WAV.');
    }
    
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

    console.log('Calling Google Cloud generateVoiceCloningKey API with OAuth...');
    console.log('Request body structure:', JSON.stringify({
      reference_audio: { audio_config: requestBody.reference_audio.audio_config, content_length: referenceAudioBase64.length },
      voice_talent_consent: { audio_config: requestBody.voice_talent_consent.audio_config, content_length: consentAudioBase64.length },
      consent_script: requestBody.consent_script,
      language_code: requestBody.language_code
    }));
    
    const response = await fetch(generateKeyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'x-goog-user-project': serviceAccount.project_id,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Cloud API error:', response.status, errorText);
      
      // Handle specific error codes
      if (response.status === 404) {
        throw new Error('Voice cloning API not available. Please ensure the Text-to-Speech API is enabled in Google Cloud Console and your project has access to Chirp 3 Instant Custom Voice (preview feature).');
      }
      
      if (response.status === 403) {
        throw new Error('Permission denied. Please check that the service account has the required permissions for Text-to-Speech API.');
      }
      
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.error?.message || 'Failed to generate voice cloning key';
        throw new Error(errorMessage);
      } catch (e) {
        if (e instanceof Error && !e.message.includes('Failed to generate')) {
          throw e;
        }
        throw new Error(`Google API error (${response.status}): ${errorText.substring(0, 300)}`);
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
