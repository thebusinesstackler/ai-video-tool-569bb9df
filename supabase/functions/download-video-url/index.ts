import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    console.log(`[download-video-url] User ${user.id} requesting download for: ${url}`);

    // Use Cobalt API to get direct download link
    const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        isNoTTWatermark: true,
      }),
    });

    if (!cobaltResponse.ok) {
      const errText = await cobaltResponse.text();
      console.error('[download-video-url] Cobalt API error:', cobaltResponse.status, errText);
      return new Response(JSON.stringify({ error: 'Could not process this URL. Try uploading the video file directly.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cobaltData = await cobaltResponse.json();
    console.log('[download-video-url] Cobalt response status:', cobaltData.status);

    let downloadUrl: string | null = null;

    if (cobaltData.status === 'redirect' || cobaltData.status === 'stream') {
      downloadUrl = cobaltData.url;
    } else if (cobaltData.status === 'picker' && cobaltData.picker?.length > 0) {
      // Pick the first video option
      downloadUrl = cobaltData.picker[0].url;
    } else if (cobaltData.url) {
      downloadUrl = cobaltData.url;
    }

    if (!downloadUrl) {
      console.error('[download-video-url] No download URL from Cobalt:', JSON.stringify(cobaltData));
      return new Response(JSON.stringify({ error: 'Could not extract video from this URL. Try uploading the file directly.' }), {
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
