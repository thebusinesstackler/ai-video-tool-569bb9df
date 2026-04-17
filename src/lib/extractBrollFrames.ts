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

interface ExtractOptions {
  videoUrl: string;
  userId: string;
  projectId?: string | null;
  label?: string;
  count?: number;
  /**
   * Seconds per virtual clip. Default 3s.
   */
  clipDuration?: number;
  /**
   * Optional explicit clip start times. When provided, these are used instead of evenly spaced extraction.
   */
  times?: number[];
  onProgress?: (done: number, total: number) => void;
}

/**
 * Slice a source video into virtual clips — these are NOT re-encoded.
 * We save metadata rows pointing at the original source URL with a {start, duration} window.
 * Chatcut plays the source video and trims to the window via currentTime + a loop guard.
 */
export async function extractBrollFrames(opts: ExtractOptions): Promise<ExtractedFrame[]> {
  const {
    videoUrl,
    userId,
    projectId = null,
    label = 'B-Roll',
    count = 6,
    clipDuration = 3,
    times,
    onProgress,
  } = opts;

  const duration = await new Promise<number>((resolve, reject) => {
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

  const explicitTimes = (times || [])
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.max(0, Number(t)));

  const clipStarts = explicitTimes.length > 0
    ? explicitTimes.map((t) => +Math.min(Math.max(0, duration - 0.1), t).toFixed(2))
    : Array.from({ length: count }, (_, index) => {
        const usable = Math.max(0.1, duration - clipDuration);
        return +(usable * (index + 1) / (count + 1)).toFixed(2);
      });

  const saved: ExtractedFrame[] = [];
  const total = clipStarts.length;

  for (const [index, rawStart] of clipStarts.entries()) {
    const maxStart = Math.max(0, duration - 0.1);
    const startT = +Math.min(rawStart, maxStart).toFixed(2);
    const endT = +Math.min(duration, startT + clipDuration).toFixed(2);
    const dur = +Math.max(0.1, endT - startT).toFixed(2);

    try {
      const clipLabel = `${label} clip @ ${startT.toFixed(1)}s`;
      const trimmedUrl = `${videoUrl}#t=${startT},${endT}`;
      const meta = JSON.stringify({ label: clipLabel, sourceStart: startT, duration: dur, sourceUrl: videoUrl });

      const { error: insErr } = await supabase.from('generated_images').insert({
        user_id: userId,
        image_url: trimmedUrl,
        source: 'broll-clip',
        project_id: projectId,
        prompt: meta,
        reference_image_url: videoUrl,
      });
      if (insErr) {
        console.warn('[extractBrollFrames] insert failed', insErr);
        continue;
      }

      saved.push({
        url: trimmedUrl,
        time: startT,
        label: clipLabel,
        duration: dur,
        kind: 'clip',
        sourceStart: startT,
        sourceUrl: videoUrl,
      });
      onProgress?.(index + 1, total);
    } catch (e) {
      console.warn('[extractBrollFrames] failed at index', index, e);
    }
  }

  return saved;
}

/**
 * Parse a saved broll-clip row's `prompt` JSON back into structured metadata.
 * Falls back to plain-text label if the prompt isn't JSON.
 */
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
