/**
 * Utility functions for working with audio in the browser
 */

/**
 * Clean script text for TTS by removing stage directions that would be spoken aloud.
 * Converts breath/pause markers to natural punctuation, removes [BEAT], [PAUSE], 
 * and parenthetical directions like (slight laugh), (with conviction).
 * The TTS engine interprets "..." as natural pauses.
 */
export function cleanScriptForTTS(script: string): string {
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
    // Clean up leading/trailing whitespace
    .trim();
}

/**
 * Convert script with formatting markers to SSML for Google Cloud TTS.
 * Supports precise pause timings, emphasis, and rate changes.
 * 
 * Supported markers:
 * - (short pause), (pause), (long pause) → <break time="..."/>
 * - (breath), (inhale) → <break time="400ms"/>
 * - **text** → <emphasis level="strong">text</emphasis>
 * - *text* → <emphasis level="moderate">text</emphasis>
 * - (slower)...(end slower) → <prosody rate="slow">...</prosody>
 * - (faster)...(end faster) → <prosody rate="fast">...</prosody>
 */
export function convertToSSML(script: string): string {
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

/**
 * Check if a script contains SSML-convertible markers.
 * Returns true if the script has markers that would benefit from SSML.
 */
export function hasSSMLMarkers(script: string): boolean {
  if (!script) return false;
  
  const ssmlPatterns = [
    /\*\*[^*]+\*\*/,           // Strong emphasis
    /\*[^*]+\*/,              // Moderate emphasis
    /\(slower\)/i,            // Rate changes
    /\(faster\)/i,
    /\(short pause\)/i,       // Timed pauses
    /\(long pause\)/i,
  ];
  
  return ssmlPatterns.some(pattern => pattern.test(script));
}

/**
 * Get the duration of an audio file from a base64 data URL
 */
export async function getAudioDuration(audioDataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.addEventListener('loadedmetadata', () => {
      // Ensure we have a valid duration
      if (audio.duration && isFinite(audio.duration)) {
        resolve(audio.duration);
      } else {
        // Fallback: wait for canplaythrough event
        audio.addEventListener('canplaythrough', () => {
          resolve(audio.duration || 5);
        }, { once: true });
      }
    });
    
    audio.addEventListener('error', (e) => {
      console.error('Audio loading error:', e);
      // Return default duration on error
      resolve(5);
    });
    
    // Set a timeout in case the audio never loads
    const timeout = setTimeout(() => {
      console.warn('Audio duration detection timed out, using default');
      resolve(5);
    }, 10000);
    
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
    }, { once: true });
    
    audio.src = audioDataUrl;
    audio.load();
  });
}

/**
 * Convert base64 audio to a Blob
 */
export function base64ToAudioBlob(base64DataUrl: string): Blob {
  // Extract the base64 content and mime type
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URL');
  }
  
  const mimeType = matches[1];
  const base64 = matches[2];
  
  // Decode base64
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: mimeType });
}

/**
 * Upload audio blob to Supabase storage and get public URL
 */
export async function uploadAudioToStorage(
  supabase: any,
  audioBlob: Blob,
  userId: string,
  sceneNumber: number
): Promise<string | null> {
  try {
    const fileName = `${userId}/${Date.now()}-scene-${sceneNumber}.mp3`;
    
    const { data, error } = await supabase.storage
      .from('reels')
      .upload(fileName, audioBlob, { 
        contentType: 'audio/mp3',
        cacheControl: '3600'
      });
    
    if (error) {
      console.error('Audio upload error:', error);
      return null;
    }
    
    const { data: publicUrl } = supabase.storage
      .from('reels')
      .getPublicUrl(fileName);
    
    return publicUrl.publicUrl;
  } catch (error) {
    console.error('Error uploading audio:', error);
    return null;
  }
}
