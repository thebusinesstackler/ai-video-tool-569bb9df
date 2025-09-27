import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WaveSpeedVideoParams {
  prompt: string;
  imageUrls?: string[];
  audioUrl?: string;
  model?: 'wan-2.2' | 'wan-2.5-t2v' | 'wan-2.5-i2v' | 'wan-2.5-a2v' | 'hunyuan-video' | 'seedream-v4' | 'vidu' | 'veo3' | 'avatar-omni-human-1.5';
  aspectRatio?: '16:9' | '9:16';
  seeds?: number;
  enableFallback?: boolean;
  watermark?: string;
  characterId?: string;
  duration?: number;
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

      // Determine API endpoint and request body based on model
      let apiEndpoint: string;
      let requestBody: any;
      
      const duration = params.duration || 5;
      const seed = params.seeds || Math.floor(Math.random() * 2147483647);

      if (params.model === 'wan-2.5-t2v') {
        // Enhanced Text-to-Video model (wan-2.5/text-to-video)
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/text-to-video';
        
        requestBody = {
          prompt: params.prompt,
          duration: duration,
          seed: seed
        };
      } else if (params.model === 'wan-2.5-i2v') {
        // Image-to-Video model (alibaba/wan-2.5/image-to-video)
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/image-to-video';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Image is required for image-to-video model');
        }

        // Map aspectRatio to resolution (defaulting to 720p)
        const resolution = "720p";

        requestBody = {
          image: params.imageUrls[0],
          prompt: params.prompt,
          resolution: resolution
        };

        // Add audio if provided
        if (params.audioUrl) {
          requestBody.audio = params.audioUrl;
        }
      } else if (params.model === 'wan-2.5-a2v') {
        // Audio-to-Video model
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/audio-to-video';
        
        if (!params.audioUrl) {
          throw new Error('Audio is required for audio-to-video model');
        }

        requestBody = {
          audio: params.audioUrl,
          prompt: params.prompt,
          duration: duration
        };
      } else if (params.model === 'hunyuan-video') {
        // HunyuanVideo model
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/tencent/hunyuan-video';
        
        requestBody = {
          prompt: params.prompt,
          duration: duration,
          seed: seed
        };

        // Add image if provided for multimodal generation
        if (params.imageUrls && params.imageUrls.length > 0) {
          requestBody.image = params.imageUrls[0];
        }
      } else if (params.model === 'seedream-v4') {
        // Seedream V4 model
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/seedream/v4';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Image is required for Seedream V4 model');
        }

        requestBody = {
          image: params.imageUrls[0],
          prompt: params.prompt,
          duration: duration
        };
      } else if (params.model === 'vidu') {
        // VIDU model
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/vidu/v1';
        
        requestBody = {
          prompt: params.prompt,
          duration: duration,
          seed: seed
        };

        // Add image if provided
        if (params.imageUrls && params.imageUrls.length > 0) {
          requestBody.image = params.imageUrls[0];
        }
      } else if (params.model === 'veo3') {
        // VEO3 model
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/google/veo-3';
        
        requestBody = {
          prompt: params.prompt,
          duration: duration,
          seed: seed
        };

        // Add image if provided
        if (params.imageUrls && params.imageUrls.length > 0) {
          requestBody.image = params.imageUrls[0];
        }
      } else if (params.model === 'avatar-omni-human-1.5') {
        // ByteDance Avatar Omni Human model
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/bytedance/avatar-omni-human-1.5';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Portrait image is required for Avatar Omni Human model');
        }
        
        if (!params.audioUrl) {
          throw new Error('Audio is required for Avatar Omni Human model');
        }

        requestBody = {
          image: params.imageUrls[0],
          audio: params.audioUrl,
          duration: duration
        };
      } else {
        // Text-to-Video model (default wan-2.2)
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.2/t2v-720p-ultra-fast';
        
        const size = params.aspectRatio === '9:16' ? '720*1280' : '1280*720';
        
        requestBody = {
          prompt: params.prompt,
          size: size,
          duration: duration,
          seed: seed
        };

        // Add negative_prompt if provided
        if (params.prompt && params.prompt.includes('negative:')) {
          const parts = params.prompt.split('negative:');
          requestBody.prompt = parts[0].trim();
          requestBody.negative_prompt = parts[1]?.trim() || '';
        }
      }

      console.log('Sending request to WaveSpeed API:', apiEndpoint);
      console.log('Request body:', requestBody);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waveSpeedApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WaveSpeed AI video creation error:', response.status, errorText);
        
        // Handle specific HTTP error codes
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Invalid WaveSpeed AI API key', 
              details: 'Please check your WaveSpeed AI API key configuration in settings.' 
            }), 
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } else if (response.status === 402) {
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
        
        throw new Error(`WaveSpeed AI video creation failed: ${errorText}`);
      }

      const data = await response.json();
      console.log('WaveSpeed AI create response:', data);
      
      // Check if the response indicates success
      if (data.code !== 200 || !data.data) {
        const errorMessage = data.message || data.error || 'Unknown error occurred';
        console.error('WaveSpeed AI API error:', errorMessage);
        throw new Error(`WaveSpeed AI API error: ${errorMessage}`);
      }
      
      return new Response(
        JSON.stringify({ taskId: data.data.id }), 
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

      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
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
      
      // Check if the response indicates success
      if (data.code !== 200 || !data.data) {
        const errorMessage = data.message || data.error || 'Failed to get video status';
        console.error('WaveSpeed AI status error:', errorMessage);
        throw new Error(`WaveSpeed AI API error: ${errorMessage}`);
      }

      const taskData = data.data;
      let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
      
      // Map WaveSpeed AI status to our status
      if (taskData.status === 'completed') {
        status = 'completed';
      } else if (taskData.status === 'failed' || taskData.status === 'error') {
        status = 'failed';
      } else if (taskData.status === 'processing') {
        status = 'processing';
      } else if (taskData.status === 'created') {
        status = 'pending';
      } else {
        status = 'pending';
      }

      // Get video URL from response (outputs array contains the generated media URLs)
      const videoUrl = taskData.outputs && taskData.outputs.length > 0 ? taskData.outputs[0] : undefined;

      const jobStatus: WaveSpeedVideoJob = {
        taskId: taskData.id || taskId,
        status,
        progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
        videoUrl: videoUrl,
        error: taskData.error || undefined
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