import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YT_BASE = "https://www.googleapis.com/youtube/v3";

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const body = await req.json();
    const { query, duration, order, pageToken, maxResults } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new Error("Missing or empty query");
    }

    // Step 1: search.list
    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query.trim(),
      maxResults: String(Math.min(maxResults || 25, 50)),
      key: YOUTUBE_API_KEY,
      order: order || "relevance",
    });
    if (duration && duration !== "any") {
      searchParams.set("videoDuration", duration);
    }
    if (pageToken) {
      searchParams.set("pageToken", pageToken);
    }

    const searchResp = await fetch(`${YT_BASE}/search?${searchParams}`);
    const searchData = await searchResp.json();

    if (searchData.error) {
      throw new Error(searchData.error.message || "YouTube API error");
    }

    const videoIds = (searchData.items || []).map((i: any) => i.id.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      return new Response(JSON.stringify({ items: [], nextPageToken: null, totalResults: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: videos.list for duration + stats
    const videosParams = new URLSearchParams({
      part: "contentDetails,statistics",
      id: videoIds.join(","),
      key: YOUTUBE_API_KEY,
    });

    const videosResp = await fetch(`${YT_BASE}/videos?${videosParams}`);
    const videosData = await videosResp.json();

    const detailsMap: Record<string, any> = {};
    for (const v of (videosData.items || [])) {
      detailsMap[v.id] = {
        durationSeconds: parseDuration(v.contentDetails?.duration || "PT0S"),
        durationIso: v.contentDetails?.duration,
        viewCount: parseInt(v.statistics?.viewCount || "0"),
        likeCount: parseInt(v.statistics?.likeCount || "0"),
      };
    }

    const items = (searchData.items || []).map((item: any) => {
      const videoId = item.id.videoId;
      const details = detailsMap[videoId] || {};
      return {
        videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        ...details,
      };
    });

    return new Response(JSON.stringify({
      items,
      nextPageToken: searchData.nextPageToken || null,
      totalResults: searchData.pageInfo?.totalResults || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
