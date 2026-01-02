import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Simple hash function for API key verification
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate API key and return user_id
async function validateApiKey(supabaseAdmin: any, apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  
  const keyHash = await hashApiKey(apiKey);
  
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('user_id, id')
    .eq('key_hash', keyHash)
    .single();
  
  if (error || !data) {
    console.log('API key validation failed:', error?.message);
    return null;
  }
  
  // Update last_used_at
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  
  return data.user_id;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const userId = await validateApiKey(supabaseAdmin, apiKey);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('API request from user:', userId);

    // Parse request
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    let body: any = {};
    
    if (req.method === 'POST') {
      body = await req.json();
      action = action || body.action;
    }

    console.log('Action:', action);

    // Route actions
    switch (action) {
      case 'list-twins':
        return await handleListTwins(supabaseAdmin, userId);
      
      case 'generate-video':
        return await handleGenerateVideo(supabaseAdmin, userId, body);
      
      case 'status':
        const taskId = url.searchParams.get('task_id') || body.task_id;
        return await handleStatus(taskId);
      
      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown action',
            available_actions: ['list-twins', 'generate-video', 'status']
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Twin API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleListTwins(supabaseAdmin: any, userId: string) {
  const { data: twins, error } = await supabaseAdmin
    .from('ai_twins')
    .select('id, name, description, reference_images, voice_cloning_key, gender')
    .eq('user_id', userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch twins' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const formattedTwins = twins.map((twin: any) => ({
    id: twin.id,
    name: twin.name,
    description: twin.description,
    portrait_url: twin.reference_images?.[0] || null,
    has_cloned_voice: !!twin.voice_cloning_key,
    gender: twin.gender
  }));

  return new Response(
    JSON.stringify({ twins: formattedTwins }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGenerateVideo(supabaseAdmin: any, userId: string, body: any) {
  const { twin_id, script, resolution = '480p', webhook_url } = body;

  if (!twin_id || !script) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: twin_id, script' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get twin data
  const { data: twin, error: twinError } = await supabaseAdmin
    .from('ai_twins')
    .select('*')
    .eq('id', twin_id)
    .eq('user_id', userId)
    .single();

  if (twinError || !twin) {
    return new Response(
      JSON.stringify({ error: 'Twin not found or access denied' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!twin.reference_images?.[0]) {
    return new Response(
      JSON.stringify({ error: 'Twin has no portrait image' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!twin.voice_cloning_key) {
    return new Response(
      JSON.stringify({ error: 'Twin has no cloned voice. Please set up voice cloning first.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Generating video for twin:', twin.name);

  // Step 1: Generate TTS audio with cloned voice
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/text-to-speech`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
    },
    body: JSON.stringify({
      text: script,
      voiceCloningKey: twin.voice_cloning_key,
      userId: userId
    })
  });

  if (!ttsResponse.ok) {
    const ttsError = await ttsResponse.text();
    console.error('TTS failed:', ttsError);
    return new Response(
      JSON.stringify({ error: 'Failed to generate audio', details: ttsError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const ttsResult = await ttsResponse.json();
  const audioUrl = ttsResult.audioUrl;
  const estimatedDuration = ttsResult.duration || Math.ceil(script.split(' ').length / 2.5);

  console.log('TTS complete, audio URL:', audioUrl, 'duration:', estimatedDuration);

  // Step 2: Generate video with InfiniteTalk
  const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
  if (!waveSpeedApiKey) {
    return new Response(
      JSON.stringify({ error: 'Video generation not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const videoResponse = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waveSpeedApiKey}`
    },
    body: JSON.stringify({
      image: twin.reference_images[0],
      audio: audioUrl,
      resolution: resolution,
      seed: -1
    })
  });

  if (!videoResponse.ok) {
    const videoError = await videoResponse.text();
    console.error('Video generation failed:', videoError);
    return new Response(
      JSON.stringify({ error: 'Failed to start video generation', details: videoError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const videoResult = await videoResponse.json();
  const taskId = videoResult.data?.id || videoResult.id;

  console.log('Video generation started, task ID:', taskId);

  // If webhook_url provided, set up background task to notify when complete
  if (webhook_url) {
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    (globalThis as any).EdgeRuntime?.waitUntil?.(pollAndNotifyWebhook(taskId, webhook_url, waveSpeedApiKey));
  }

  return new Response(
    JSON.stringify({
      task_id: taskId,
      status: 'processing',
      estimated_duration_seconds: estimatedDuration,
      audio_url: audioUrl,
      status_url: `${supabaseUrl}/functions/v1/twin-api?action=status&task_id=${taskId}`,
      message: `Generating ${estimatedDuration}s video. Poll status_url or wait for webhook.`
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleStatus(taskId: string | null) {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Missing task_id parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
  if (!waveSpeedApiKey) {
    return new Response(
      JSON.stringify({ error: 'Video service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const statusResponse = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
      headers: { 'Authorization': `Bearer ${waveSpeedApiKey}` }
    });

    if (!statusResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch status', task_id: taskId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await statusResponse.json();
    
    let status = 'processing';
    let videoUrl = null;
    let progress = 0;

    if (result.data?.status === 'completed' || result.status === 'completed') {
      status = 'completed';
      videoUrl = result.data?.outputs?.video || result.outputs?.video || result.data?.video || result.video;
      progress = 100;
    } else if (result.data?.status === 'failed' || result.status === 'failed') {
      status = 'failed';
    } else {
      progress = result.data?.progress || result.progress || 50;
    }

    return new Response(
      JSON.stringify({
        task_id: taskId,
        status,
        progress,
        video_url: videoUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Status check error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check status', task_id: taskId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function pollAndNotifyWebhook(taskId: string, webhookUrl: string, apiKey: string) {
  const maxAttempts = 120; // 10 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
    attempts++;

    try {
      const statusResponse = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!statusResponse.ok) continue;

      const result = await statusResponse.json();
      const status = result.data?.status || result.status;

      if (status === 'completed' || status === 'failed') {
        const videoUrl = result.data?.outputs?.video || result.outputs?.video || result.data?.video || result.video;
        
        // Send webhook notification
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: taskId,
            status,
            video_url: videoUrl,
            completed_at: new Date().toISOString()
          })
        });
        
        console.log('Webhook notification sent to:', webhookUrl);
        break;
      }
    } catch (error) {
      console.error('Webhook poll error:', error);
    }
  }
}
