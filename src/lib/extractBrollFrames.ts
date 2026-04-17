import { supabase } from '@/integrations/supabase/client';

export interface ExtractedFrame {
  url: string;
  time: number;
  label: string;
}

interface ExtractOptions {
  videoUrl: string;
  userId: string;
  projectId?: string | null;
  label?: string;
  count?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Extract N evenly-spaced frames from a video URL, upload them to the `reels` bucket,
 * and insert rows into `generated_images` with source='broll-frame'.
 * Returns the saved frames so the caller can refresh UI immediately.
 */
export async function extractBrollFrames(opts: ExtractOptions): Promise<ExtractedFrame[]> {
  const { videoUrl, userId, projectId = null, label = 'B-Roll', count = 6, onProgress } = opts;

  // Create offscreen video + canvas
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Could not load video for frame extraction')); };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) throw new Error('Video has no duration');

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const seekTo = (t: number) => new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      setTimeout(resolve, 80);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
  });

  const saved: ExtractedFrame[] = [];

  for (let i = 1; i <= count; i++) {
    const t = (duration * i) / (count + 1);
    try {
      await seekTo(t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((r) =>
        canvas.toBlob((b) => r(b), 'image/jpeg', 0.92)
      );
      if (!blob) continue;

      const fileName = `broll-frames/${userId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('reels')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) continue;

      const { data: urlData } = supabase.storage.from('reels').getPublicUrl(fileName);
      const frameLabel = `${label} @ ${t.toFixed(1)}s`;

      await supabase.from('generated_images').insert({
        user_id: userId,
        image_url: urlData.publicUrl,
        source: 'broll-frame',
        project_id: projectId,
        prompt: frameLabel,
        reference_image_url: videoUrl,
      });

      saved.push({ url: urlData.publicUrl, time: t, label: frameLabel });
      onProgress?.(i, count);
    } catch (e) {
      console.warn('[extractBrollFrames] failed at', t, e);
    }
  }

  return saved;
}
