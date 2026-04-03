// Video stitching: tries cloud (Creatomate) first, falls back to canvas stitching
// No more FFmpeg WASM — it times out consistently in browsers

import { supabase } from '@/integrations/supabase/client';
import { canvasStitchVideos } from '@/lib/canvasStitch';

interface StitchOptions {
  videoUrls: string[];
  audioUrls?: string[];
  transitions?: string[];
  onProgress?: (percent: number) => void;
}

/**
 * Cloud-first stitching via Creatomate edge function.
 * Returns a public URL to the rendered MP4.
 */
async function cloudStitch(
  videoUrls: string[],
  audioUrls: string[],
  onProgress?: (percent: number) => void
): Promise<string> {
  onProgress?.(5);

  const clips = videoUrls.map((url, i) => ({
    url,
    duration: 5, // default; Creatomate uses actual video length
    caption: undefined,
  }));

  // Merge audio into a single URL if multiple
  let mergedAudioUrl: string | undefined;
  if (audioUrls.length === 1) {
    mergedAudioUrl = audioUrls[0];
  } else if (audioUrls.length > 1) {
    try {
      const { data } = await supabase.functions.invoke('merge-audio', {
        body: { audioUrls }
      });
      mergedAudioUrl = data?.audioUrl || audioUrls[0];
      if (!data?.audioUrl) {
        console.warn('merge-audio: fallback to first audio track, other tracks lost');
      }
    } catch (err) {
      console.warn('merge-audio failed, using first audio only:', err);
      mergedAudioUrl = audioUrls[0];
    }
  }

  onProgress?.(10);

  const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
    body: {
      clips,
      audioUrl: mergedAudioUrl,
      transition: 'crossfade',
    }
  });

  if (error) throw new Error(error.message || 'Cloud stitch request failed');
  if (!data?.success) throw new Error(data?.error || 'Cloud stitch failed');
  if (!data?.renderId) throw new Error('No render ID returned');

  onProgress?.(20);

  // Poll for completion
  const maxTime = 300_000;
  const interval = 3000;
  const start = Date.now();

  while (Date.now() - start < maxTime) {
    const { data: status } = await supabase.functions.invoke('creatomate-status', {
      body: { renderId: data.renderId }
    });

    if (status?.status === 'succeeded' && status?.url) {
      onProgress?.(100);
      return status.url;
    }
    if (status?.status === 'failed') {
      throw new Error(status?.error || 'Cloud render failed');
    }

    // Estimate progress
    const elapsed = Date.now() - start;
    const pct = Math.min(90, 20 + (elapsed / maxTime) * 70);
    onProgress?.(Math.round(status?.progress || pct));

    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error('Cloud render timed out');
}

/**
 * Primary export: tries cloud stitching, falls back to canvas.
 * Returns a Blob of the final MP4.
 */
export async function stitchVideosWithAudio(options: StitchOptions): Promise<Blob> {
  const { videoUrls, audioUrls = [], onProgress } = options;

  if (!videoUrls || videoUrls.length === 0) throw new Error('No video URLs provided');

  console.log(`[VideoStitch] Stitching ${videoUrls.length} videos, ${audioUrls.length} audio tracks`);

  // Detect blob: or data: URLs — cloud stitching needs real public URLs
  const hasLocalUrls = videoUrls.some(u => u.startsWith('blob:') || u.startsWith('data:'));
  const allPublic = !hasLocalUrls && videoUrls.every(u => u.startsWith('http'));

  if (allPublic) {
    try {
      console.log('[VideoStitch] Trying cloud stitching (Creatomate)...');
      const url = await cloudStitch(videoUrls, audioUrls, onProgress);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to download rendered video');
      return await resp.blob();
    } catch (err) {
      console.warn('[VideoStitch] Cloud stitch failed, falling back to canvas:', err);
    }
  } else {
    console.log('[VideoStitch] Local/blob URLs detected — skipping cloud, using canvas directly');
  }

  // Fallback: canvas-based stitching
  console.log('[VideoStitch] Using canvas stitching...');
  return canvasStitchVideos({
    videoUrls,
    audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
    onProgress,
  });
}

// Legacy function for backwards compatibility
export async function stitchVideos(urls: string[], onProgress?: (percent: number) => void): Promise<Blob> {
  return stitchVideosWithAudio({ videoUrls: urls, onProgress });
}
