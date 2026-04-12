import { supabase } from '@/integrations/supabase/client';

export async function downloadSocialVideoToStorage(url: string, notify?: (title: string, description: string, variant?: 'default' | 'destructive') => void): Promise<string> {
  const { data, error } = await supabase.functions.invoke('download-video-url', {
    body: { url },
  });

  if (error) {
    throw new Error(typeof error === 'object' && 'message' in error ? String(error.message) : 'Failed to download video');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (data?.videoUrl) {
    return data.videoUrl;
  }

  if (data?.clientDownload && data?.downloadUrl && data?.signedUploadUrl && data?.publicUrl) {
    notify?.('Downloading video...', 'Browser is fetching the video directly.');

    const videoBlob = await new Promise<Blob>((resolve, reject) => {
      fetch(data.downloadUrl)
        .then(resp => {
          if (!resp.ok) throw new Error('fetch failed');
          return resp.blob();
        })
        .then(blob => {
          if (blob.size < 1000) throw new Error('Downloaded file too small');
          resolve(blob);
        })
        .catch(() => {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.preload = 'auto';
          video.crossOrigin = 'anonymous';
          video.src = data.downloadUrl;

          video.onerror = () => {
            video.removeAttribute('crossorigin');
            video.src = '';
            video.src = data.downloadUrl;
            video.onerror = () => reject(new Error('Could not download this video. Please upload the file manually.'));
            video.onloadeddata = () => {
              try {
                const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream?.()
                  || (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
                if (!stream) throw new Error('captureStream not supported');
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                const chunks: Blob[] = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
                recorder.start();
                video.play();
                video.onended = () => recorder.stop();
                setTimeout(() => { try { recorder.stop(); } catch {} }, 120000);
              } catch {
                reject(new Error('Could not capture video. Please upload the file manually.'));
              }
            };
          };

          video.onloadeddata = () => {
            try {
              const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream?.()
                || (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
              if (!stream) throw new Error('captureStream not supported');
              const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
              const chunks: Blob[] = [];
              recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
              recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
              recorder.start();
              video.play();
              video.onended = () => recorder.stop();
              setTimeout(() => { try { recorder.stop(); } catch {} }, 120000);
            } catch {
              reject(new Error('Could not capture video. Please upload the file manually.'));
            }
          };

          video.load();
        });
    });

    if (videoBlob.size > 100 * 1024 * 1024) {
      throw new Error('Video is too large (max 100MB)');
    }

    const uploadResp = await fetch(data.signedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': videoBlob.type || 'video/mp4' },
      body: videoBlob,
    });

    if (!uploadResp.ok) {
      throw new Error(`Upload returned ${uploadResp.status}`);
    }

    notify?.('Video ready', 'The imported video was downloaded and stored successfully.');
    return data.publicUrl;
  }

  throw new Error('No video URL returned from download service');
}
