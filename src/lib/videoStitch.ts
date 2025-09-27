// Minimal client-side video stitching using ffmpeg.wasm
// Keeps things simple: concatenates MP4 clips assuming identical codecs (Kie.ai outputs consistent params)
// If concat copy fails, we surface an error with guidance.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export async function stitchVideos(urls: string[], onProgress?: (percent: number) => void): Promise<Blob> {
  if (!urls || urls.length === 0) throw new Error('No video URLs provided');
  if (urls.length === 1) {
    // If only one video, just return it as-is
    const response = await fetch(urls[0]);
    return await response.blob();
  }

  console.log('Starting video stitching for URLs:', urls);
  
  const ffmpeg = new FFmpeg();
  try {
    // Add progress tracking
    ffmpeg.on('progress', ({ progress }) => {
      console.log('FFmpeg progress:', progress);
      if (onProgress) onProgress(Math.round((progress || 0) * 100));
    });

    // Add logging for debugging
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg log:', message);
    });

    console.log('Loading FFmpeg...');
    
    try {
      // Robust loader: probe multiple CDNs, prefetch core assets, then load
      const makeBlobURL = async (url: string, type: string) => {
        console.log(`Prefetching ${url} ...`);
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const blob = await res.blob();
        return URL.createObjectURL(new Blob([blob], { type }));
      };

      const sources = [
        { label: 'jsdelivr-dist-0.12.6', base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.6/dist/' },
        { label: 'unpkg-dist-0.12.6', base: 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/' },
        { label: 'jsdelivr-umd-0.12.6', base: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/' },
        { label: 'unpkg-umd-0.12.6', base: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/' },
      ] as const;

      let coreURL: string | undefined;
      let wasmURL: string | undefined;
      let workerURL: string | undefined;
      let lastError: unknown;

      for (const src of sources) {
        try {
          console.log(`Trying FFmpeg core from ${src.label}: ${src.base}`);
          const jsPath = `${src.base}ffmpeg-core.js`;
          const wasmPath = `${src.base}ffmpeg-core.wasm`;
          const workerPath = `${src.base}ffmpeg-core.worker.js`;

          const c = await makeBlobURL(jsPath, 'text/javascript');
          const w = await makeBlobURL(wasmPath, 'application/wasm');
          const wk = await makeBlobURL(workerPath, 'text/javascript');
          coreURL = c; wasmURL = w; workerURL = wk;
          console.log(`Prepared blob URLs from ${src.label}`);
          break;
        } catch (e) {
          lastError = e;
          console.warn(`Source ${src.label} failed:`, e);
        }
      }

      if (!coreURL || !wasmURL || !workerURL) {
        throw new Error(`Could not fetch FFmpeg core files from any source. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
      }

      const loadPromise = ffmpeg.load({ coreURL, wasmURL, workerURL });
      const loadTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('FFmpeg load timeout (20s)')), 20000)
      );
      await Promise.race([loadPromise, loadTimeout]);
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw new Error(`FFmpeg loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Write all parts to the FS
    const partNames: string[] = [];
    console.log('Downloading and writing video files...');
    
    for (let i = 0; i < urls.length; i++) {
      const name = `part${i}.mp4`;
      console.log(`Downloading video ${i + 1}/${urls.length}: ${urls[i]}`);
      
      try {
        // First test if the URL is accessible
        console.log(`Testing URL accessibility for ${urls[i]}...`);
        const testResponse = await fetch(urls[i], { method: 'HEAD' });
        if (!testResponse.ok) {
          throw new Error(`Video URL not accessible (${testResponse.status}): ${urls[i]}`);
        }
        console.log(`URL accessible, downloading ${name}...`);
        
        const data = await fetchFile(urls[i]);
        await ffmpeg.writeFile(name, data);
        partNames.push(name);
        console.log(`Successfully wrote ${name}, size: ${data.length} bytes`);
      } catch (error) {
        console.error(`Failed to download/write ${urls[i]}:`, error);
        if (error instanceof Error && error.message.includes('fetch')) {
          throw new Error(`Network error downloading video ${i + 1}. The video URL may have expired or be inaccessible: ${error.message}`);
        }
        throw new Error(`Failed to download video segment ${i + 1}: ${error}`);
      }
    }

    // Create concat list file
    const concatList = partNames.map((n) => `file '${n}'`).join('\n');
    console.log('Concat list:', concatList);
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

    // Try stream copy first (fast, no re-encode)
    console.log('Attempting video concatenation with stream copy...');
    try {
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4']);
      console.log('Stream copy concatenation successful');
    } catch (copyErr) {
      console.log('Stream copy failed, trying re-encode...', copyErr);
      // If copy fails, try a generic re-mux
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'faststart', 'output.mp4']);
      console.log('Re-encode concatenation successful');
    }

    console.log('Reading output file...');
    const out = (await ffmpeg.readFile('output.mp4')) as Uint8Array;
    console.log('Output file size:', out.length, 'bytes');
    
    if (out.length === 0) {
      throw new Error('Output video file is empty - concatenation may have failed');
    }
    
    const blob = new Blob([out], { type: 'video/mp4' });
    console.log('Successfully created stitched video blob, size:', blob.size);
    return blob;
    
  } catch (error) {
    console.error('FFmpeg stitching failed:', error);
    throw new Error(`Video stitching failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support if the issue persists.`);
  }
}
