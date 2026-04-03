// Canvas-based video stitcher using HTML5 Canvas + MediaRecorder
// Hardened: silent audio oscillator, canplaythrough, proper flush, duration guards

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
 * Preloads a video element and returns it ready to play.
 * Uses canplaythrough for reliable buffering.
 */
function loadVideo(url: string, muted: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = muted;
    video.playsInline = true;
    video.preload = 'auto';

    const timeout = setTimeout(() => reject(new Error('Video load timeout')), 30000);

    video.oncanplaythrough = () => {
      clearTimeout(timeout);
      resolve(video);
    };
    // Fallback: some blob URLs may not fire canplaythrough reliably
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
 * Gets safe video duration, defaulting to 5s if NaN/0/Infinity
 */
function safeDuration(video: HTMLVideoElement): number {
  const d = video.duration;
  if (!d || !isFinite(d) || d <= 0) return 5;
  return d;
}

/**
 * Main stitching function — plays videos sequentially on a canvas,
 * captures embedded audio directly from video playback,
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

  const allEmbedded = embeddedAudioIndices.length === videoUrls.length && audioUrls.length === 0;
  const hasAnyEmbedded = embeddedAudioIndices.length > 0;

  console.log(`[CanvasStitch] Mode: ${allEmbedded ? 'ALL_EMBEDDED' : hasAnyEmbedded ? 'MIXED' : 'OVERLAY_ONLY'}`);
  console.log(`[CanvasStitch] ${videoUrls.length} videos, ${embeddedAudioIndices.length} embedded audio, ${audioUrls.length} overlay audio`);

  onStatus?.('Loading video clips...');
  onProgress?.(5);

  // Load all videos
  const videos: HTMLVideoElement[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    const isEmbedded = embeddedAudioIndices.includes(i);
    onStatus?.(`Loading clip ${i + 1} of ${videoUrls.length}...`);
    try {
      const vid = await loadVideo(videoUrls[i], !isEmbedded);
      videos.push(vid);
      console.log(`[CanvasStitch] Loaded video ${i + 1}: ${vid.videoWidth}x${vid.videoHeight}, ${safeDuration(vid)}s, muted=${vid.muted}`);
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

  // Draw initial black frame so MediaRecorder has data from frame 0
  ctx2d.fillStyle = '#000000';
  ctx2d.fillRect(0, 0, width, height);

  // Set up audio context
  const audioCtx = new AudioContext();
  let overlayAudioSource: AudioBufferSourceNode | null = null;

  // Create a single mix destination
  const mixDest = audioCtx.createMediaStreamDestination();

  // CRITICAL: Add a silent oscillator so MediaRecorder always has an active audio track
  // Some browsers produce 0-byte output when audio track has no signal
  const silentOsc = audioCtx.createOscillator();
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0; // completely silent
  silentOsc.connect(silentGain);
  silentGain.connect(mixDest);
  silentOsc.start();

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

      overlayAudioSource = audioCtx.createBufferSource();
      overlayAudioSource.buffer = combinedAudio;
      overlayAudioSource.connect(mixDest);
      console.log(`[CanvasStitch] Overlay audio loaded: ${combinedAudio.duration}s`);
    } catch (audioErr) {
      console.warn('[CanvasStitch] Overlay audio loading failed:', audioErr);
    }
  }

  // Create the output MediaStream from canvas (video track)
  const canvasStream = canvas.captureStream(30);
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

  // Start overlay audio if applicable
  if (overlayAudioSource && !allEmbedded) {
    overlayAudioSource.start(0);
  }

  // Start background music if provided
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
  const totalDuration = videos.reduce((acc, v) => acc + safeDuration(v), 0);
  let elapsedTime = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const isEmbedded = embeddedAudioIndices.includes(i);
    const clipDuration = safeDuration(video);
    onStatus?.(`Rendering clip ${i + 1} of ${videos.length}...`);

    // For embedded audio clips: connect the video's audio output to the mix destination
    let videoAudioSource: MediaStreamAudioSourceNode | null = null;
    if (isEmbedded && !video.muted) {
      try {
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
        console.warn(`[CanvasStitch] Clip ${i + 1}: could not capture embedded audio`, e);
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
      let animId: number;

      // Safety timeout: if video.onended never fires, force-resolve after clipDuration + 2s
      const safetyTimeout = setTimeout(() => {
        console.warn(`[CanvasStitch] Clip ${i + 1}: safety timeout after ${clipDuration + 2}s`);
        cancelAnimationFrame(animId);
        if (videoAudioSource) try { videoAudioSource.disconnect(); } catch {}
        resolve();
      }, (clipDuration + 2) * 1000);

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

        animId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        clearTimeout(safetyTimeout);
        cancelAnimationFrame(animId);
        elapsedTime += clipDuration;
        if (videoAudioSource) try { videoAudioSource.disconnect(); } catch {}
        resolve();
      };

      video.onerror = () => {
        clearTimeout(safetyTimeout);
        cancelAnimationFrame(animId);
        reject(new Error(`Error playing video clip ${i + 1}`));
      };

      video.play().then(() => {
        drawFrame();
      }).catch(reject);
    });
  }

  // Stop recording with proper flush
  onStatus?.('Finalizing video...');
  onProgress?.(96);

  // Draw one final frame to ensure recorder has data
  ctx2d.fillStyle = '#000000';
  ctx2d.fillRect(0, 0, width, height);

  if (overlayAudioSource) try { overlayAudioSource.stop(); } catch {}
  if (bgMusicSource) try { bgMusicSource.stop(); } catch {}
  silentOsc.stop();

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType });
      console.log(`[CanvasStitch] Final video: ${chunks.length} chunks, ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);

      try { audioCtx.close(); } catch {}
      videos.forEach(v => { v.src = ''; v.load(); });

      if (finalBlob.size < 1000) {
        reject(new Error('Canvas stitching produced an empty video. This can happen with cross-origin video sources. Try downloading the individual segments instead.'));
        return;
      }

      onProgress?.(100);
      onStatus?.('Complete!');
      resolve(finalBlob);
    };

    recorder.onerror = (e) => reject(new Error(`Recording failed: ${e}`));

    // Proper flush: request any pending data, then stop after a short delay
    try { recorder.requestData(); } catch {}
    setTimeout(() => {
      try { recorder.stop(); } catch {}
    }, 500);
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

/**
 * Trims a video blob to a specific timestamp using Canvas + MediaRecorder.
 * Used to cut off abrupt audio endings detected by AI analysis.
 */
export async function trimVideoToTimestamp(
  videoBlob: Blob,
  timestampSeconds: number,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const blobUrl = URL.createObjectURL(videoBlob);

  try {
    const video = await loadVideo(blobUrl, false);
    const duration = safeDuration(video);

    // If timestamp >= duration, no trimming needed
    if (timestampSeconds >= duration - 0.1) {
      console.log(`[TrimVideo] No trim needed: timestamp ${timestampSeconds}s >= duration ${duration}s`);
      return videoBlob;
    }

    console.log(`[TrimVideo] Trimming from ${duration}s to ${timestampSeconds}s`);

    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1920;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext('2d')!;

    // Black initial frame
    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(0, 0, width, height);

    // Audio context with silent oscillator for valid audio track
    const audioCtx = new AudioContext();
    const mixDest = audioCtx.createMediaStreamDestination();
    const silentOsc = audioCtx.createOscillator();
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    silentOsc.connect(silentGain);
    silentGain.connect(mixDest);
    silentOsc.start();

    // Capture video's embedded audio
    let videoAudioSource: MediaStreamAudioSourceNode | null = null;
    try {
      const videoStream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
      if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          videoAudioSource = audioCtx.createMediaStreamSource(videoStream);
          videoAudioSource.connect(mixDest);
        }
      }
    } catch (e) {
      console.warn('[TrimVideo] Could not capture video audio:', e);
    }

    // Set up output stream
    const canvasStream = canvas.captureStream(30);
    const mixAudioTrack = mixDest.stream.getAudioTracks()[0];
    if (mixAudioTrack) canvasStream.addTrack(mixAudioTrack);

    const codecs = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let mimeType = 'video/webm';
    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        mimeType = codec;
        break;
      }
    }

    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start(100);
    video.currentTime = 0;

    await new Promise<void>((resolve, reject) => {
      const safetyTimeout = setTimeout(() => {
        console.warn('[TrimVideo] Safety timeout');
        resolve();
      }, (timestampSeconds + 3) * 1000);

      let animId: number;

      const drawFrame = () => {
        if (video.paused || video.ended) return;

        // Stop at the trim point
        if (video.currentTime >= timestampSeconds) {
          video.pause();
          clearTimeout(safetyTimeout);
          cancelAnimationFrame(animId);
          if (videoAudioSource) try { videoAudioSource.disconnect(); } catch {}
          resolve();
          return;
        }

        ctx2d.drawImage(video, 0, 0, width, height);
        onProgress?.(Math.round((video.currentTime / timestampSeconds) * 100));
        animId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        clearTimeout(safetyTimeout);
        cancelAnimationFrame(animId);
        if (videoAudioSource) try { videoAudioSource.disconnect(); } catch {}
        resolve();
      };

      video.onerror = () => {
        clearTimeout(safetyTimeout);
        cancelAnimationFrame(animId);
        reject(new Error('Error during video trimming playback'));
      };

      video.play().then(() => drawFrame()).catch(reject);
    });

    silentOsc.stop();

    return new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        console.log(`[TrimVideo] Trimmed video: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);
        try { audioCtx.close(); } catch {}
        if (finalBlob.size < 1000) {
          reject(new Error('Trimmed video is too small — trimming may have failed'));
          return;
        }
        onProgress?.(100);
        resolve(finalBlob);
      };
      recorder.onerror = (e) => reject(new Error(`Trim recording failed: ${e}`));
      try { recorder.requestData(); } catch {}
      setTimeout(() => { try { recorder.stop(); } catch {} }, 500);
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
