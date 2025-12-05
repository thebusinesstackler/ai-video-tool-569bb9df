// Client-side reel video creation using FFmpeg WASM
// Creates a TikTok-ready MP4 from images with burned-in captions

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface SceneInput {
  sceneNumber: number;
  imageUrl: string;
  caption: string;
  duration: number; // seconds
}

interface CreateReelOptions {
  scenes: SceneInput[];
  width?: number;
  height?: number;
  onProgress?: (percent: number, status: string) => void;
}

export async function createReelVideo(options: CreateReelOptions): Promise<Blob> {
  const { scenes, width = 1080, height = 1920, onProgress } = options;
  
  if (!scenes || scenes.length === 0) {
    throw new Error('No scenes provided');
  }

  console.log('Creating reel video with', scenes.length, 'scenes');
  
  const ffmpeg = new FFmpeg();
  
  try {
    // Progress tracking
    ffmpeg.on('progress', ({ progress }) => {
      const percent = Math.min(95, Math.round((progress || 0) * 80) + 15);
      onProgress?.(percent, 'Rendering video...');
    });

    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    onProgress?.(5, 'Loading video engine...');
    
    // Load FFmpeg WASM
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    console.log('FFmpeg loaded successfully');
    onProgress?.(10, 'Preparing images...');

    // Download and write each scene image
    const imageFiles: string[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageName = `scene${i}.png`;
      
      onProgress?.(10 + (i / scenes.length) * 5, `Loading scene ${i + 1}...`);
      
      try {
        // Handle base64 images
        let imageData: Uint8Array;
        if (scene.imageUrl.startsWith('data:')) {
          const base64Data = scene.imageUrl.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          imageData = bytes;
        } else {
          imageData = await fetchFile(scene.imageUrl);
        }
        
        await ffmpeg.writeFile(imageName, imageData);
        imageFiles.push(imageName);
        console.log(`Wrote ${imageName}, size: ${imageData.length} bytes`);
      } catch (error) {
        console.error(`Failed to load scene ${i + 1}:`, error);
        throw new Error(`Failed to load image for scene ${i + 1}`);
      }
    }

    onProgress?.(15, 'Creating video segments...');

    // Create video segments for each scene with captions
    const segmentFiles: string[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageName = imageFiles[i];
      const outputName = `segment${i}.mp4`;
      
      onProgress?.(15 + (i / scenes.length) * 60, `Rendering scene ${i + 1} with caption...`);
      
      // Escape caption text for FFmpeg drawtext filter
      const escapedCaption = scene.caption
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\''")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\n/g, ' ');
      
      // Create video from image with caption overlay
      // Using drawtext filter for burned-in captions
      const filterComplex = [
        // Scale image to target dimensions
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
        // Add caption at bottom with TikTok-style formatting
        `drawtext=text='${escapedCaption}':fontcolor=white:fontsize=48:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:line_spacing=10`
      ].join(',');

      try {
        await ffmpeg.exec([
          '-loop', '1',
          '-i', imageName,
          '-vf', filterComplex,
          '-c:v', 'libx264',
          '-t', scene.duration.toString(),
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          outputName
        ]);
        
        segmentFiles.push(outputName);
        console.log(`Created segment ${outputName}`);
      } catch (error) {
        console.error(`Failed to create segment ${i + 1}:`, error);
        throw new Error(`Failed to render scene ${i + 1}`);
      }
    }

    onProgress?.(80, 'Combining scenes...');

    // Create concat list
    const concatList = segmentFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

    // Concatenate all segments
    try {
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        '-movflags', 'faststart',
        'output.mp4'
      ]);
      console.log('Concatenation successful');
    } catch (error) {
      console.log('Copy concat failed, trying re-encode:', error);
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', 'faststart',
        'output.mp4'
      ]);
    }

    onProgress?.(95, 'Finalizing video...');

    // Read output
    const outputData = await ffmpeg.readFile('output.mp4') as Uint8Array;
    
    if (outputData.length === 0) {
      throw new Error('Output video is empty');
    }

    // Create blob from the output data
    const blob = new Blob([outputData.slice().buffer], { type: 'video/mp4' });
    console.log('Created video blob, size:', blob.size, 'bytes');
    
    onProgress?.(100, 'Complete!');
    
    return blob;
    
  } catch (error) {
    console.error('Reel creation failed:', error);
    throw error;
  }
}

export function downloadVideo(blob: Blob, filename: string = 'reel.mp4') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
