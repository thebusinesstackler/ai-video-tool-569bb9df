import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WAVESPEED_API = 'https://api.wavespeed.ai/api/v3';

const MODE_TO_RESOLUTION: Record<string, string> = {
  '1080p': '1080p',
  '2k': '2k',
  '4k': '4k',
  // legacy mappings
  '2x': '1080p',
  '4x': '4k',
  'enhance': '2k',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
  if (!WAVESPEED_API_KEY) {
    return new Response(JSON.stringify({ error: 'WAVESPEED_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { action, taskId, videoUrl, mode = '4k' } = body;

    // --- STATUS CHECK ---
    if (action === 'status' && taskId) {
      const statusRes = await fetch(`${WAVESPEED_API}/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
      });
      const statusData = await statusRes.json();
      console.log('WaveSpeed status response:', JSON.stringify(statusData));

      const wsStatus = statusData.status;

      if (wsStatus === 'completed' || wsStatus === 'succeeded') {
        const outputUrl = Array.isArray(statusData.output) ? statusData.output[0] : 
                          Array.isArray(statusData.outputs) ? statusData.outputs[0] : 
                          statusData.output || statusData.outputs;
        return new Response(JSON.stringify({
          status: 'completed',
          progress: 100,
          videoUrl: outputUrl,
          statusMessage: 'Upscaling complete!'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (wsStatus === 'failed' || wsStatus === 'error') {
        return new Response(JSON.stringify({
          status: 'failed',
          error: statusData.error || 'Upscaling failed',
          statusMessage: 'Upscaling failed'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Still processing
      const progress = statusData.progress || 50;
      return new Response(JSON.stringify({
        status: 'processing',
        progress,
        statusMessage: statusData.status_message || `Upscaling in progress (${wsStatus})...`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- SUBMIT UPSCALE ---
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: 'Video URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetResolution = MODE_TO_RESOLUTION[mode] || '4k';
    console.log('Submitting upscale job:', { videoUrl: videoUrl.substring(0, 100), targetResolution });

    const createRes = await fetch(`${WAVESPEED_API}/wavespeed-ai/ultimate-video-upscaler`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video: videoUrl,
        target_resolution: targetResolution,
      }),
    });

    const createData = await createRes.json();
    console.log('WaveSpeed create response:', JSON.stringify(createData));

    if (!createRes.ok) {
      throw new Error(createData.error || createData.message || `WaveSpeed API error: ${createRes.status}`);
    }

    const newTaskId = createData.id || createData.task_id || createData.request_id;
    if (!newTaskId) {
      throw new Error('No task ID returned from WaveSpeed');
    }

    return new Response(JSON.stringify({
      success: true,
      taskId: newTaskId,
      message: `Video upscale to ${targetResolution} submitted`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Upscale error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
