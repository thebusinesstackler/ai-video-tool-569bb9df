import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DialogueLine {
  character: string;
  line: string;
  emotion?: string;
}

interface VoiceAssignment {
  characterName: string;
  voiceCloningKey?: string;
  speechifyVoiceId?: string;
  defaultVoice?: string;
}

interface MultiVoiceTTSRequest {
  dialogue: DialogueLine[];
  voiceAssignments: VoiceAssignment[];
  defaultVoice?: string;
}

// Google Cloud TTS with cloned voice
async function generateClonedVoiceTTS(
  text: string,
  apiKey: string,
  voiceCloningKey: string
): Promise<Uint8Array | null> {
  try {
    console.log('Generating cloned voice TTS for:', text.substring(0, 50));

    const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: 'en-US',
          voiceClone: { voiceCloningKey }
        },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
      }),
    });

    if (!response.ok) {
      console.error('Google cloned TTS error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    return null;
  } catch (error) {
    console.error('Cloned voice TTS error:', error);
    return null;
  }
}

// Speechify TTS
async function generateSpeechifyTTS(
  text: string,
  apiKey: string,
  voiceId: string
): Promise<Uint8Array | null> {
  try {
    console.log('Generating Speechify TTS for:', text.substring(0, 50));

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
      console.error('Speechify TTS error:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      if (jsonResponse.audio_data) {
        const binaryString = atob(jsonResponse.audio_data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }
    } else {
      const audioBuffer = await response.arrayBuffer();
      return new Uint8Array(audioBuffer);
    }
    return null;
  } catch (error) {
    console.error('Speechify TTS error:', error);
    return null;
  }
}

// Google Cloud TTS with standard voice
async function generateGoogleTTS(
  text: string,
  apiKey: string,
  voiceName: string = 'en-US-Journey-D'
): Promise<Uint8Array | null> {
  try {
    console.log('Generating Google TTS for:', text.substring(0, 50));

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: {
          languageCode: 'en-US',
          name: voiceName,
          ssmlGender: voiceName.includes('-F') ? 'FEMALE' : 'MALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0,
          effectsProfileId: ['headphone-class-device']
        }
      }),
    });

    if (!response.ok) {
      console.error('Google TTS error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.audioContent) {
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    return null;
  } catch (error) {
    console.error('Google TTS error:', error);
    return null;
  }
}

// Generate a small silence buffer (100ms) between dialogue lines
function generateSilence(durationMs: number = 300): Uint8Array {
  // Simple MP3 silence frame - this is a minimal valid MP3 frame
  // For production, you might want to use a proper silence audio file
  const silenceFrameCount = Math.ceil(durationMs / 26); // ~26ms per MP3 frame
  const silenceFrame = new Uint8Array([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  
  const totalLength = silenceFrame.length * silenceFrameCount;
  const result = new Uint8Array(totalLength);
  for (let i = 0; i < silenceFrameCount; i++) {
    result.set(silenceFrame, i * silenceFrame.length);
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dialogue, voiceAssignments, defaultVoice = 'en-US-Journey-D' } = await req.json() as MultiVoiceTTSRequest;

    if (!dialogue || !Array.isArray(dialogue) || dialogue.length === 0) {
      throw new Error('Dialogue array is required');
    }

    console.log(`Processing ${dialogue.length} dialogue lines with ${voiceAssignments?.length || 0} voice assignments`);

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    const speechifyApiKey = Deno.env.get('SPEECHIFY_API_KEY');

    if (!googleApiKey) {
      throw new Error('TTS API key not configured');
    }

    // Create a map of character -> voice assignment
    const voiceMap = new Map<string, VoiceAssignment>();
    if (voiceAssignments) {
      for (const assignment of voiceAssignments) {
        voiceMap.set(assignment.characterName.toLowerCase(), assignment);
      }
    }

    // Alternate voices for characters without assignments
    const alternateVoices = ['en-US-Journey-D', 'en-US-Journey-F', 'en-US-Neural2-D', 'en-US-Neural2-F'];
    const usedDefaultVoices = new Map<string, string>();
    let voiceIndex = 0;

    // Generate audio for each dialogue line
    const audioBuffers: Uint8Array[] = [];
    const silence = generateSilence(400); // 400ms pause between speakers

    for (let i = 0; i < dialogue.length; i++) {
      const line = dialogue[i];
      const characterLower = line.character.toLowerCase();
      
      // Clean the line - remove character name prefixes and stage directions
      let cleanedLine = line.line
        .replace(/\([^)]*\)/g, '') // Remove parentheses
        .replace(/\[[^\]]*\]/g, '') // Remove brackets
        .replace(/\*[^*]*\*/g, '') // Remove asterisks
        .replace(/^[A-Z][a-zA-Z\s]*:\s*/i, '') // Remove character prefix
        .trim();

      if (!cleanedLine) continue;

      let audioData: Uint8Array | null = null;

      // Try to find voice assignment for this character
      const voiceAssignment = voiceMap.get(characterLower);

      if (voiceAssignment) {
        // Try Speechify cloned voice first
        if (voiceAssignment.speechifyVoiceId && speechifyApiKey) {
          audioData = await generateSpeechifyTTS(cleanedLine, speechifyApiKey, voiceAssignment.speechifyVoiceId);
        }
        
        // Try Google cloned voice
        if (!audioData && voiceAssignment.voiceCloningKey && googleApiKey) {
          audioData = await generateClonedVoiceTTS(cleanedLine, googleApiKey, voiceAssignment.voiceCloningKey);
        }
        
        // Try default voice for this assignment
        if (!audioData && voiceAssignment.defaultVoice && googleApiKey) {
          audioData = await generateGoogleTTS(cleanedLine, googleApiKey, voiceAssignment.defaultVoice);
        }
      }

      // Fallback: assign alternating voices to different characters
      if (!audioData && googleApiKey) {
        let voiceToUse = usedDefaultVoices.get(characterLower);
        if (!voiceToUse) {
          voiceToUse = alternateVoices[voiceIndex % alternateVoices.length];
          usedDefaultVoices.set(characterLower, voiceToUse);
          voiceIndex++;
          console.log(`Assigned voice ${voiceToUse} to character ${line.character}`);
        }
        audioData = await generateGoogleTTS(cleanedLine, googleApiKey, voiceToUse);
      }

      if (audioData) {
        audioBuffers.push(audioData);
        
        // Add silence between speakers (except after last line)
        if (i < dialogue.length - 1) {
          audioBuffers.push(silence);
        }
        
        console.log(`Generated audio for ${line.character}: ${cleanedLine.substring(0, 30)}...`);
      } else {
        console.error(`Failed to generate audio for ${line.character}`);
      }
    }

    if (audioBuffers.length === 0) {
      throw new Error('Failed to generate any audio');
    }

    // Concatenate all audio buffers
    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const mergedAudio = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of audioBuffers) {
      mergedAudio.set(buffer, offset);
      offset += buffer.length;
    }

    // Convert to base64
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < mergedAudio.length; i += chunkSize) {
      const chunk = mergedAudio.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    console.log(`Generated multi-voice audio, total size: ${mergedAudio.length}, base64 length: ${base64Audio.length}`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        audioUrl: `data:audio/mp3;base64,${base64Audio}`,
        lineCount: dialogue.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Multi-voice TTS error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
