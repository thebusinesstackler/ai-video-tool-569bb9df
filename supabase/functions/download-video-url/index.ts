import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function detectPlatform(url: string): { platform: string; endpoint: string; params: Record<string, string> } | null {
  const u = url.toLowerCase();

  // YouTube
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    let videoId = '';
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') {
        videoId = parsed.pathname.slice(1);
      } else {
        videoId = parsed.searchParams.get('v') || '';
        // Handle /shorts/ID format
        if (!videoId && parsed.pathname.includes('/shorts/')) {
          videoId = parsed.pathname.split('/shorts/')[1]?.split(/[?/]/)[0] || '';
        }
      }
    } catch { /* */ }
    if (!videoId) return null;
    return {
      platform: 'youtube',
      endpoint: '/youtube/v3/video/details',
      params: { videoId, renderableFormats: '720p' },
    };
  }

  // TikTok
  if (u.includes('tiktok.com')) {
    return {
      platform: 'tiktok',
      endpoint: '/tiktok/v3/post/details',
      params: { url },
    };
  }

  // Instagram
  if (u.includes('instagram.com')) {
    // Extract shortcode from URL
    let shortcode = '';
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
      if (match) shortcode = match[2];
    } catch { /* */ }
    if (!shortcode) return null;
    return {
      platform: 'instagram',
      endpoint: '/instagram/v3/media/post/details',
      params: { shortcode },
    };
  }

  return null;
}

function extractDownloadUrl(platform: string, data: any): string | null {
  try {
    // Normalize contents — API sometimes returns an array, sometimes an object
    let contents = data?.contents;
    if (Array.isArray(contents)) {
      contents = contents[0]; // first item holds the media
    }

    if (platform === 'youtube') {
      // Try renderable videos first (pre-merged audio+video)
      const renderables = contents?.renderableVideos;
      if (renderables?.length > 0) {
        const rv = renderables.find((v: any) => v.renderConfig?.url);
        if (rv?.renderConfig?.url) return rv.renderConfig.url;
      }
      // Fall back to regular videos
      const videos = contents?.videos;
      if (videos?.length > 0) {
        const v = videos.find((v: any) => v.metadata?.quality_label === '720p') || videos[0];
        if (v?.url) return v.url;
      }
    }

    if (platform === 'tiktok' || platform === 'instagram') {
      if (contents?.videos?.length > 0) {
        return contents.videos[0]?.url || null;
      }
    }
  } catch (e) {
    console.error('[download-video-url] Error extracting URL:', e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');

    if (!rapidApiKey) {
      return new Response(JSON.stringify({ error: 'Video download service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detect platform
    const platformInfo = detectPlatform(url);
    if (!platformInfo) {
      return new Response(JSON.stringify({ error: 'Unsupported platform. Supported: YouTube, TikTok, Instagram' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[download-video-url] User ${user.id} requesting ${platformInfo.platform} download for: ${url}`);

    // Call SMVD API via RapidAPI
    const queryParams = new URLSearchParams(platformInfo.params);
    const apiUrl = `https://social-media-video-downloader.p.rapidapi.com${platformInfo.endpoint}?${queryParams}`;

    console.log(`[download-video-url] Calling SMVD API: ${platformInfo.endpoint}`);
    const smvdResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com',
      },
    });

    if (!smvdResponse.ok) {
      const errText = await smvdResponse.text();
      console.error('[download-video-url] SMVD API error:', smvdResponse.status, errText);
      return new Response(JSON.stringify({ error: 'Could not process this URL. The video may be private or unavailable.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const smvdData = await smvdResponse.json();
    console.log('[download-video-url] SMVD response received, extracting download URL...');

    const downloadUrl = extractDownloadUrl(platformInfo.platform, smvdData);

    if (!downloadUrl) {
      console.error('[download-video-url] No download URL found:', JSON.stringify(smvdData).substring(0, 500));
      return new Response(JSON.stringify({ error: 'Could not extract video from this URL. The video may be private or not contain downloadable video content.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the video
    console.log('[download-video-url] Downloading video from:', downloadUrl.substring(0, 80));
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to download video from source' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentLength = videoResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
      await videoResponse.arrayBuffer(); // consume body
      return new Response(JSON.stringify({ error: 'Video is too large (max 100MB)' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    console.log(`[download-video-url] Downloaded ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

    if (videoBuffer.byteLength > 100 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Video is too large (max 100MB)' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload to Supabase Storage using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const storagePath = `${user.id}/video-repo/imports/${crypto.randomUUID()}.mp4`;

    const { error: uploadError } = await adminClient.storage
      .from('reels')
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      console.error('[download-video-url] Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to store video' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { publicUrl } } = adminClient.storage.from('reels').getPublicUrl(storagePath);

    console.log('[download-video-url] Success! Stored at:', publicUrl);

    return new Response(JSON.stringify({ videoUrl: publicUrl }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[download-video-url] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
