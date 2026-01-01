import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to upload base64 audio to Supabase storage and return HTTP URL
async function uploadAudioToStorage(base64Audio: string, userId?: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not available, returning base64 URL');
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Decode base64 to binary
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Generate unique filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const userFolder = userId || 'anonymous';
  const filePath = `${userFolder}/audio/${timestamp}-${random}.mp3`;
  
  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('reels')
    .upload(filePath, bytes, {
      contentType: 'audio/mpeg',
      upsert: false
    });
  
  if (error) {
    console.error('Failed to upload audio to storage:', error);
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('reels')
    .getPublicUrl(filePath);
  
  console.log('Audio uploaded to storage:', urlData.publicUrl);
  return urlData.publicUrl;
}

// Estimate audio duration based on text length (approx 2.5 words per second)
function estimateAudioDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 2.5);
}

// Clean script text for TTS by removing stage directions (for SSML-capable providers)
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
    // Clean up multiple ellipses (more than 2 sets)
    .replace(/(\.\.\.(\s*)?){3,}/g, '... ...')
    .replace(/\.\.\.(\s*\.\.\.)+/g, '... ...')
    // Clean up comma artifacts
    .replace(/,\s*,/g, ',')
    .trim();
}

// Format script for non-SSML TTS providers (Speechify) - optimized for public speaker delivery
function formatForNonSSMLTTS(script: string): string {
  if (!script) return '';
  
  let formatted = script
    // Step 1: Convert breath/inhale markers to dramatic pauses with comma for inflection
    .replace(/\(inhale\)/gi, '...')
    .replace(/\(breath\)/gi, '...')
    .replace(/\(deep breath\)/gi, '... ...')
    .replace(/\(sigh\)/gi, '...')
    .replace(/\(exhale\)/gi, '...')
    
    // Step 2: Convert pause markers
    .replace(/\(short pause\)/gi, ',')
    .replace(/\(pause\)/gi, '...')
    .replace(/\(long pause\)/gi, '... ...')
    .replace(/\[BEAT\]/gi, '...')
    .replace(/\[PAUSE\]/gi, '...')
    .replace(/\[LONG PAUSE\]/gi, '... ...')
    .replace(/\[SHORT PAUSE\]/gi, ',')
    
    // Step 3: Convert **STRONG EMPHASIS** to UPPERCASE with pauses for dramatic effect
    // This creates natural emphasis through capitalization + surrounding pauses
    .replace(/\*\*([^*]+)\*\*/g, (_, word) => {
      const upperWord = word.toUpperCase().trim();
      return `... ${upperWord}...`;
    })
    
    // Step 4: Convert *moderate emphasis* to word with preceding pause
    .replace(/\*([^*]+)\*/g, (_, word) => {
      return `... ${word.trim()}`;
    })
    
    // Step 5: Convert em-dashes to pauses
    .replace(/—/g, '...')
    .replace(/--/g, '...')
    
    // Step 6: Remove any remaining [bracketed] commands
    .replace(/\[.*?\]/g, '')
    
    // Step 7: Remove any remaining parenthetical directions (but keep the pause effect)
    .replace(/\([^)]*\)/g, '...')
    
    // Step 8: Add slight pauses around question marks and exclamation for inflection
    .replace(/\?(?!\s*\.\.\.)/g, '?...')
    .replace(/!(?!\s*\.\.\.)/g, '!...')
    
    // Step 9: Clean up - normalize multiple ellipses
    .replace(/\.{4,}/g, '...')
    .replace(/(\.\.\.(\s*)?){3,}/g, '... ...')
    .replace(/\.\.\.(\s*\.\.\.)+/g, '... ...')
    
    // Step 10: Clean up multiple spaces and comma artifacts
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\.\.\./g, '...')
    .replace(/\.\.\.\s*,/g, '...')
    
    .trim();
    
  console.log('Formatted for non-SSML TTS:', formatted.substring(0, 150) + '...');
  return formatted;
}

