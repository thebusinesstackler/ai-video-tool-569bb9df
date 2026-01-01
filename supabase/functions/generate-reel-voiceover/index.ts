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

// Clean script text for TTS by removing stage directions
function cleanScriptForTTS(script: string): string {
  if (!script) return '';
  
  return script
    // Convert breath/inhale markers to natural pauses
    .replace(/\(inhale\)/gi, '...')
    .replace(/\(breath\)/gi, '...')
    .replace(/\(deep breath\)/gi, '... ...')
    .replace(/\(sigh\)/gi, '...')
    .replace(/\(exhale\)/gi, '...')
    // Convert pause markers with timing to appropriate pauses
    .replace(/\(short pause\)/gi, '...')
    .replace(/\(pause\)/gi, '...')
    .replace(/\(long pause\)/gi, '... ...')
    // Replace [BEAT] and [PAUSE] with ellipsis for natural pauses
    .replace(/\[BEAT\]/gi, '...')
    .replace(/\[PAUSE\]/gi, '...')
    .replace(/\[LONG PAUSE\]/gi, '... ...')
    .replace(/\[SHORT PAUSE\]/gi, '...')
    // Remove any other [bracketed] commands
    .replace(/\[.*?\]/g, '')
    // Remove parenthetical directions like (slight laugh), (with conviction)
    .replace(/\([^)]*\)/g, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Clean up multiple ellipses
    .replace(/(\.\.\.(\s*)?){3,}/g, '... ...')
    .replace(/\.\.\.(\s*\.\.\.)+/g, '... ...')
    // Clean up comma artifacts
    .replace(/,\s*,/g, ',')
    .trim();
}

// Convert script to SSML for Google Cloud TTS
function convertToSSML(script: string): string {
  if (!script) return '<speak></speak>';
  
  let ssml = script
    .replace(/\(short pause\)/gi, '<break time="300ms"/>')
    .replace(/\(pause\)/gi, '<break time="500ms"/>')
    .replace(/\(long pause\)/gi, '<break time="1s"/>')
    .replace(/\(breath\)/gi, '<break time="400ms"/>')
    .replace(/\(inhale\)/gi, '<break time="500ms"/>')
    .replace(/\(deep breath\)/gi, '<break time="800ms"/>')
    .replace(/\[BEAT\]/gi, '<break time="400ms"/>')
    .replace(/\[PAUSE\]/gi, '<break time="500ms"/>')
    .replace(/\[LONG PAUSE\]/gi, '<break time="1s"/>')
    .replace(/\*\*([^*]+)\*\*/g, '<emphasis level="strong">$1</emphasis>')
    .replace(/\*([^*]+)\*/g, '<emphasis level="moderate">$1</emphasis>')
    .replace(/\(slower\)/gi, '<prosody rate="slow">')
    .replace(/\(end slower\)/gi, '</prosody>')
    .replace(/\(faster\)/gi, '<prosody rate="fast">')
    .replace(/\(end faster\)/gi, '</prosody>')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  return `<speak>${ssml}</speak>`;
}

// Check if script has SSML-convertible markers
function hasSSMLMarkers(script: string): boolean {
  if (!script) return false;
  return /\*\*[^*]+\*\*|\*[^*]+\*|\(slower\)|\(faster\)|\(short pause\)|\(long pause\)/i.test(script);
}

async function generateGoogleTTS(text: string, voice: string, apiKey: string): Promise<string> {
  const voiceConfig = GOOGLE_VOICES[voice] || GOOGLE_VOICES['nova'];
  
  // Use SSML if advanced markers detected
  const useSSML = hasSSMLMarkers(text);
  const processedText = useSSML ? convertToSSML(text) : cleanScriptForTTS(text);
  
  console.log(`Generating Google TTS, SSML: ${useSSML}`);
  
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: useSSML ? { ssml: processedText } : { text: processedText },
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
    
    // If SSML failed, retry with plain text
    if (useSSML) {
      console.log('SSML failed, retrying with plain text...');
      return generateGoogleTTS(cleanScriptForTTS(text), voice, apiKey);
    }
    throw new Error(`Google TTS error: ${response.status}`);
  }

  const data = await response.json();
  return data.audioContent;
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

    // Clean the script to remove stage directions
    const cleanedText = cleanScriptForTTS(text);
    console.log(`Cleaned script: "${text.substring(0, 50)}..." -> "${cleanedText.substring(0, 50)}..."`);

    // Try Google Cloud TTS first (already configured)
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    
    if (GOOGLE_API_KEY) {
      try {
        const base64Audio = await generateGoogleTTS(cleanedText, voice, GOOGLE_API_KEY);
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
          input: cleanedText,
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
