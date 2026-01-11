import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI TTS-1-HD voices (higher quality than TTS-1)
const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

// Google Cloud TTS voice mapping (fallback)
const GOOGLE_VOICES: Record<string, { name: string; languageCode: string }> = {
  'nova': { name: 'en-US-Journey-F', languageCode: 'en-US' },
  'alloy': { name: 'en-US-Journey-D', languageCode: 'en-US' },
  'echo': { name: 'en-US-Wavenet-D', languageCode: 'en-US' },
  'fable': { name: 'en-GB-Wavenet-B', languageCode: 'en-GB' },
  'onyx': { name: 'en-US-Wavenet-A', languageCode: 'en-US' },
  'shimmer': { name: 'en-US-Wavenet-F', languageCode: 'en-US' },
};

// Clean text to prevent TTS artifacts (doubled sounds, echoes, plural "s" sounds)
function cleanTextForTTS(text: string): string {
  return text
    // First, normalize smart quotes and special characters
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    // CRITICAL: Convert sentence-ending periods to em dashes to prevent "s" sound artifacts
    // This is the main fix for words like "workflow." sounding like "workflows"
    .replace(/\.(\s|$)/g, '—$1')
    // Keep em dashes as clean pauses (don't convert to spaces)
    .replace(/–/g, '—')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Fix doubled letters/words that cause stuttering
    .replace(/(\b\w+\b)\s+\1\b/gi, '$1')
    // Ensure proper spacing after punctuation (but not periods since we converted them)
    .replace(/,([A-Za-z])/g, ', $1')
    // Remove any trailing/leading whitespace
    .trim();
}

async function generateOpenAITTS(text: string, voice: string, apiKey: string): Promise<string> {
  // Ensure voice is valid for OpenAI
  const validVoice = OPENAI_VOICES.includes(voice) ? voice : 'nova';
  
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd', // Higher quality model with better prosody
      input: text,
      voice: validVoice,
      response_format: 'mp3',
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI TTS-1-HD error:', response.status, errorText);
    throw new Error(`OpenAI TTS error: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  // Use proper base64 encoding to avoid stack overflow with large audio
  return base64Encode(arrayBuffer);
}

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

    // Clean text to prevent TTS artifacts (doubled sounds, echoes)
    const cleanedText = cleanTextForTTS(text);
    console.log('Generating voiceover for scene:', sceneNumber, 'with voice:', voice);
    console.log('Original text:', text);
    console.log('Cleaned text:', cleanedText);

    // Try OpenAI TTS-1-HD first (best quality, natural prosody at sentence boundaries)
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (OPENAI_API_KEY) {
      try {
        const base64Audio = await generateOpenAITTS(cleanedText, voice, OPENAI_API_KEY);
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        
        console.log('Voiceover generated with OpenAI TTS-1-HD for scene:', sceneNumber);
        
        return new Response(
          JSON.stringify({ audioUrl, sceneNumber }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (openaiError) {
        console.error('OpenAI TTS-1-HD failed, falling back to Google:', openaiError);
      }
    }

    // Fallback to Google Cloud TTS
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
        console.error('Google TTS also failed:', googleError);
        throw googleError;
      }
    }

    // No TTS API configured
    console.error('No TTS API key configured (OPENAI_API_KEY or GOOGLE_CLOUD_TTS_API_KEY)');
    return new Response(
      JSON.stringify({ error: 'No TTS API configured. Please add OPENAI_API_KEY or GOOGLE_CLOUD_TTS_API_KEY.' }),
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