// Convert script to SSML for Google Cloud TTS with precise timing
function convertToSSML(script: string): string {
  if (!script) return '<speak></speak>';
  
  let ssml = script
    // Exact pause timings
    .replace(/\(short pause\)/gi, '<break time="300ms"/>')
    .replace(/\(pause\)/gi, '<break time="500ms"/>')
    .replace(/\(long pause\)/gi, '<break time="1s"/>')
    .replace(/\(breath\)/gi, '<break time="400ms"/>')
    .replace(/\(inhale\)/gi, '<break time="500ms"/>')
    .replace(/\(deep breath\)/gi, '<break time="800ms"/>')
    .replace(/\(sigh\)/gi, '<break time="600ms"/>')
    .replace(/\(exhale\)/gi, '<break time="400ms"/>')
    // Beat/pause markers
    .replace(/\[BEAT\]/gi, '<break time="400ms"/>')
    .replace(/\[PAUSE\]/gi, '<break time="500ms"/>')
    .replace(/\[LONG PAUSE\]/gi, '<break time="1s"/>')
    .replace(/\[SHORT PAUSE\]/gi, '<break time="300ms"/>')
    // Emphasis markers - strong (**text**)
    .replace(/\*\*([^*]+)\*\*/g, '<emphasis level="strong">$1</emphasis>')
    // Emphasis markers - moderate (*text*)
    .replace(/\*([^*]+)\*/g, '<emphasis level="moderate">$1</emphasis>')
    // Speaking rate changes
    .replace(/\(slower\)/gi, '<prosody rate="slow">')
    .replace(/\(end slower\)/gi, '</prosody>')
    .replace(/\(faster\)/gi, '<prosody rate="fast">')
    .replace(/\(end faster\)/gi, '</prosody>')
    .replace(/\(\/slower\)/gi, '</prosody>')
    .replace(/\(\/faster\)/gi, '</prosody>')
    // Remove any remaining parenthetical directions
    .replace(/\([^)]*\)/g, '')
    // Remove any remaining bracket commands
    .replace(/\[.*?\]/g, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
    
  return `<speak>${ssml}</speak>`;
}

// Check if script has SSML-convertible markers
function hasSSMLMarkers(script: string): boolean {
  if (!script) return false;
  
  const ssmlPatterns = [
    /\*\*[^*]+\*\*/,
    /\*[^*]+\*/,
    /\(slower\)/i,
    /\(faster\)/i,
    /\(short pause\)/i,
    /\(long pause\)/i,
  ];
  
  return ssmlPatterns.some(pattern => pattern.test(script));
}

// Voice configuration mapping
interface VoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE';
}

