// Client-side reel video utilities
// FFmpeg WASM removed — stitching now handled by creatomate-stitch (cloud) or canvasStitch (fallback)

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

// Escape text for FFmpeg drawtext filter
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%')
    .replace(/"/g, '\\"');
}

// Build karaoke-style caption filter
function buildKaraokeFilter(caption: string, duration: number, width: number, height: number): string {
  const words = caption.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
  }
  
  const wordDuration = duration / words.length;
  const fontSize = 52;
  const yPos = height - 200;
  
  // Start with scaling
  let filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
  
  // Add semi-transparent background for caption area
  filter += `,drawbox=x=0:y=${yPos - 60}:w=iw:h=180:color=black@0.7:t=fill`;
  
  // Show full caption in gray as background
  const fullCaption = escapeDrawtext(caption);
  filter += `,drawtext=text='${fullCaption}':fontsize=${fontSize}:fontcolor=white@0.4:x=(w-text_w)/2:y=${yPos}:borderw=2:bordercolor=black@0.3`;
  
  // Add highlighted word that changes based on timing
  // We'll show one word at a time in yellow in the center
  words.forEach((word, index) => {
    const startTime = index * wordDuration;
    const endTime = (index + 1) * wordDuration;
    const escapedWord = escapeDrawtext(word);
    
    filter += `,drawtext=text='${escapedWord}':fontsize=${fontSize + 8}:fontcolor=yellow:x=(w-text_w)/2:y=${yPos - 70}:borderw=3:bordercolor=black:enable='between(t\\,${startTime.toFixed(3)}\\,${endTime.toFixed(3)})'`;
  });
  
  return filter;
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
      console.log('FFmpeg progress:', progress);
    });

    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    onProgress?.(2, 'Loading video engine (this may take a moment)...');
    
    // Load FFmpeg WASM with timeout
    console.log('Loading FFmpeg WASM...');
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    
    const LOAD_TIMEOUT = 45000; // 45 seconds timeout
    
    const loadWithTimeout = async (): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Video engine loading timed out. Please refresh the page and try again.'));
        }, LOAD_TIMEOUT);
        
        try {
          onProgress?.(3, 'Downloading video engine core...');
          console.log('Fetching FFmpeg core JS...');
          const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
          
          onProgress?.(5, 'Downloading video processor (this is ~31MB)...');
          console.log('Fetching FFmpeg WASM (this may take a while)...');
          const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
          
          onProgress?.(10, 'Initializing video engine...');
          console.log('Loading FFmpeg with fetched URLs...');
          await ffmpeg.load({
            coreURL,
            wasmURL,
          });
          
          clearTimeout(timeoutId);
          resolve();
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    };
    
    try {
      await loadWithTimeout();
    } catch (loadError) {
      console.error('FFmpeg load error:', loadError);
      const errorMessage = loadError instanceof Error ? loadError.message : 'Unknown error';
      if (errorMessage.includes('timed out')) {
        throw new Error(errorMessage);
      }
      throw new Error(`Failed to load video engine: ${errorMessage}. Please refresh and try again.`);
    }
    
    console.log('FFmpeg loaded successfully');
    onProgress?.(15, 'Preparing images...');

    // Download and write each scene image
    const imageFiles: string[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageName = `scene${i}.jpg`;
      
      onProgress?.(15 + (i / scenes.length) * 15, `Loading scene ${i + 1}...`);
      
      try {
        let imageData: Uint8Array;
        
        if (scene.imageUrl.startsWith('data:')) {
          // Handle base64 images
          console.log(`Scene ${i + 1}: Processing base64 image...`);
          const base64Data = scene.imageUrl.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          imageData = bytes;
        } else {
          // Handle URL images
          console.log(`Scene ${i + 1}: Fetching image from URL...`);
          imageData = await fetchFile(scene.imageUrl);
        }
        
        if (imageData.length < 100) {
          throw new Error('Image data too small, likely invalid');
        }
        
        await ffmpeg.writeFile(imageName, imageData);
        imageFiles.push(imageName);
        console.log(`Wrote ${imageName}, size: ${imageData.length} bytes`);
      } catch (error) {
        console.error(`Failed to load scene ${i + 1}:`, error);
        throw new Error(`Failed to load image for scene ${i + 1}: ${error}`);
      }
    }

    onProgress?.(30, 'Creating video segments with captions...');

    // Create video segments for each scene with karaoke captions
    const segmentFiles: string[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageName = imageFiles[i];
      const outputName = `segment${i}.mp4`;
      
      onProgress?.(30 + (i / scenes.length) * 45, `Rendering scene ${i + 1} with word-by-word captions...`);
      console.log(`Creating segment ${i + 1}...`);
      
      // Build karaoke caption filter
      const filterComplex = buildKaraokeFilter(scene.caption, scene.duration, width, height);
      console.log(`Filter length: ${filterComplex.length}`);

      try {
        await ffmpeg.exec([
          '-loop', '1',
          '-i', imageName,
          '-vf', filterComplex,
          '-c:v', 'libx264',
          '-t', scene.duration.toString(),
          '-pix_fmt', 'yuv420p',
          '-r', '24',
          '-preset', 'ultrafast',
          '-crf', '28',
          outputName
        ]);
        
        // Verify segment was created
        const segmentData = await ffmpeg.readFile(outputName) as Uint8Array;
        if (segmentData.length < 1000) {
          throw new Error('Segment file too small');
        }
        console.log(`Created segment ${outputName}, size: ${segmentData.length}`);
        segmentFiles.push(outputName);
        
      } catch (error) {
        console.error(`Karaoke render failed for scene ${i + 1}:`, error);
        
        // Fallback: simple static caption
        console.log('Falling back to simple caption...');
        const simpleFilter = [
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
          `drawbox=x=0:y=ih-180:w=iw:h=150:color=black@0.7:t=fill`,
          `drawtext=text='${escapeDrawtext(scene.caption.substring(0, 60))}':fontsize=44:fontcolor=white:x=(w-text_w)/2:y=h-130:borderw=2:bordercolor=black`
        ].join(',');
        
        try {
          await ffmpeg.exec([
            '-loop', '1',
            '-i', imageName,
            '-vf', simpleFilter,
            '-c:v', 'libx264',
            '-t', scene.duration.toString(),
            '-pix_fmt', 'yuv420p',
            '-r', '24',
            '-preset', 'ultrafast',
            '-crf', '28',
            outputName
          ]);
          
          const segmentData = await ffmpeg.readFile(outputName) as Uint8Array;
          if (segmentData.length > 500) {
            segmentFiles.push(outputName);
            console.log(`Created simple segment ${outputName}`);
          } else {
            // Ultimate fallback: no captions
            console.log('Falling back to no captions...');
            const basicFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
            
            await ffmpeg.exec([
              '-loop', '1',
              '-i', imageName,
              '-vf', basicFilter,
              '-c:v', 'libx264',
              '-t', scene.duration.toString(),
              '-pix_fmt', 'yuv420p',
              '-r', '24',
              '-preset', 'ultrafast',
              outputName
            ]);
            
            segmentFiles.push(outputName);
          }
        } catch (fallbackError) {
          console.error('All render attempts failed for scene', i + 1);
          throw new Error(`Failed to render scene ${i + 1}`);
        }
      }
    }

    if (segmentFiles.length === 0) {
      throw new Error('No video segments were created');
    }

    onProgress?.(80, 'Combining scenes...');
    console.log('Concatenating segments:', segmentFiles);

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
    } catch (concatError) {
      console.log('Copy concat failed, trying re-encode:', concatError);
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-movflags', 'faststart',
        'output.mp4'
      ]);
    }

    onProgress?.(95, 'Finalizing video...');

    // Read output
    const outputData = await ffmpeg.readFile('output.mp4') as Uint8Array;
    console.log('Output file size:', outputData.length);
    
    if (outputData.length < 1000) {
      throw new Error('Output video is empty or corrupted');
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
