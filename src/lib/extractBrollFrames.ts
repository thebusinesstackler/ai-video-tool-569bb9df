import { supabase } from '@/integrations/supabase/client';

export interface ExtractedFrame {
  url: string;
  time: number;
  label: string;
  duration?: number;
  kind?: 'frame' | 'clip';
}

interface ExtractOptions {
  videoUrl: string;
  userId: string;
  projectId?: string | null;
  label?: string;
  count?: number;
  /**
   * Seconds per clip. Default 3s. If 0, falls back to single-frame JPG capture.
   */
  clipDuration?: number;
  onProgress?: (done: number, total: number) => void;
}

const pickMime = (): string => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const m of candidates) {
    // @ts-ignore
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return 'video/webm';
};

/**
 * Extract N evenly-spaced short VIDEO CLIPS from a source video URL.
 * Each clip is recorded client-side via captureStream + MediaRecorder, uploaded
 * to the `reels` bucket, and stored in `generated_images` with source='broll-clip'
 * (image_url holds the .webm/.mp4 URL — Chatcut treats `image_url ending in video
 * extension` as a video clip).
 *
 * Falls back to single-frame JPGs (source='broll-frame') when MediaRecorder is unavailable.
 */
export async function extractBrollFrames(opts: ExtractOptions): Promise<ExtractedFrame[]> {
  const {
    videoUrl,
    userId,
    projectId = null,
    label = 'B-Roll',
    count = 6,
    clipDuration = 3,
    onProgress,
  } = opts;

  const canRecord =
    clipDuration > 0 &&
    typeof MediaRecorder !== 'undefined' &&
    typeof (HTMLVideoElement.prototype as any).captureStream === 'function';

  // Create offscreen video
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  (video as any).playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Could not load video for extraction')); };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });

  const duration = video.duration;
  if (!duration || !isFinite(duration)) throw new Error('Video has no duration');

  const seekTo = (t: number) => new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      setTimeout(resolve, 80);
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(Math.max(t, 0), Math.max(0, duration - 0.05));
  });

  const saved: ExtractedFrame[] = [];

  // Helper: still-frame fallback path
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');

  for (let i = 1; i <= count; i++) {
    // Distribute clip start points evenly, leaving room for clipDuration tail
    const usable = Math.max(0.1, duration - (canRecord ? clipDuration : 0));
    const startT = (usable * i) / (count + 1);

    try {
      if (canRecord) {
        await seekTo(startT);
        const stream: MediaStream = (video as any).captureStream();
        const mimeType = pickMime();
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        const recorded: Promise<Blob> = new Promise((resolve, reject) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
          recorder.onerror = (e: any) => reject(e?.error || new Error('MediaRecorder error'));
        });

        recorder.start();
        try {
          await video.play();
        } catch {
          // Autoplay rejection — fall back to frame
          recorder.stop();
          throw new Error('autoplay-blocked');
        }
        await new Promise((r) => setTimeout(r, clipDuration * 1000));
        try { video.pause(); } catch {}
        try { recorder.stop(); } catch {}
        const blob = await recorded;
        // Some streams emit 0-byte blobs if track stalled — fallback below
        if (!blob || blob.size < 1024) throw new Error('empty-clip');

        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `broll-clips/${userId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('reels')
          .upload(fileName, blob, { contentType: mimeType, upsert: false });
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from('reels').getPublicUrl(fileName);
        const clipLabel = `${label} clip @ ${startT.toFixed(1)}s`;

        await supabase.from('generated_images').insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          source: 'broll-clip',
          project_id: projectId,
          prompt: clipLabel,
          reference_image_url: videoUrl,
        });

        saved.push({ url: urlData.publicUrl, time: startT, label: clipLabel, duration: clipDuration, kind: 'clip' });
      } else {
        // Frame fallback
        if (!ctx) throw new Error('Canvas context unavailable');
        const t = (duration * i) / (count + 1);
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
        saved.push({ url: urlData.publicUrl, time: t, label: frameLabel, kind: 'frame' });
      }
      onProgress?.(i, count);
    } catch (e) {
      console.warn('[extractBrollFrames] failed at index', i, e);
      // try the still-frame fallback for this index if recording failed
      if (canRecord && ctx) {
        try {
          const t = (duration * i) / (count + 1);
          await seekTo(t);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob: Blob | null = await new Promise((r) =>
            canvas.toBlob((b) => r(b), 'image/jpeg', 0.92)
          );
          if (!blob) continue;
          const fileName = `broll-frames/${userId}/${Date.now()}-${i}-fb-${Math.random().toString(36).slice(2, 8)}.jpg`;
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
          saved.push({ url: urlData.publicUrl, time: t, label: frameLabel, kind: 'frame' });
          onProgress?.(i, count);
        } catch (e2) {
          console.warn('[extractBrollFrames] frame fallback failed', e2);
        }
      }
    }
  }

  try { video.src = ''; } catch {}
  return saved;
}
