import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Route by audio duration: short = HD, long = standard (cheaper)
const HD_MAX_SECONDS = 120;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const audioUrl: string = body.audioUrl;
    const portraitUrl: string = body.portraitUrl;
    const durationSec: number = Number(body.durationSec) || 0;
    const aspectRatio: string = body.aspectRatio || '9:16';
    const source: string = body.source || 'podcast';
    const sourceId: string | null = body.sourceId || null;

    if (!audioUrl || typeof audioUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'audioUrl required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!portraitUrl || typeof portraitUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'portraitUrl required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (durationSec <= 0 || durationSec > 300) {
      return new Response(JSON.stringify({ error: 'durationSec must be 1-300' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const model = durationSec <= HD_MAX_SECONDS ? 'infinitetalk-hd' : 'infinitetalk';
    console.log(`[talking-head-from-audio] user=${userId} duration=${durationSec}s model=${model} aspect=${aspectRatio}`);

    const prompt = `Natural, expressive talking-head video. Precise lip-sync to the provided audio. Warm direct eye contact, subtle natural micro head movement, soft expressive eyebrows, gentle breathing. Daylight, unretouched authentic look. No on-screen text.`;

    // Forward to wavespeed-video create
    const wsRes = await fetch(`${supabaseUrl}/functions/v1/wavespeed-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        action: 'create',
        model,
        imageUrls: [portraitUrl],
        audioUrl,
        prompt,
        aspectRatio,
        userId,
        source,
        sourceId,
      }),
    });

    const wsData = await wsRes.json();
    if (!wsRes.ok || !wsData?.taskId) {
      console.error('[talking-head-from-audio] wavespeed create failed', wsData);
      return new Response(JSON.stringify({ error: wsData?.error || 'Failed to create video task' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ taskId: wsData.taskId, model }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[talking-head-from-audio] error', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
