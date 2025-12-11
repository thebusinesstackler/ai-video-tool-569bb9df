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
    const { audioUrl, name, email, gender = 'male' } = await req.json();

    if (!audioUrl) {
      throw new Error('Audio URL is required');
    }

    if (!name || !email) {
      throw new Error('Name and email are required for consent');
    }

    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');
    if (!speechifyApiKey) {
      throw new Error('Speechify API key not configured');
    }

    console.log('Starting Speechify voice cloning process');
    console.log('Audio URL:', audioUrl);
    console.log('Name:', name);
    console.log('Gender:', gender);

    // Download the audio file
    console.log('Downloading audio file...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    console.log('Audio downloaded, size:', audioBlob.size);

    // Get the file extension from URL
    const urlPath = new URL(audioUrl).pathname;
    const extension = urlPath.split('.').pop() || 'mp3';
    const mimeType = extension === 'wav' ? 'audio/wav' : extension === 'm4a' ? 'audio/m4a' : 'audio/mpeg';

    // Create consent JSON
    const consent = JSON.stringify({
      fullName: name,
      email: email
    });

    // Create form data for Speechify API
    const formData = new FormData();
    formData.append('name', `${name}_clone`);
    formData.append('sample', new File([audioBuffer], `sample.${extension}`, { type: mimeType }));
    formData.append('consent', consent);
    formData.append('gender', gender.toLowerCase());

    console.log('Calling Speechify voice cloning API...');

    // Call Speechify voice cloning API
    const response = await fetch('https://api.sws.speechify.com/v1/voices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${speechifyApiKey}`,
      },
      body: formData
    });

    const responseText = await response.text();
    console.log('Speechify API response status:', response.status);
    console.log('Speechify API response:', responseText);

    if (!response.ok) {
      throw new Error(`Speechify API error: ${response.status} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse Speechify response: ${responseText}`);
    }

    // Speechify returns the voice_id directly
    const voiceId = data.id || data.voice_id;
    
    if (!voiceId) {
      console.error('Speechify response data:', data);
      throw new Error('No voice ID returned from Speechify');
    }

    console.log('Voice cloned successfully! Voice ID:', voiceId);

    return new Response(
      JSON.stringify({ 
        speechifyVoiceId: voiceId,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in clone-voice-speechify:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
