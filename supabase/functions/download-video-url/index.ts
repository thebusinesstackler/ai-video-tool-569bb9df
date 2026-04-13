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

function extractDownloadUrl(platform: string, data: any): { url: string; isTunnel: boolean }[] {
  const urls: { url: string; isTunnel: boolean }[] = [];
  try {
    let contents = data?.contents;
    if (Array.isArray(contents)) {
      contents = contents[0];
    }

    if (platform === 'youtube') {
      // Try renderable videos first (pre-merged audio+video)
      const renderables = contents?.renderableVideos;
      if (renderables?.length > 0) {
        for (const rv of renderables) {
          if (rv.renderConfig?.url) urls.push({ url: rv.renderConfig.url, isTunnel: rv.renderConfig.url.includes('smvd.xyz') });
        }
      }
      // Then regular videos
      const videos = contents?.videos;
      if (videos?.length > 0) {
        const nonTunnel = videos.filter((v: any) => v.url && !v.url.includes('smvd'));
        const tunnel = videos.filter((v: any) => v.url && v.url.includes('smvd'));
        for (const v of [...nonTunnel, ...tunnel]) {
          if (v.url) urls.push({ url: v.url, isTunnel: v.url.includes('smvd') });
        }
      }
    }

    if (platform === 'tiktok' || platform === 'instagram') {
      if (contents?.videos?.length > 0) {
        for (const v of contents.videos) {
          if (v.url) urls.push({ url: v.url, isTunnel: v.url.includes('smvd') });
        }
      }
    }
  } catch (e) {
    console.error('[download-video-url] Error extracting URL:', e);
  }
  return urls;
}

// Rewrite SMVD direct-domain tunnel URLs to go through the RapidAPI proxy
function rewriteTunnelUrl(tunnelUrl: string): string {
  try {
    const parsed = new URL(tunnelUrl);
    // e.g. https://api-v3.smvd.xyz/youtube/utils/redirector/tunnel/stream?url_token=...
    // Rewrite to: https://social-media-video-downloader.p.rapidapi.com/youtube/utils/redirector/tunnel/stream?url_token=...
    if (parsed.hostname.includes('smvd.xyz') || parsed.hostname.includes('smvd.io')) {
      parsed.hostname = 'social-media-video-downloader.p.rapidapi.com';
      return parsed.toString();
    }
  } catch { /* */ }
  return tunnelUrl;
}

function getDownloadHeaders(rapidApiKey: string, url?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Referer': 'https://www.youtube.com/',
  };

  if (!url) return headers;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('rapidapi')) {
      headers['X-RapidAPI-Key'] = rapidApiKey;
      headers['X-RapidAPI-Host'] = 'social-media-video-downloader.p.rapidapi.com';
    }
  } catch { /* */ }

  return headers;
}

