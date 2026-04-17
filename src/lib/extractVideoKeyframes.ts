/**
 * Extract evenly-sampled keyframes from a <video> element as base64 JPEGs.
 * Used to give Marco (the AI Director) "vision" into the actual video content
 * so he can match B-roll vibe, suggest zooms/angles for specific moments,
 * and reference what's actually on screen at each timestamp.
 *
 * Returns dataURL strings (image/jpeg). Each is downscaled to ~640px wide
 * to keep the multimodal payload small.
 */
export interface Keyframe {
  /** Timestamp in seconds within the source video */
  time: number;
  /** image/jpeg base64 dataURL, downscaled */
  dataUrl: string;
}

const TARGET_WIDTH = 640;
const JPEG_QUALITY = 0.7;

async function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('seek failed'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = Math.max(0, Math.min(t, (video.duration || t) - 0.05));
    } catch (e) {
      reject(e);
    }
    // Safety timeout
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    }, 4000);
  });
}

function captureFrame(video: HTMLVideoElement): string {
  const vw = video.videoWidth || TARGET_WIDTH;
  const vh = video.videoHeight || (TARGET_WIDTH * 9) / 16;
  const scale = Math.min(1, TARGET_WIDTH / vw);
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  try {
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch (e) {
    // Tainted canvas (CORS) — return empty
    console.warn('[extractVideoKeyframes] canvas capture failed:', e);
    return '';
  }
}

/**
 * Extract `count` evenly-sampled keyframes from the existing on-page <video>.
 * Tries to use the live element first (no extra network) and falls back to
 * a hidden cloned video if the live one is busy playing.
 */
export async function extractKeyframesFromElement(
  video: HTMLVideoElement,
  count = 6
): Promise<Keyframe[]> {
  const dur = video.duration;
  if (!dur || !isFinite(dur) || dur < 0.5) return [];

  const wasPaused = video.paused;
  const originalTime = video.currentTime;
  const originalMuted = video.muted;
  video.muted = true;
  if (!wasPaused) video.pause();

  const frames: Keyframe[] = [];
  // Sample evenly across [0.5s, dur - 0.3s]
  const safeStart = Math.min(0.5, dur * 0.05);
  const safeEnd = Math.max(safeStart + 0.5, dur - 0.3);
  const span = safeEnd - safeStart;
  for (let i = 0; i < count; i++) {
    const t = safeStart + (span * i) / Math.max(1, count - 1);
    try {
      await seekTo(video, t);
      // small settle delay so the frame actually paints
      await new Promise((r) => setTimeout(r, 80));
      const dataUrl = captureFrame(video);
      if (dataUrl) frames.push({ time: +t.toFixed(2), dataUrl });
    } catch (e) {
      console.warn('[extractVideoKeyframes] frame skip', t, e);
    }
  }

  // Restore playback state
  try {
    video.currentTime = originalTime;
  } catch { /* ignore */ }
  video.muted = originalMuted;
  if (!wasPaused) {
    video.play().catch(() => {});
  }

  return frames;
}
