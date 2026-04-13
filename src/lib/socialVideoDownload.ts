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

    // Build fetch headers — include RapidAPI key if provided (for tunnel URLs)
    const fetchHeaders: Record<string, string> = {};
    if (data.rapidApiKey) {
      fetchHeaders['X-RapidAPI-Key'] = data.rapidApiKey;
      fetchHeaders['X-RapidAPI-Host'] = 'social-media-video-downloader.p.rapidapi.com';
    }

    let videoBlob: Blob | null = null;

    // Attempt 1: Direct fetch (with optional RapidAPI auth)
    try {
      const resp = await fetch(data.downloadUrl, { headers: fetchHeaders });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 1000) {
          videoBlob = blob;
        }
      }
    } catch {
      // Attempt 2: Try without extra headers
      try {
        const resp = await fetch(data.downloadUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob.size > 1000) {
            videoBlob = blob;
          }
        }
      } catch { /* continue to error */ }
    }

    if (!videoBlob) {
      throw new Error('YouTube blocked this download. Please download the video to your device first, then drag & drop it here to upload.');
    }

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

  throw new Error('YouTube blocked this download. Please download the video to your device first, then drag & drop it here to upload.');
}
