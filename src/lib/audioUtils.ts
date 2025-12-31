/**
 * Utility functions for working with audio in the browser
 */

/**
 * Clean script text for TTS by removing stage directions that would be spoken aloud.
 * Removes [BEAT], [PAUSE], and other bracketed commands.
 * Removes parenthetical directions like (slight laugh), (with conviction).
 * Converts pause markers to natural punctuation that TTS interprets as pauses.
 */
export function cleanScriptForTTS(script: string): string {
  if (!script) return '';
  
  return script
    // Replace [BEAT] and [PAUSE] with ellipsis for natural pauses
    .replace(/\[BEAT\]/gi, '...')
    .replace(/\[PAUSE\]/gi, '...')
    // Remove any other [bracketed] commands
    .replace(/\[.*?\]/g, '')
    // Remove parenthetical directions like (slight laugh), (with conviction)
    .replace(/\([^)]*\)/g, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Clean up multiple ellipses
    .replace(/\.\.\.(\s*\.\.\.)+/g, '...')
    // Clean up comma artifacts
    .replace(/,\s*,/g, ',')
    // Clean up leading/trailing whitespace
    .trim();
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
