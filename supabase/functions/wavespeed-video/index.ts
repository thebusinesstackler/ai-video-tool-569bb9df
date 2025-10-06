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
  videoUrl?: string;
  model?: 'wan-2.2' | 'alibaba/wan-2.5/text-to-video' | 'wan-2.5-i2v' | 'wan-2.5-a2v' | 'hunyuan-video' | 'seedream-v4' | 'vidu' | 'veo3' | 'veo3-fast' | 'avatar-omni-human-1.5' | 'infinitetalk' | 'wan-animate' | 'video-face-swap';
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

      if (params.model === 'alibaba/wan-2.5/text-to-video') {
        // Enhanced Text-to-Video model (Alibaba WAN 2.5 with built-in audio)
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

        requestBody = {
          image: params.imageUrls[0],
          prompt: params.prompt,
          resolution: (params as any).resolution || "480p",
          duration: duration
        };

        // Add negative prompt if provided
        if ((params as any).negativePrompt) {
          requestBody.negative_prompt = (params as any).negativePrompt;
        }

        // Add audio if provided (optional)
        if (params.audioUrl) {
          requestBody.audio = params.audioUrl;
        }
      } else if (params.model === 'wan-2.5-a2v') {
        // Audio-to-Video model - try both possible endpoints
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/text-to-video';
        
        if (!params.audioUrl) {
          throw new Error('Audio is required for audio-to-video model');
        }

        // For audio-to-video, we'll use the text-to-video endpoint but with audio
        requestBody = {
          prompt: params.prompt,
          duration: duration,
          seed: seed,
          audio: params.audioUrl
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
      } else if (params.model === 'veo3-fast') {
        // VEO3 Fast model with built-in audio generation
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/google/veo-3-fast';
        
        requestBody = {
          prompt: params.prompt,
          duration: duration,
          seed: seed
        };

        // Add image if provided
        if (params.imageUrls && params.imageUrls.length > 0) {
          requestBody.image = params.imageUrls[0];
        }
        
        // VEO3 Fast generates audio natively - no separate audio URL needed
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
      } else if (params.model === 'infinitetalk') {
        // InfiniteTalk model for AI voiceover with lip sync
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Portrait image is required for InfiniteTalk model');
        }
        
        if (!params.audioUrl) {
          throw new Error('Audio is required for InfiniteTalk model');
        }

        requestBody = {
          image: params.imageUrls[0],
          audio: params.audioUrl,
          duration: duration
        };
      } else if (params.model === 'wan-animate') {
        // WAN Animate model for character animation with lip sync
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-animate';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Character image is required for WAN Animate model');
        }
        
        if (!params.audioUrl) {
          throw new Error('Audio is required for WAN Animate model');
        }

        requestBody = {
          image: params.imageUrls[0],
          audio: params.audioUrl,
          prompt: params.prompt,
          duration: duration
        };
      } else if (params.model === 'video-face-swap') {
        // Video Face Swap model for driving video + face swap
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/video-face-swap';
        
        if (!params.videoUrl) {
          throw new Error('Driving video is required for Video Face Swap model');
        }
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Face image is required for Video Face Swap model');
        }

        requestBody = {
          video: params.videoUrl,
          face_image: params.imageUrls[0],
          target_gender: 'all',
          target_index: 0,
          max_duration: duration || 0
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
        
        // For model not found errors, try fallback to basic text-to-video
        if (errorText.includes('product not found') || errorText.includes('model not found')) {
          console.log('Model not found, trying fallback to wan-2.2...');
          
          const fallbackEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.2/t2v-720p-ultra-fast';
          const fallbackBody = {
            prompt: params.prompt,
            size: params.aspectRatio === '9:16' ? '720*1280' : '1280*720',
            duration: duration,
            seed: seed
          };
          
          const fallbackResponse = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${waveSpeedApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fallbackBody),
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log('Fallback model successful:', fallbackData);
            
            if (fallbackData.code === 200 && fallbackData.data) {
              return new Response(
                JSON.stringify({ taskId: fallbackData.data.id }), 
                {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
          }
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
      
      // Map WaveSpeed AI status to our status with expanded intermediate states
      console.log('WaveSpeed AI task status:', taskData.status, 'Full task data:', taskData);
      
      if (taskData.status === 'completed' || taskData.status === 'succeeded') {
        status = 'completed';
      } else if (taskData.status === 'failed' || taskData.status === 'error' || taskData.status === 'cancelled') {
        status = 'failed';
      } else if (
        taskData.status === 'processing' || 
        taskData.status === 'generating' ||
        taskData.status === 'starting' ||
        taskData.status === 'queued' ||
        taskData.status === 'initializing' ||
        taskData.status === 'in_progress' ||
        taskData.status === 'running'
      ) {
        status = 'processing';
      } else if (taskData.status === 'created') {
        status = 'pending';
      } else {
        console.log('Unknown WaveSpeed AI status:', taskData.status, 'mapping to pending');
        status = 'pending';
      }

      // Calculate progress based on specific status
      let progress = 0;
      if (status === 'completed') {
        progress = 100;
      } else if (status === 'processing') {
        // More granular progress based on specific status
        switch (taskData.status) {
          case 'queued':
          case 'starting':
          case 'initializing':
            progress = 25;
            break;
          case 'processing':
          case 'generating':
          case 'in_progress':
          case 'running':
            progress = 75;
            break;
          default:
            progress = 50;
        }
      }

      // Get video URL from response (outputs array contains the generated media URLs)
      const videoUrl = taskData.outputs && taskData.outputs.length > 0 ? taskData.outputs[0] : undefined;

      const jobStatus: WaveSpeedVideoJob = {
        taskId: taskData.id || taskId,
        status,
        progress,
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