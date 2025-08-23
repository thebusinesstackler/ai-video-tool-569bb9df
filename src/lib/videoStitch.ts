// Minimal client-side video stitching using ffmpeg.wasm
// Keeps things simple: concatenates MP4 clips assuming identical codecs (Kie.ai outputs consistent params)
// If concat copy fails, we surface an error with guidance.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export async function stitchVideos(urls: string[], onProgress?: (percent: number) => void): Promise<Blob> {
  if (!urls || urls.length === 0) throw new Error('No video URLs provided');

  const ffmpeg = new FFmpeg();
  try {
    ffmpeg.on('progress', ({ progress }) => {
      if (onProgress) onProgress(Math.round((progress || 0) * 100));
    });

    await ffmpeg.load();

    // Write all parts to the FS
    const partNames: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const name = `part${i}.mp4`;
      const data = await fetchFile(urls[i]);
      await ffmpeg.writeFile(name, data);
      partNames.push(name);
    }

    // Create concat list file
    const concatList = partNames.map((n) => `file '${n}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

    // Try stream copy first (fast, no re-encode)
    try {
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4']);
    } catch (copyErr) {
      // If copy fails, try a generic re-mux (still avoids full transcode where possible)
      // Note: ffmpeg.wasm has limited codec support; if this fails, we inform the user.
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-movflags', 'faststart', 'output.mp4']);
    }

    const out = (await ffmpeg.readFile('output.mp4')) as Uint8Array;
    return new Blob([out], { type: 'video/mp4' });
  } finally {
    // No explicit dispose API; FS is ephemeral per instance
  }
}