const GOOGLE_VOICES: Record<string, VoiceConfig> = {
  // Female voices
  'en-US-Journey-F': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' },
  'en-US-Neural2-F': { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  'en-US-Studio-O': { languageCode: 'en-US', name: 'en-US-Studio-O', ssmlGender: 'FEMALE' },
  'en-GB-Neural2-F': { languageCode: 'en-GB', name: 'en-GB-Neural2-F', ssmlGender: 'FEMALE' },
  // Male voices
  'en-US-Journey-D': { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' },
  'en-US-Neural2-D': { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
  'en-US-Studio-Q': { languageCode: 'en-US', name: 'en-US-Studio-Q', ssmlGender: 'MALE' },
  'en-GB-Neural2-D': { languageCode: 'en-GB', name: 'en-GB-Neural2-D', ssmlGender: 'MALE' },
};

// Default voice if none specified or not found
const DEFAULT_VOICE: VoiceConfig = { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' };

// Google Cloud TTS with actual voice cloning key (from generateVoiceCloningKey API)
async function generateClonedVoiceTTS(
  text: string,
  apiKey: string,
  voiceCloningKey: string,
  speakingRate: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Generating TTS with Google Cloud cloned voice');
    console.log('Voice cloning key length:', voiceCloningKey.length);

    // Use Google Cloud TTS with the actual voice cloning key
    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: 'en-US',
          voiceClone: {
            voiceCloningKey: voiceCloningKey
          }
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speakingRate,
          pitch: 0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Cloud cloned voice TTS error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      console.log('Google Cloud cloned voice TTS successful');
      return {
        audioContent: data.audioContent,
        audioUrl: `data:audio/mp3;base64,${data.audioContent}`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Cloned voice TTS error:', error);
    return null;
  }
}

// Google Cloud TTS - Primary engine for standard voices (with SSML support)
async function generateGoogleTTS(
  text: string, 
  apiKey: string, 
  voiceConfig: VoiceConfig,
  speakingRate: number = 1.0,
  useSSML: boolean = false
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    // Determine if we should use SSML
    const shouldUseSSML = useSSML || hasSSMLMarkers(text);
    const processedText = shouldUseSSML ? convertToSSML(text) : text;
    const inputType = shouldUseSSML ? 'ssml' : 'text';
    
    console.log(`Generating TTS with Google Cloud TTS using voice: ${voiceConfig.name}, SSML: ${shouldUseSSML}`);
    
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: inputType === 'ssml' 
          ? { ssml: processedText.length > 5000 ? processedText.substring(0, 5000) : processedText }
          : { text: processedText.length > 5000 ? processedText.substring(0, 5000) : processedText },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speakingRate,
          pitch: 0,
          effectsProfileId: ['headphone-class-device']
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google TTS error:', response.status, errorText);
      
      // If SSML failed, retry without SSML
      if (shouldUseSSML) {
        console.log('SSML failed, retrying with plain text...');
        return generateGoogleTTS(cleanScriptForTTS(text), apiKey, voiceConfig, speakingRate, false);
      }
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      console.log('Google Cloud TTS successful with voice:', voiceConfig.name, shouldUseSSML ? '(SSML)' : '(plain text)');
      return {
        audioContent: data.audioContent,
        audioUrl: `data:audio/mp3;base64,${data.audioContent}`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Google TTS error:', error);
    return null;
  }
}

// Poll for WaveSpeed TTS result (fallback)
async function pollWaveSpeedTTSResult(taskId: string, apiKey: string, maxAttempts: number = 60): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        console.error('TTS poll error:', response.status);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const data = await response.json();
      console.log('TTS poll result:', data.data?.status);
      
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          const audioUrl = data.data.outputs?.[0];
          if (audioUrl) {
            console.log('TTS completed, audio URL:', audioUrl);
            return audioUrl;
          }
        } else if (data.data.status === 'failed') {
          console.error('TTS task failed:', data.data.error);
          return null;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('TTS poll error:', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('TTS polling timed out');
  return null;
}

// WaveSpeed TTS fallback
async function generateWaveSpeedTTS(
  text: string, 
  apiKey: string,
  speed: number = 1
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Generating TTS with WaveSpeed MiniMax Speech-02-HD');
    
    const ttsResponse = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.length > 10000 ? text.substring(0, 10000) : text,
        voice_id: 'English_Trustworth_Man',
        speed: speed,
        volume: 1,
        pitch: 0,
        emotion: 'neutral',
        english_normalization: true
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('WaveSpeed TTS error:', ttsResponse.status, errorText);
      return null;
    }

    const ttsData = await ttsResponse.json();
    
    if (ttsData.code !== 200 || !ttsData.data?.id) {
      console.error('WaveSpeed TTS error:', ttsData.message);
      return null;
    }

    // Poll for result
    const audioUrl = await pollWaveSpeedTTSResult(ttsData.data.id, apiKey);
    
    if (!audioUrl) {
      return null;
    }

    // Fetch the audio file and convert to base64
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return null;
    }

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);
    
    // Convert to base64 in chunks
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      const chunk = audioBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    console.log('WaveSpeed TTS generation successful');
    return { audioContent: base64Audio, audioUrl };
  } catch (error) {
    console.error('WaveSpeed TTS error:', error);
    return null;
  }
}

