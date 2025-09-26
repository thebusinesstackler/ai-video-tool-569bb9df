import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WaveSpeedVideoParams {
  prompt: string;
  imageUrls?: string[];
  model?: 'wan-2.2' | 'vidu' | 'veo3';
  aspectRatio?: '16:9' | '9:16';
  seeds?: number;
  enableFallback?: boolean;
  watermark?: string;
  characterId?: string;
}

interface WaveSpeedVideoJob {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const waveSpeedApiKey = Deno.env.get('WAVESPEED_API_KEY');
    
    if (!waveSpeedApiKey) {
      console.error('WaveSpeed AI API key not found in environment');
      return new Response(
        JSON.stringify({ error: 'WaveSpeed AI API key not configured' }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body to get action and parameters
    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'create') {
      const params: WaveSpeedVideoParams = body;
      console.log('Creating video with WaveSpeed AI params:', params);

      const response = await fetch('https://api.wavespeed.ai/v1/video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waveSpeedApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: params.prompt,
          image_urls: params.imageUrls || [],
          model: params.model || 'wan-2.2',
          aspect_ratio: params.aspectRatio || '16:9',
          seed: params.seeds || Math.floor(Math.random() * 90000) + 10000,
          enable_fallback: params.enableFallback !== undefined ? params.enableFallback : true,
          watermark: params.watermark || ''
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WaveSpeed AI video creation error:', response.status, errorText);
        throw new Error(`WaveSpeed AI video creation failed: ${errorText}`);
      }

      const data = await response.json();
      console.log('WaveSpeed AI create response:', data);
      
      if (!data.success) {
        // Handle specific error cases
        if (data.error && data.error.includes('insufficient')) {
          return new Response(
            JSON.stringify({ 
              error: 'Insufficient WaveSpeed AI credits', 
              details: 'Your WaveSpeed AI account does not have enough credits. Please top up your account and try again.' 
            }), 
            {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        throw new Error(`WaveSpeed AI API error: ${data.error || 'Unknown error'}`);
      }
      
      return new Response(
        JSON.stringify({ taskId: data.task_id }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } else if (action === 'status') {
      const taskId = body.taskId;
      
      if (!taskId) {
        return new Response(
          JSON.stringify({ error: 'taskId parameter is required' }), 
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Checking WaveSpeed AI status for taskId:', taskId);

      const response = await fetch(`https://api.wavespeed.ai/v1/video/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${waveSpeedApiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WaveSpeed AI status check error:', response.status, errorText);
        throw new Error('Failed to get video job status');
      }

      const data = await response.json();
      console.log('WaveSpeed AI status response:', data);
      
      if (!data.success) {
        throw new Error(`WaveSpeed AI API error: ${data.error || 'Unknown error'}`);
      }

      const taskData = data.data;
      let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
      
      // Map WaveSpeed AI status to our status
      if (taskData.status === 'completed') {
        status = 'completed';
      } else if (taskData.status === 'failed' || taskData.status === 'error') {
        status = 'failed';
      } else if (taskData.status === 'processing' || taskData.status === 'generating') {
        status = 'processing';
      } else {
        status = 'pending';
      }

      // Get video URL from response
      const videoUrl = taskData.video_url;

      const jobStatus: WaveSpeedVideoJob = {
        taskId: taskData.task_id || taskId,
        status,
        progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
        videoUrl: videoUrl,
        error: taskData.error_message || undefined
      };

      return new Response(
        JSON.stringify(jobStatus), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use action: "create" or action: "status"' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Error in wavespeed-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});