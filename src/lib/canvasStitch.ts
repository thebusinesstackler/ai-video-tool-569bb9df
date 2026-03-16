// Canvas-based video stitcher using HTML5 Canvas + MediaRecorder
// No external dependencies - works in all modern browsers

interface CanvasStitchOptions {
  videoUrls: string[];
  audioUrls?: string[];
  /** Indices into videoUrls that have embedded audio to extract */
  embeddedAudioIndices?: number[];
  width?: number;
  height?: number;
  onProgress?: (percent: number) => void;
  onStatus?: (status: string) => void;
}

/**
 * Preloads a video element and returns it ready to play
 */
function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true; // Must be muted for canvas capture
    video.playsInline = true;
    video.preload = 'auto';
    
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error(`Failed to load video: ${url.substring(0, 80)}...`));
    
    // Timeout after 30s
    const timeout = setTimeout(() => reject(new Error('Video load timeout')), 30000);
    video.onloadeddata = () => {
      clearTimeout(timeout);
      resolve(video);
    };
    
    video.src = url;
    video.load();
  });
}

/**
 * Fetches and decodes an audio file into an AudioBuffer
 */
async function loadAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let arrayBuffer: ArrayBuffer;
  
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    arrayBuffer = bytes.buffer;
  } else {
    const resp = await fetch(url);
    arrayBuffer = await resp.arrayBuffer();
  }
  
  return ctx.decodeAudioData(arrayBuffer);
}

/**
 * Concatenates multiple AudioBuffers into one
 */
function concatAudioBuffers(ctx: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const sampleRate = buffers[0]?.sampleRate || 44100;
  const channels = Math.max(...buffers.map(b => b.numberOfChannels), 1);
  
  const output = ctx.createBuffer(channels, totalLength, sampleRate);
  
  let offset = 0;
  for (const buffer of buffers) {
    for (let ch = 0; ch < channels; ch++) {
      const outData = output.getChannelData(ch);
      const inData = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
      outData.set(inData, offset);
    }
    offset += buffer.length;
  }
  
  return output;
}

/**
 * Main stitching function - plays videos sequentially on a canvas,
 * records with MediaRecorder, and returns a Blob
 */
export async function canvasStitchVideos(options: CanvasStitchOptions): Promise<Blob> {
  const { 
    videoUrls, 
    audioUrls = [], 
    width = 1080, 
    height = 1920, 
    onProgress, 
    onStatus 
  } = options;

  if (!videoUrls || videoUrls.length === 0) {
    throw new Error('No video URLs provided');
  }

  onStatus?.('Loading video clips...');
  onProgress?.(5);

  // Load all videos in parallel
  console.log(`[CanvasStitch] Loading ${videoUrls.length} videos...`);
  const videos: HTMLVideoElement[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    onStatus?.(`Loading clip ${i + 1} of ${videoUrls.length}...`);
    try {
      const vid = await loadVideo(videoUrls[i]);
      videos.push(vid);
      console.log(`[CanvasStitch] Loaded video ${i + 1}: ${vid.videoWidth}x${vid.videoHeight}, duration: ${vid.duration}s`);
    } catch (err) {
      console.error(`[CanvasStitch] Failed to load video ${i}:`, err);
      throw new Error(`Failed to load video clip ${i + 1}: ${err}`);
    }
    onProgress?.(5 + (i / videoUrls.length) * 15);
  }

  // Set up canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext('2d')!;

  // Set up audio context for mixing
  const audioCtx = new AudioContext();
  let audioSource: AudioBufferSourceNode | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;

  if (audioUrls.length > 0) {
    onStatus?.('Loading audio tracks...');
    onProgress?.(22);
    
    try {
      const audioBuffers: AudioBuffer[] = [];
      for (const url of audioUrls) {
        const buf = await loadAudioBuffer(audioCtx, url);
        audioBuffers.push(buf);
      }
      
      const combinedAudio = audioBuffers.length === 1 
        ? audioBuffers[0] 
        : concatAudioBuffers(audioCtx, audioBuffers);
      
      audioDestination = audioCtx.createMediaStreamDestination();
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = combinedAudio;
      audioSource.connect(audioDestination);
      
      console.log(`[CanvasStitch] Audio loaded: ${combinedAudio.duration}s`);
    } catch (audioErr) {
      console.warn('[CanvasStitch] Audio loading failed, proceeding without audio:', audioErr);
    }
  }

  // Create MediaRecorder from canvas stream + audio
  const canvasStream = canvas.captureStream(30); // 30fps
  
  if (audioDestination) {
    const audioTrack = audioDestination.stream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }
  }

  // Pick best available codec
  const codecs = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  
  let mimeType = 'video/webm';
  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      mimeType = codec;
      break;
    }
  }
  
  console.log(`[CanvasStitch] Using codec: ${mimeType}`);

  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000, // 8 Mbps for good quality
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Start recording
  onStatus?.('Stitching clips together...');
  onProgress?.(30);
  
  recorder.start(100); // Collect data every 100ms
  
  // Start audio playback
  if (audioSource) {
    audioSource.start(0);
  }

  // Play each video sequentially on the canvas
  const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 5), 0);
  let elapsedTime = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    onStatus?.(`Rendering clip ${i + 1} of ${videos.length}...`);
    
    await new Promise<void>((resolve, reject) => {
      video.muted = true;
      
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        
        // Calculate scaling to cover canvas (like CSS object-fit: cover)
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = width / height;
        
        let drawW: number, drawH: number, drawX: number, drawY: number;
        
        if (videoAspect > canvasAspect) {
          // Video is wider - crop sides
          drawH = height;
          drawW = height * videoAspect;
          drawX = (width - drawW) / 2;
          drawY = 0;
        } else {
          // Video is taller - crop top/bottom
          drawW = width;
          drawH = width / videoAspect;
          drawX = 0;
          drawY = (height - drawH) / 2;
        }
        
        ctx2d.fillStyle = '#000000';
        ctx2d.fillRect(0, 0, width, height);
        ctx2d.drawImage(video, drawX, drawY, drawW, drawH);
        
        // Update progress
        const currentElapsed = elapsedTime + video.currentTime;
        const percent = 30 + (currentElapsed / totalDuration) * 65;
        onProgress?.(Math.min(95, Math.round(percent)));
        
        requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        elapsedTime += video.duration;
        resolve();
      };
      
      video.onerror = () => reject(new Error(`Error playing video clip ${i + 1}`));
      
      // Start drawing and playing
      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    });
  }

  // Stop recording
  onStatus?.('Finalizing video...');
  onProgress?.(96);
  
  if (audioSource) {
    try { audioSource.stop(); } catch {}
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType });
      console.log(`[CanvasStitch] Final video size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Cleanup
      try { audioCtx.close(); } catch {}
      videos.forEach(v => { v.src = ''; v.load(); });
      
      onProgress?.(100);
      onStatus?.('Complete!');
      resolve(finalBlob);
    };
    
    recorder.onerror = (e) => reject(new Error(`Recording failed: ${e}`));
    
    // Small delay to capture final frames
    setTimeout(() => recorder.stop(), 200);
  });
}

/**
 * Drop-in replacement for stitchVideosWithAudio
 */
export async function canvasStitch(
  videoUrls: string[], 
  audioUrls?: string[], 
  onProgress?: (percent: number) => void
): Promise<Blob> {
  return canvasStitchVideos({ videoUrls, audioUrls, onProgress });
}
