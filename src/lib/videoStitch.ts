// Minimal client-side video stitching using ffmpeg.wasm
// Concatenates MP4 clips and optionally adds audio track

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface StitchOptions {
  videoUrls: string[];
  audioUrls?: string[]; // Audio files to concatenate and add as voiceover
  onProgress?: (percent: number) => void;
}

export async function stitchVideosWithAudio(options: StitchOptions): Promise<Blob> {
  const { videoUrls, audioUrls = [], onProgress } = options;
  
  if (!videoUrls || videoUrls.length === 0) throw new Error('No video URLs provided');

  console.log('Starting video stitching for', videoUrls.length, 'videos and', audioUrls.length, 'audio files');
  
  const ffmpeg = new FFmpeg();
  let ffmpegLoaded = false;
  
  try {
    // Add progress tracking
    ffmpeg.on('progress', ({ progress }) => {
      console.log('FFmpeg progress:', progress);
      if (onProgress) onProgress(Math.round((progress || 0) * 100));
    });

    // Add logging for debugging
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg log:', message);
    });

    console.log('Loading FFmpeg...');
    
    // Using @ffmpeg/core (single-threaded) from jsdelivr
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    
    console.log(`Loading FFmpeg core from: ${baseURL}`);
    
    // Create a timeout promise for loading
    const loadTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('FFmpeg load timeout after 90 seconds')), 90000);
    });
    
    // Race between loading and timeout
    await Promise.race([
      ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      }),
      loadTimeout
    ]);
    
    ffmpegLoaded = true;
    console.log('FFmpeg loaded successfully');

    // Write all video parts to the FS
    const videoPartNames: string[] = [];
    console.log('Downloading and writing video files...');
    
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `video${i}.mp4`;
      console.log(`Downloading video ${i + 1}/${videoUrls.length}: ${videoUrls[i]}`);
      
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
          'output.mp4'
        ]);
        console.log('Video-audio merge successful');
      } catch (mergeErr) {
        console.log('Merge failed, using video only:', mergeErr);
        // If merge fails, just use the concatenated video
        await ffmpeg.exec(['-i', 'concat_video.mp4', '-c', 'copy', 'output.mp4']);
      }
    } else {
      // No audio, just rename the concatenated video
      console.log('No audio to add, using video only');
      await ffmpeg.exec(['-i', 'concat_video.mp4', '-c', 'copy', 'output.mp4']);
    }

    console.log('Reading output file...');
    const out = (await ffmpeg.readFile('output.mp4')) as Uint8Array;
    console.log('Output file size:', out.length, 'bytes');
    
    if (out.length === 0) {
      throw new Error('Output video file is empty - processing may have failed');
    }
    
    const blob = new Blob([new Uint8Array(out.buffer as ArrayBuffer)], { type: 'video/mp4' });
    console.log('Successfully created final video blob, size:', blob.size);
    return blob;
    
  } catch (error) {
    console.error('FFmpeg processing failed:', error);
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
  }
}

// Legacy function for backwards compatibility
export async function stitchVideos(urls: string[], onProgress?: (percent: number) => void): Promise<Blob> {
  return stitchVideosWithAudio({ videoUrls: urls, onProgress });
}
