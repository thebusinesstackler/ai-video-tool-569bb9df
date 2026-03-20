/**
 * Utility functions for working with audio in the browser
 */

/**
 * Get the duration of an audio file from a base64 data URL
 */
export async function getAudioDuration(audioDataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let resolved = false;
    
    const done = (dur: number) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      // Clean up to free memory
      audio.removeAttribute('src');
      audio.load();
      resolve(dur);
    };

    const checkDuration = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        done(audio.duration);
        return true;
      }
      return false;
    };
    
    audio.addEventListener('loadedmetadata', () => {
      if (!checkDuration()) {
        // Duration not ready yet — wait for durationchange or canplaythrough
        audio.addEventListener('durationchange', () => checkDuration(), { once: true });
        audio.addEventListener('canplaythrough', () => {
          if (!checkDuration()) done(5);
        }, { once: true });
      }
    }, { once: true });
    
    audio.addEventListener('error', () => done(5));
    
    const timeout = setTimeout(() => {
      console.warn('Audio duration detection timed out, using default');
      done(5);
    }, 15000);
    
    // Use preload to ensure metadata is fetched
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
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