// Speechify TTS with cloned voice
async function generateSpeechifyTTS(
  text: string,
  apiKey: string,
  voiceId: string,
  speed: number = 1.0
): Promise<{ audioContent: string; audioUrl: string } | null> {
  try {
    console.log('Generating TTS with Speechify cloned voice:', voiceId);

    const response = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text.length > 5000 ? text.substring(0, 5000) : text,
        voice_id: voiceId,
        audio_format: 'mp3'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Speechify TTS error:', response.status, errorText);
      return null;
    }

    // Check content type to determine how to handle response
    const contentType = response.headers.get('content-type') || '';
    console.log('Speechify response content-type:', contentType);
    
    let base64Audio: string;
    
    if (contentType.includes('application/json')) {
      // Speechify returns JSON with audio_data field
      const jsonResponse = await response.json();
      console.log('Speechify returned JSON response');
      if (jsonResponse.audio_data) {
        base64Audio = jsonResponse.audio_data;
      } else {
        console.error('Speechify JSON response missing audio_data');
        return null;
      }
    } else {
      // Speechify returns audio as binary data
      const audioBuffer = await response.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);
      
      // Convert to base64
      let binary = '';
      const chunkSize = 32768;
      for (let i = 0; i < audioBytes.length; i += chunkSize) {
        const chunk = audioBytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64Audio = btoa(binary);
    }

    console.log('Speechify TTS successful, audio base64 length:', base64Audio.length);
    return {
      audioContent: base64Audio,
      audioUrl: `data:audio/mp3;base64,${base64Audio}`
    };
  } catch (error) {
    console.error('Speechify TTS error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'en-US-Journey-D', speed = 1, voiceCloningKey, speechifyVoiceId, voiceId, userId } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    // Clean the script to remove stage directions before TTS
    const cleanedText = cleanScriptForTTS(text);
    console.log(`Cleaned script for TTS: "${text.substring(0, 100)}..." -> "${cleanedText.substring(0, 100)}..."`);

    // Support both voiceCloningKey and voiceId (alias)
    const effectiveVoiceCloningKey = voiceCloningKey || voiceId;

    console.log(`TTS request - Voice: ${voice}, Text length: ${cleanedText.length}, Has cloning key: ${!!effectiveVoiceCloningKey}, Has Speechify ID: ${!!speechifyVoiceId}`);

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');
    
    let result: { audioContent: string; audioUrl: string } | null = null;
    let provider = 'unknown';
    let isClonedVoice = false;
    
    // Priority 1: Speechify cloned voice (new system)
    // Use non-SSML formatter for Speechify since it doesn't support SSML
    if (speechifyVoiceId && speechifyApiKey) {
      console.log('Attempting Speechify cloned voice generation...');
      const speechifyFormattedText = formatForNonSSMLTTS(text);
      result = await generateSpeechifyTTS(speechifyFormattedText, speechifyApiKey, speechifyVoiceId, speed);
      if (result) {
        provider = 'speechify';
        isClonedVoice = true;
      } else {
        console.log('Speechify TTS failed, falling back...');
      }
    }
    
    // Priority 2: Google Cloud cloned voice (legacy system)
    if (!result && effectiveVoiceCloningKey && googleApiKey) {
      console.log('Attempting Google cloned voice generation with stored key...');
      result = await generateClonedVoiceTTS(cleanedText, googleApiKey, effectiveVoiceCloningKey, speed);
      if (result) {
        provider = 'google-cloned';
        isClonedVoice = true;
      } else {
        console.log('Cloned voice failed, falling back to standard voice...');
      }
    }
    
    // Priority 3: Google Cloud standard TTS
    if (!result && googleApiKey) {
      const voiceConfig = GOOGLE_VOICES[voice] || DEFAULT_VOICE;
      result = await generateGoogleTTS(cleanedText, googleApiKey, voiceConfig, speed);
      if (result) {
        provider = 'google';
      } else {
        console.log('Google TTS failed, trying fallback...');
      }
    }
    
    // Priority 4: WaveSpeed fallback
    if (!result && waveSpeedApiKey) {
      console.log('Attempting WaveSpeed TTS fallback...');
      result = await generateWaveSpeedTTS(cleanedText, waveSpeedApiKey, speed);
      if (result) {
        provider = 'wavespeed';
      }
    }
    
    if (!result) {
      throw new Error('No TTS engine available or all attempts failed');
    }
    
    // Upload audio to storage and get HTTP URL
    const httpAudioUrl = await uploadAudioToStorage(result.audioContent, userId);
    const estimatedDuration = estimateAudioDuration(text);
    
    console.log(`TTS complete - Provider: ${provider}, Duration estimate: ${estimatedDuration}s, URL type: ${httpAudioUrl.startsWith('http') ? 'HTTP' : 'base64'}`);
    
    return new Response(
      JSON.stringify({ 
        audioContent: result.audioContent,
        audioUrl: httpAudioUrl,
        isClonedVoice,
        provider,
        duration: estimatedDuration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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