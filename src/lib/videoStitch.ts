// Minimal client-side video stitching using ffmpeg.wasm
// Concatenates MP4 clips and optionally adds audio track

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface StitchOptions {
  videoUrls: string[];
  audioUrls?: string[]; // Audio files to concatenate and add as voiceover
  transitions?: string[]; // Transition types between each video (fade, dissolve, etc.)
  onProgress?: (percent: number) => void;
}

// Cache for loaded FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function fetchWithTimeout(url: string, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function toBlobURLWithRetry(url: string, mimeType: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await toBlobURL(url, mimeType);
    } catch (e) {
      if (i === retries) throw e;
      console.log(`toBlobURL attempt ${i + 1} failed for ${url}, retrying...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Unreachable');
}

const CDN_SOURCES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
  'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg.wasm-core/0.12.6',
];

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg log:', message);
    });
    
    console.log('Loading FFmpeg...');
    
    for (const baseURL of CDN_SOURCES) {
      try {
        const coreURL = await toBlobURLWithRetry(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURLWithRetry(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
        
        await ffmpeg.load({ coreURL, wasmURL });
        
        console.log('FFmpeg loaded successfully from', baseURL);
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      } catch (error) {
        console.warn(`FFmpeg load failed from ${baseURL}:`, error);
      }
    }
    
    throw new Error('FFmpeg failed to load from all CDN sources. Try using cloud stitching instead.');
  })();
  
  // Add a generous timeout but reset the promise on failure
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      ffmpegLoadPromise = null;
      reject(new Error('FFmpeg load timeout after 180 seconds. Try using cloud stitching instead.'));
    }, 180000);
  });
  
  try {
    return await Promise.race([ffmpegLoadPromise, timeoutPromise]);
  } catch (e) {
    ffmpegLoadPromise = null;
    throw e;
  }
}

export async function stitchVideosWithAudio(options: StitchOptions): Promise<Blob> {
  const { videoUrls, audioUrls = [], transitions = [], onProgress } = options;
  
  if (!videoUrls || videoUrls.length === 0) throw new Error('No video URLs provided');

  console.log('Starting video stitching for', videoUrls.length, 'videos,', audioUrls.length, 'audio files, and', transitions.length, 'transitions');
  
  try {
    const ffmpeg = await getFFmpeg();
    
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
        }
      }
    }

    const timestamp = Date.now();
    const outputName = `output_${timestamp}.mp4`;

    const hasTransitions = transitions.length > 0 && videoPartNames.length > 1;
    
    if (hasTransitions && videoPartNames.length >= 2) {
      console.log('Applying transitions between videos...');
      
      const transitionMap: Record<string, string> = {
        'cross-dissolve': 'dissolve',
        'dissolve': 'dissolve',
        'fade': 'fade',
        'fade-to-black': 'fadeblack',
        'fade-from-black': 'fadeblack',
        'wipe-left': 'wipeleft',
        'wipe-right': 'wiperight',
        'slide-left': 'slideleft',
        'slide-right': 'slideright',
        'hard-cut': 'fade',
        'default': 'fade'
      };
      
      const transitionDuration = 0.5;
      
      try {
        for (let i = 0; i < videoPartNames.length; i++) {
          await ffmpeg.exec([
            '-i', videoPartNames[i],
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-r', '30',
            '-y',
            `reenc${i}.mp4`
          ]);
        }
        
        if (videoPartNames.length === 2) {
          const transType = transitionMap[transitions[0]?.toLowerCase()] || 'fade';
          await ffmpeg.exec([
            '-i', 'reenc0.mp4',
            '-i', 'reenc1.mp4',
            '-filter_complex', `[0:v][1:v]xfade=transition=${transType}:duration=${transitionDuration}:offset=4[v]`,
            '-map', '[v]',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-y',
            'concat_video.mp4'
          ]);
        } else {
          let currentOutput = 'reenc0.mp4';
          
          for (let i = 1; i < videoPartNames.length; i++) {
            const transType = transitionMap[transitions[i - 1]?.toLowerCase()] || 'fade';
            const tempOutput = i === videoPartNames.length - 1 ? 'concat_video.mp4' : `trans_temp${i}.mp4`;
            
            await ffmpeg.exec([
              '-i', currentOutput,
              '-i', `reenc${i}.mp4`,
              '-filter_complex', `[0:v][1:v]xfade=transition=${transType}:duration=${transitionDuration}:offset=4[v]`,
              '-map', '[v]',
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-y',
              tempOutput
            ]);
            
            if (currentOutput.startsWith('trans_temp')) {
              try { await ffmpeg.deleteFile(currentOutput); } catch {}
            }
            
            currentOutput = tempOutput;
          }
        }
        
        console.log('Transitions applied successfully');
      } catch (transitionError) {
        console.log('Transition processing failed, falling back to simple concat:', transitionError);
        const videoConcatList = videoPartNames.map((n) => `file '${n}'`).join('\n');
        await ffmpeg.writeFile('video_concat.txt', new TextEncoder().encode(videoConcatList));
        await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'video_concat.txt', '-c', 'copy', 'concat_video.mp4']);
      }
    } else {
      const videoConcatList = videoPartNames.map((n) => `file '${n}'`).join('\n');
      console.log('Video concat list:', videoConcatList);
      await ffmpeg.writeFile('video_concat.txt', new TextEncoder().encode(videoConcatList));

      console.log('Concatenating videos...');
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'video_concat.txt', '-c', 'copy', 'concat_video.mp4']);
      console.log('Video concatenation successful');
    }

    if (audioPartNames.length > 0) {
      const audioConcatList = audioPartNames.map((n) => `file '${n}'`).join('\n');
      console.log('Audio concat list:', audioConcatList);
      await ffmpeg.writeFile('audio_concat.txt', new TextEncoder().encode(audioConcatList));
      
      console.log('Concatenating audio files...');
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'audio_concat.txt', '-c', 'copy', 'concat_audio.mp3']);
      console.log('Audio concatenation successful');
      
      console.log('Merging video with audio...');
      try {
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
        await ffmpeg.exec(['-i', 'concat_video.mp4', '-c', 'copy', outputName]);
      }
    } else {
      console.log('No audio to add, using video only');
      await ffmpeg.exec(['-i', 'concat_video.mp4', '-c', 'copy', outputName]);
    }

    console.log('Reading output file...');
    const out = (await ffmpeg.readFile(outputName)) as Uint8Array;
    console.log('Output file size:', out.length, 'bytes');
    
    // Cleanup temp files
    try {
      for (const name of videoPartNames) { await ffmpeg.deleteFile(name); }
      for (const name of audioPartNames) { await ffmpeg.deleteFile(name); }
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
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('failed to load'))) {
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
