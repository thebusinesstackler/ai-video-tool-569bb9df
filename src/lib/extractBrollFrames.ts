import { supabase } from '@/integrations/supabase/client';

export interface ExtractedFrame {
  url: string;
  time: number;
  label: string;
  duration?: number;
  kind?: 'frame' | 'clip';
  sourceStart?: number;
  sourceUrl?: string;
}

export interface PlannedClip {
  startT: number;
  endT: number;
  duration: number;
  sourceUrl: string;
  label: string;
  trimmedUrl: string;
}

interface PlanOptions {
  videoUrl: string;
  label?: string;
  count?: number;
  clipDuration?: number;
  /** Optional explicit clip start times. */
  times?: number[];
}

async function probeDuration(videoUrl: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    (v as any).playsInline = true;
    v.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => reject(new Error('Timed out probing video duration')), 15000);
    v.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      const d = v.duration;
      v.src = '';
      if (!d || !isFinite(d)) reject(new Error('Video has no duration'));
      else resolve(d);
    });
    v.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Could not load video metadata'));
    });
    v.src = videoUrl;
  });
}

/**
 * Plan virtual B-Roll clips from a source video without writing to the database.
 * Returns an array of clip windows the caller can preview before saving.
 */
export async function planBrollClips(opts: PlanOptions): Promise<PlannedClip[]> {
  const { videoUrl, label = 'B-Roll', count = 6, clipDuration = 3, times } = opts;
  const duration = await probeDuration(videoUrl);

  const explicitTimes = (times || [])
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.max(0, Number(t)));

  const clipStarts = explicitTimes.length > 0
    ? explicitTimes.map((t) => +Math.min(Math.max(0, duration - 0.1), t).toFixed(2))
    : Array.from({ length: count }, (_, index) => {
        const usable = Math.max(0.1, duration - clipDuration);
        return +(usable * (index + 1) / (count + 1)).toFixed(2);
      });

  return clipStarts.map((rawStart) => {
    const maxStart = Math.max(0, duration - 0.1);
    const startT = +Math.min(rawStart, maxStart).toFixed(2);
    const endT = +Math.min(duration, startT + clipDuration).toFixed(2);
    const dur = +Math.max(0.1, endT - startT).toFixed(2);
    const clipLabel = `${label} clip @ ${startT.toFixed(1)}s`;
    const trimmedUrl = `${videoUrl}#t=${startT},${endT}`;
    return { startT, endT, duration: dur, sourceUrl: videoUrl, label: clipLabel, trimmedUrl };
  });
}

/**
 * Persist a user-curated subset of planned clips into generated_images
 * using the same JSON metadata format Chatcut Source Clips reads.
 */
export async function saveBrollClips(
  userId: string,
  projectId: string | null,
  clips: PlannedClip[]
): Promise<ExtractedFrame[]> {
  const saved: ExtractedFrame[] = [];
  for (const clip of clips) {
    const meta = JSON.stringify({
      label: clip.label,
      sourceStart: clip.startT,
      duration: clip.duration,
      sourceUrl: clip.sourceUrl,
    });
    const { error } = await supabase.from('generated_images').insert({
      user_id: userId,
      image_url: clip.trimmedUrl,
      source: 'broll-clip',
      project_id: projectId,
      prompt: meta,
      reference_image_url: clip.sourceUrl,
    });
    if (error) {
      console.warn('[saveBrollClips] insert failed', error);
      continue;
    }
    saved.push({
      url: clip.trimmedUrl,
      time: clip.startT,
      label: clip.label,
      duration: clip.duration,
      kind: 'clip',
      sourceStart: clip.startT,
      sourceUrl: clip.sourceUrl,
    });
  }
  return saved;
}

/**
 * @deprecated Use planBrollClips + saveBrollClips. Kept for backwards compatibility.
 */
export async function extractBrollFrames(opts: PlanOptions & {
  userId: string;
  projectId?: string | null;
  onProgress?: (done: number, total: number) => void;
}): Promise<ExtractedFrame[]> {
  const { userId, projectId = null, onProgress, ...planOpts } = opts;
  const planned = await planBrollClips(planOpts);
  const saved: ExtractedFrame[] = [];
  for (const [i, clip] of planned.entries()) {
    const [row] = await saveBrollClips(userId, projectId, [clip]);
    if (row) saved.push(row);
    onProgress?.(i + 1, planned.length);
  }
  return saved;
}

export function parseBrollClipMeta(row: { image_url: string; prompt: string | null }): {
  label: string;
  sourceUrl: string;
  sourceStart: number;
  duration: number;
} {
  const fallbackUrl = row.image_url.split('#')[0];
  let label = 'Source clip';
  let sourceStart = 0;
  let duration = 3;
  try {
    if (row.prompt) {
      const parsed = JSON.parse(row.prompt);
      if (parsed && typeof parsed === 'object') {
        label = parsed.label || label;
        sourceStart = typeof parsed.sourceStart === 'number' ? parsed.sourceStart : sourceStart;
        duration = typeof parsed.duration === 'number' ? parsed.duration : duration;
        return { label, sourceUrl: parsed.sourceUrl || fallbackUrl, sourceStart, duration };
      }
    }
  } catch { /* fall through */ }

  const m = row.image_url.match(/#t=([0-9.]+),([0-9.]+)/);
  if (m) {
    sourceStart = parseFloat(m[1]);
    duration = Math.max(0.1, parseFloat(m[2]) - sourceStart);
  }
  if (row.prompt) label = row.prompt;
  return { label, sourceUrl: fallbackUrl, sourceStart, duration };
}