async function tryDownloadAndUpload(links: string[], userId: string, supabaseUrl: string, supabaseServiceKey: string): Promise<string | null> {
  for (const link of links) {
    try {
      const vResp = await fetch(link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': 'https://www.youtube.com/',
        },
        redirect: 'follow',
      });
      if (vResp.ok || vResp.status === 206) {
        const ct = vResp.headers.get('content-type') || '';
        const cl = parseInt(vResp.headers.get('content-length') || '0');
        if (ct.includes('video') || ct.includes('octet-stream') || cl > 100000) {
          const buf = await vResp.arrayBuffer();
          if (buf.byteLength > 10000 && buf.byteLength <= 100 * 1024 * 1024) {
            console.log(`[download-video-url] Fallback download succeeded: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`);
            const adminClient = createClient(supabaseUrl, supabaseServiceKey);
            const storagePath = `${userId}/video-repo/imports/${crypto.randomUUID()}.mp4`;
            const { error: uploadError } = await adminClient.storage
              .from('reels')
              .upload(storagePath, buf, { contentType: 'video/mp4', upsert: false });
            if (!uploadError) {
              const { data: { publicUrl } } = adminClient.storage.from('reels').getPublicUrl(storagePath);
              console.log('[download-video-url] Fallback success! Stored at:', publicUrl);
              return publicUrl;
            }
          }
        }
        await vResp.arrayBuffer().catch(() => {});
      } else {
        await vResp.arrayBuffer().catch(() => {});
      }
    } catch (e) {
      console.log('[download-video-url] Fallback link error:', e);
    }
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
    console.log('[download-video-url] SMVD response keys:', JSON.stringify(Object.keys(smvdData)));
    
    // Log available video URLs for debugging
    const contents = Array.isArray(smvdData?.contents) ? smvdData.contents[0] : smvdData?.contents;
    if (contents) {
      console.log('[download-video-url] Contents keys:', JSON.stringify(Object.keys(contents)));
      if (contents.videos?.length > 0) {
        console.log('[download-video-url] Videos[0] keys:', JSON.stringify(Object.keys(contents.videos[0])));
        console.log('[download-video-url] Videos[0] url prefix:', contents.videos[0]?.url?.substring(0, 80));
      }
      if (contents.renderableVideos?.length > 0) {
        const rv = contents.renderableVideos[0];
        console.log('[download-video-url] RenderableVideo keys:', JSON.stringify(Object.keys(rv)));
        if (rv.renderConfig) {
          console.log('[download-video-url] RenderConfig url prefix:', rv.renderConfig?.url?.substring(0, 80));
        }
      }
    }

    const downloadUrls = extractDownloadUrl(platformInfo.platform, smvdData);

    if (downloadUrls.length === 0) {
      console.error('[download-video-url] No download URL found');
      return new Response(JSON.stringify({ error: 'Could not extract video from this URL. The video may be private or not contain downloadable video content.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[download-video-url] Found ${downloadUrls.length} download URLs`);

    // Try server-side download with each URL
    const buildHeaderStrategies = (dlUrl: string, isTunnel: boolean): Record<string, string>[] => {
      const base: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      };
      return [
        // Strategy 1: RapidAPI auth (for tunnel URLs rewritten to rapidapi proxy)
        { ...base, 'X-RapidAPI-Key': rapidApiKey, 'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com', 'Accept': '*/*', 'Accept-Encoding': 'identity;q=1, *;q=0' },
        // Strategy 2: Plain download with YouTube referer
        { ...base, 'Accept': '*/*', 'Accept-Encoding': 'identity;q=1, *;q=0', 'Referer': 'https://www.youtube.com/' },
        // Strategy 3: Minimal headers
        { ...base, 'Accept': 'video/mp4,video/*,*/*' },
      ];
    };

    for (const { url: rawDlUrl, isTunnel } of downloadUrls) {
      // For tunnel URLs, try both the rewritten RapidAPI proxy URL and the original
      const urlsToTry = isTunnel
        ? [rewriteTunnelUrl(rawDlUrl), rawDlUrl]
        : [rawDlUrl];

      for (const dlUrl of urlsToTry) {
        const isProxyUrl = dlUrl.includes('rapidapi.com');
        console.log(`[download-video-url] Trying URL (tunnel=${isTunnel}, proxy=${isProxyUrl}): ${dlUrl.substring(0, 100)}`);

        const headerStrategies = buildHeaderStrategies(dlUrl, isTunnel);
        // For proxy URLs only use strategy 1 (RapidAPI auth); for non-proxy try all
        const strategiesToTry = isProxyUrl ? [headerStrategies[0]] : headerStrategies;

        for (let s = 0; s < strategiesToTry.length; s++) {
          try {
            const videoResponse = await fetch(dlUrl, {
              headers: strategiesToTry[s],
              redirect: 'follow',
            });

            if (videoResponse.ok || videoResponse.status === 206) {
              const ct = videoResponse.headers.get('content-type') || '';
              const cl = parseInt(videoResponse.headers.get('content-length') || '0');
              if (ct.includes('video') || ct.includes('octet-stream') || cl > 100000) {
                const videoBuffer = await videoResponse.arrayBuffer();
                if (videoBuffer.byteLength < 10000) {
                  console.log(`[download-video-url] Response too small (${videoBuffer.byteLength}b), skipping`);
                  continue;
                }
                console.log(`[download-video-url] Download succeeded: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`);

                if (videoBuffer.byteLength > 100 * 1024 * 1024) {
                  return new Response(JSON.stringify({ error: 'Video is too large (max 100MB)' }), {
                    status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  });
                }

                const adminClient = createClient(supabaseUrl, supabaseServiceKey);
                const storagePath = `${user.id}/video-repo/imports/${crypto.randomUUID()}.mp4`;

                const { error: uploadError } = await adminClient.storage
                  .from('reels')
                  .upload(storagePath, videoBuffer, { contentType: 'video/mp4', upsert: false });

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
              }
              await videoResponse.arrayBuffer();
            } else {
              console.log(`[download-video-url] Strategy ${s + 1} failed: ${videoResponse.status}`);
              await videoResponse.arrayBuffer();
            }
          } catch (e) {
            console.log(`[download-video-url] Strategy ${s + 1} error:`, e);
          }
        }
      }
    }

    // ── Fallback 1: try ytstream YouTube downloader API ──
    if (platformInfo.platform === 'youtube') {
      console.log('[download-video-url] Trying fallback YouTube API (ytstream)...');
      try {
        const videoId = platformInfo.params.videoId || '';
        const fallbackUrl = `https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${videoId}`;
        const fallbackResp = await fetch(fallbackUrl, {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'ytstream-download-youtube-videos.p.rapidapi.com',
          },
        });
        if (fallbackResp.ok) {
          const fbData = await fallbackResp.json();
          console.log('[download-video-url] ytstream response status:', fbData.status);
          const fbLinks: string[] = [];
          if (fbData.link) fbLinks.push(fbData.link);
          if (Array.isArray(fbData.formats)) {
            for (const fmt of fbData.formats) {
              if (fmt.url && (fmt.mimeType?.includes('video') || fmt.qualityLabel)) {
                fbLinks.push(fmt.url);
              }
            }
          }
          if (Array.isArray(fbData.adaptiveFormats)) {
            for (const fmt of fbData.adaptiveFormats) {
              if (fmt.url && fmt.mimeType?.includes('video')) {
                fbLinks.push(fmt.url);
              }
            }
          }
          console.log(`[download-video-url] ytstream found ${fbLinks.length} links`);
          const uploaded = await tryDownloadAndUpload(fbLinks, user.id, supabaseUrl, supabaseServiceKey);
          if (uploaded) {
            return new Response(JSON.stringify({ videoUrl: uploaded }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {
        console.log('[download-video-url] ytstream API error:', e);
      }

      // ── Fallback 2: Piped API (open-source YouTube proxy) ──
      const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://pipedapi.adminforge.de',
        'https://api.piped.privacydev.net',
      ];
      for (const pipedBase of pipedInstances) {
        console.log(`[download-video-url] Trying Piped API: ${pipedBase}...`);
        try {
          const videoId = platformInfo.params.videoId || '';
          const pipedResp = await fetch(`${pipedBase}/streams/${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (pipedResp.ok) {
            const pipedData = await pipedResp.json();
            const pipedLinks: string[] = [];
            // videoStreams have both video+audio combined
            if (Array.isArray(pipedData?.videoStreams)) {
              // Sort by quality, prefer 720p or lower for size
              const combined = pipedData.videoStreams
                .filter((s: any) => s.url && s.videoOnly === false)
                .sort((a: any, b: any) => (b.quality?.replace('p','') || 0) - (a.quality?.replace('p','') || 0));
              for (const s of combined) {
                pipedLinks.push(s.url);
              }
            }
            console.log(`[download-video-url] Piped found ${pipedLinks.length} combined streams`);
            const uploaded = await tryDownloadAndUpload(pipedLinks, user.id, supabaseUrl, supabaseServiceKey);
            if (uploaded) {
              return new Response(JSON.stringify({ videoUrl: uploaded }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } else {
            console.log(`[download-video-url] Piped ${pipedBase} failed: ${pipedResp.status}`);
          }
        } catch (e) {
          console.log(`[download-video-url] Piped ${pipedBase} error:`, e);
        }
      }
    }

    // All server-side attempts failed — return client-side fallback with first URL
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const storagePath = `${user.id}/video-repo/imports/${crypto.randomUUID()}.mp4`;

    const { data: signedData, error: signError } = await adminClient.storage
      .from('reels')
      .createSignedUploadUrl(storagePath);

    if (signError || !signedData) {
      console.error('[download-video-url] Signed URL error:', signError);
      return new Response(JSON.stringify({ error: 'Failed to prepare upload' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { publicUrl } } = adminClient.storage.from('reels').getPublicUrl(storagePath);

    // Provide the best URL for client-side fallback
    const clientUrl = downloadUrls[0].isTunnel
      ? rewriteTunnelUrl(downloadUrls[0].url)
      : downloadUrls[0].url;

    console.log('[download-video-url] Returning client-side download fallback');
    return new Response(JSON.stringify({
      clientDownload: true,
      downloadUrl: clientUrl,
      rapidApiKey: downloadUrls[0].isTunnel ? rapidApiKey : undefined,
      signedUploadUrl: signedData.signedUrl,
      uploadToken: signedData.token,
      storagePath,
      publicUrl,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[download-video-url] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
