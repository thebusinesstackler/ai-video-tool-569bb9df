// Canvas-based video stitcher using HTML5 Canvas + MediaRecorder
// Preserves embedded audio from Sora-2/VEO3 clips by capturing directly from video playback

interface CanvasStitchOptions {
  videoUrls: string[];
  audioUrls?: string[];
  /** Indices into videoUrls that have embedded audio — play unmuted & capture */
  embeddedAudioIndices?: number[];
  /** Background music URL — mixed at lower volume under narration/video audio */
  backgroundMusicUrl?: string;
  /** Background music volume 0-100, default 20 */
  backgroundMusicVolume?: number;
  width?: number;
  height?: number;
  onProgress?: (percent: number) => void;
  onStatus?: (status: string) => void;
}

/**
 * Preloads a video element and returns it ready to play
 */
function loadVideo(url: string, muted: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = muted;
    video.playsInline = true;
    video.preload = 'auto';

    const timeout = setTimeout(() => reject(new Error('Video load timeout')), 30000);
    video.onloadeddata = () => {
      clearTimeout(timeout);
      resolve(video);
    };
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load video: ${url.substring(0, 80)}...`));
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
 * Main stitching function — plays videos sequentially on a canvas,
 * captures embedded audio directly from video playback (Sora-2/VEO3),
 * and records with MediaRecorder.
 */
export async function canvasStitchVideos(options: CanvasStitchOptions): Promise<Blob> {
  const {
    videoUrls,
    audioUrls = [],
    embeddedAudioIndices = [],
    backgroundMusicUrl,
    backgroundMusicVolume = 20,
    width: inputWidth,
    height: inputHeight,
    onProgress,
    onStatus
  } = options;

  const width = inputWidth || 1080;
  const height = inputHeight || 1920;

  if (!videoUrls || videoUrls.length === 0) {
    throw new Error('No video URLs provided');
  }

  // Determine if ALL clips have embedded audio (common for Sora-2 reels)
  const allEmbedded = embeddedAudioIndices.length === videoUrls.length && audioUrls.length === 0;
  const hasAnyEmbedded = embeddedAudioIndices.length > 0;

  console.log(`[CanvasStitch] Mode: ${allEmbedded ? 'ALL_EMBEDDED' : hasAnyEmbedded ? 'MIXED' : 'OVERLAY_ONLY'}`);
  console.log(`[CanvasStitch] ${videoUrls.length} videos, ${embeddedAudioIndices.length} embedded audio, ${audioUrls.length} overlay audio`);

  onStatus?.('Loading video clips...');
  onProgress?.(5);

  // Load all videos — embedded-audio clips load UNMUTED to capture audio directly
  const videos: HTMLVideoElement[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    const isEmbedded = embeddedAudioIndices.includes(i);
    onStatus?.(`Loading clip ${i + 1} of ${videoUrls.length}...`);
    try {
      const vid = await loadVideo(videoUrls[i], !isEmbedded); // unmuted if embedded
      videos.push(vid);
      console.log(`[CanvasStitch] Loaded video ${i + 1}: ${vid.videoWidth}x${vid.videoHeight}, ${vid.duration}s, muted=${vid.muted}`);
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

  // Set up audio context for overlay audio (non-embedded scenes only)
  const audioCtx = new AudioContext();
  let overlayAudioSource: AudioBufferSourceNode | null = null;
  let overlayAudioDest: MediaStreamAudioDestinationNode | null = null;

  if (audioUrls.length > 0 && !allEmbedded) {
    onStatus?.('Loading overlay audio...');
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

      overlayAudioDest = audioCtx.createMediaStreamDestination();
      overlayAudioSource = audioCtx.createBufferSource();
      overlayAudioSource.buffer = combinedAudio;
      overlayAudioSource.connect(overlayAudioDest);
      console.log(`[CanvasStitch] Overlay audio loaded: ${combinedAudio.duration}s`);
    } catch (audioErr) {
      console.warn('[CanvasStitch] Overlay audio loading failed:', audioErr);
    }
  }

  // Create the output MediaStream from canvas (video track)
  const canvasStream = canvas.captureStream(30);

  // For ALL_EMBEDDED mode: we'll dynamically swap audio tracks per clip
  // For OVERLAY_ONLY: add overlay audio track
  // For MIXED: handle per-clip
  
  // Create a single audio destination to mix into
  const mixDest = audioCtx.createMediaStreamDestination();
  const mixAudioTrack = mixDest.stream.getAudioTracks()[0];
  if (mixAudioTrack) {
    canvasStream.addTrack(mixAudioTrack);
  }

  // Pick best codec
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
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  onStatus?.('Stitching clips together...');
  onProgress?.(30);

  recorder.start(100);

  // Start overlay audio if applicable (non-embedded mode)
  if (overlayAudioSource && !allEmbedded) {
    overlayAudioSource.connect(mixDest);
    overlayAudioSource.start(0);
  }

  // Start background music if provided (at lower volume)
  let bgMusicSource: AudioBufferSourceNode | null = null;
  if (backgroundMusicUrl) {
    try {
      onStatus?.('Loading background music...');
      const musicBuffer = await loadAudioBuffer(audioCtx, backgroundMusicUrl);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = Math.min(1, Math.max(0, backgroundMusicVolume / 100));
      bgMusicSource = audioCtx.createBufferSource();
      bgMusicSource.buffer = musicBuffer;
      bgMusicSource.connect(gainNode);
      gainNode.connect(mixDest);
      bgMusicSource.start(0);
      console.log(`[CanvasStitch] Background music started at ${backgroundMusicVolume}% volume`);
    } catch (musicErr) {
      console.warn('[CanvasStitch] Background music loading failed:', musicErr);
    }
  }

  // Play each video sequentially on the canvas
  const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 5), 0);
  let elapsedTime = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const isEmbedded = embeddedAudioIndices.includes(i);
    onStatus?.(`Rendering clip ${i + 1} of ${videos.length}...`);

    // For embedded audio clips: connect the video's audio output to the mix destination
    let videoAudioSource: MediaStreamAudioSourceNode | null = null;
    if (isEmbedded && !video.muted) {
      try {
        // Capture audio stream from the video element
        const videoStream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
        if (videoStream) {
          const audioTracks = videoStream.getAudioTracks();
          if (audioTracks.length > 0) {
            videoAudioSource = audioCtx.createMediaStreamSource(videoStream);
            videoAudioSource.connect(mixDest);
            console.log(`[CanvasStitch] Clip ${i + 1}: capturing embedded audio from video playback`);
          }
        }
      } catch (e) {
        console.warn(`[CanvasStitch] Clip ${i + 1}: could not capture embedded audio, falling back to decode`, e);
        // Fallback: try decoding the video file as audio
        try {
          const buf = await loadAudioBuffer(audioCtx, videoUrls[i]);
          const fallbackSource = audioCtx.createBufferSource();
          fallbackSource.buffer = buf;
          fallbackSource.connect(mixDest);
          fallbackSource.start(audioCtx.currentTime);
        } catch (decodeErr) {
          console.warn(`[CanvasStitch] Clip ${i + 1}: audio decode fallback also failed`, decodeErr);
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      const drawFrame = () => {
        if (video.paused || video.ended) return;

        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = width / height;

        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (videoAspect > canvasAspect) {
          drawH = height;
          drawW = height * videoAspect;
          drawX = (width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = width;
          drawH = width / videoAspect;
          drawX = 0;
          drawY = (height - drawH) / 2;
        }

        ctx2d.fillStyle = '#000000';
        ctx2d.fillRect(0, 0, width, height);
        ctx2d.drawImage(video, drawX, drawY, drawW, drawH);

        const currentElapsed = elapsedTime + video.currentTime;
        const percent = 30 + (currentElapsed / totalDuration) * 65;
        onProgress?.(Math.min(95, Math.round(percent)));

        requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        elapsedTime += video.duration;
        // Disconnect embedded audio source when clip ends
        if (videoAudioSource) {
          try { videoAudioSource.disconnect(); } catch {}
        }
        resolve();
      };

      video.onerror = () => reject(new Error(`Error playing video clip ${i + 1}`));

      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    });
  }

  // Stop recording
  onStatus?.('Finalizing video...');
  onProgress?.(96);

  if (overlayAudioSource) {
    try { overlayAudioSource.stop(); } catch {}
  }
  if (bgMusicSource) {
    try { bgMusicSource.stop(); } catch {}
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType });
      console.log(`[CanvasStitch] Final video size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);

      if (finalBlob.size < 1000) {
        try { audioCtx.close(); } catch {}
        videos.forEach(v => { v.src = ''; v.load(); });
        reject(new Error('Canvas stitching produced an empty video — likely due to cross-origin restrictions on the video sources. Cloud rendering is required for CDN-hosted clips.'));
        return;
      }

      try { audioCtx.close(); } catch {}
      videos.forEach(v => { v.src = ''; v.load(); });

      onProgress?.(100);
      onStatus?.('Complete!');
      resolve(finalBlob);
    };

    recorder.onerror = (e) => reject(new Error(`Recording failed: ${e}`));

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
