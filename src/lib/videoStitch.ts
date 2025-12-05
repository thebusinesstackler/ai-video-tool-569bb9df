// Minimal client-side video stitching using ffmpeg.wasm
// Concatenates MP4 clips and optionally adds audio track

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface StitchOptions {
  videoUrls: string[];
  audioUrls?: string[]; // Audio files to concatenate and add as voiceover
  onProgress?: (percent: number) => void;
}

// Cache for loaded FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }
  
  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }
  
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg log:', message);
    });
    
    console.log('Loading FFmpeg...');
    
    // Use unpkg CDN as primary (more reliable)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      console.log('FFmpeg loaded successfully');
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.log('Primary CDN failed, trying jsdelivr...');
      
      // Fallback to jsdelivr
      const fallbackURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      console.log('FFmpeg loaded from fallback CDN');
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    }
  })();
  
  return ffmpegLoadPromise;
}

export async function stitchVideosWithAudio(options: StitchOptions): Promise<Blob> {
  const { videoUrls, audioUrls = [], onProgress } = options;
  
  if (!videoUrls || videoUrls.length === 0) throw new Error('No video URLs provided');

  console.log('Starting video stitching for', videoUrls.length, 'videos and', audioUrls.length, 'audio files');
  
  try {
    // Get or load FFmpeg with timeout
    const ffmpegPromise = getFFmpeg();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('FFmpeg load timeout after 120 seconds')), 120000);
    });
    
    const ffmpeg = await Promise.race([ffmpegPromise, timeoutPromise]);
    
    // Add progress tracking
    ffmpeg.on('progress', ({ progress }) => {
      console.log('FFmpeg progress:', progress);
      if (onProgress) onProgress(Math.round((progress || 0) * 100));
    });

    // Write all video parts to the FS
    const videoPartNames: string[] = [];
    console.log('Downloading and writing video files...');
    
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `video${i}.mp4`;
      console.log(`Downloading video ${i + 1}/${videoUrls.length}: ${videoUrls[i].substring(0, 100)}...`);
      
      try {
        const data = await fetchFile(videoUrls[i]);
        await ffmpeg.writeFile(name, data);
        videoPartNames.push(name);
        console.log(`Successfully wrote ${name}, size: ${data.length} bytes`);
      } catch (error) {
        console.error(`Failed to download/write video ${videoUrls[i]}:`, error);
        throw new Error(`Failed to download video segment ${i + 1}: ${error}`);
      }
    }

    // Write audio files if provided
    const audioPartNames: string[] = [];
    if (audioUrls.length > 0) {
      console.log('Downloading and writing audio files...');
      for (let i = 0; i < audioUrls.length; i++) {
        const name = `audio${i}.mp3`;
        console.log(`Downloading audio ${i + 1}/${audioUrls.length}`);
        
        try {
          // Handle base64 data URLs
          let data: Uint8Array;
          if (audioUrls[i].startsWith('data:')) {
            const base64 = audioUrls[i].split(',')[1];
            const binary = atob(base64);
            data = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) {
              data[j] = binary.charCodeAt(j);
            }
          } else {
            data = await fetchFile(audioUrls[i]);
          }
          await ffmpeg.writeFile(name, data);
          audioPartNames.push(name);
          console.log(`Successfully wrote ${name}, size: ${data.length} bytes`);
        } catch (error) {
          console.error(`Failed to download/write audio ${i}:`, error);
          // Continue without this audio file
        }
      }
    }

    // Create unique output filename to avoid conflicts
    const timestamp = Date.now();
    const outputName = `output_${timestamp}.mp4`;

    // Step 1: Concatenate videos
    const videoConcatList = videoPartNames.map((n) => `file '${n}'`).join('\n');
    console.log('Video concat list:', videoConcatList);
    await ffmpeg.writeFile('video_concat.txt', new TextEncoder().encode(videoConcatList));

    console.log('Concatenating videos...');
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'video_concat.txt', '-c', 'copy', 'concat_video.mp4']);
    console.log('Video concatenation successful');

    // Step 2: If we have audio, concatenate and merge
    if (audioPartNames.length > 0) {
      // Concatenate audio files
      const audioConcatList = audioPartNames.map((n) => `file '${n}'`).join('\n');
      console.log('Audio concat list:', audioConcatList);
      await ffmpeg.writeFile('audio_concat.txt', new TextEncoder().encode(audioConcatList));
      
      console.log('Concatenating audio files...');
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'audio_concat.txt', '-c', 'copy', 'concat_audio.mp3']);
      console.log('Audio concatenation successful');
      
      // Merge video and audio
      console.log('Merging video with audio...');
      try {
        // Try to merge with shortest duration
        await ffmpeg.exec([
          '-i', 'concat_video.mp4',
          '-i', 'concat_audio.mp3',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-shortest',
          '-movflags', 'faststart',
          outputName
        ]);
        console.log('Video-audio merge successful');
      } catch (mergeErr) {
        console.log('Merge failed, using video only:', mergeErr);
        // If merge fails, just use the concatenated video
        await ffmpeg.exec(['-i', 'concat_video.mp4', '-c', 'copy', outputName]);
      }
    } else {
      // No audio, just copy the concatenated video
      console.log('No audio to add, using video only');
      await ffmpeg.exec(['-i', 'concat_video.mp4', '-c', 'copy', outputName]);
    }

    console.log('Reading output file...');
    const out = (await ffmpeg.readFile(outputName)) as Uint8Array;
    console.log('Output file size:', out.length, 'bytes');
    
    // Cleanup temp files
    try {
      for (const name of videoPartNames) {
        await ffmpeg.deleteFile(name);
      }
      for (const name of audioPartNames) {
        await ffmpeg.deleteFile(name);
      }
      await ffmpeg.deleteFile('video_concat.txt');
      await ffmpeg.deleteFile('concat_video.mp4');
      if (audioPartNames.length > 0) {
        await ffmpeg.deleteFile('audio_concat.txt');
        await ffmpeg.deleteFile('concat_audio.mp3');
      }
      await ffmpeg.deleteFile(outputName);
    } catch (cleanupError) {
      console.log('Cleanup warning:', cleanupError);
    }
    
    if (out.length === 0) {
      throw new Error('Output video file is empty - processing may have failed');
    }
    
    const blob = new Blob([new Uint8Array(out.buffer as ArrayBuffer)], { type: 'video/mp4' });
    console.log('Successfully created final video blob, size:', blob.size);
    return blob;
    
  } catch (error) {
    // Reset cached instance on error so next attempt tries fresh
    if (error instanceof Error && error.message.includes('timeout')) {
      ffmpegInstance = null;
      ffmpegLoadPromise = null;
    }
    console.error('FFmpeg processing failed:', error);
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
  }
}

// Legacy function for backwards compatibility
export async function stitchVideos(urls: string[], onProgress?: (percent: number) => void): Promise<Blob> {
  return stitchVideosWithAudio({ videoUrls: urls, onProgress });
}
