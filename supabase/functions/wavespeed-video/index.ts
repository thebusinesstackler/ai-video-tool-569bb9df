import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface WaveSpeedVideoParams {
  prompt: string;
  imageUrls?: string[];
  startFrameUrl?: string;
  endFrameUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  model?: 'wan-2.2' | 'alibaba/wan-2.5/text-to-video' | 'wan-2.5-i2v' | 'wan-2.5-a2v' | 'hunyuan-video' | 'seedream-v4' | 'vidu' | 'vidu-start-end' | 'seedance-i2v' | 'veo3' | 'veo3-fast' | 'avatar-omni-human-1.5' | 'infinitetalk' | 'wan-animate' | 'video-face-swap' | 'keyframe-interpolation' | 'kling-v3.0-pro' | 'sora-2';
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

      if (params.model === 'keyframe-interpolation') {
        // Keyframe interpolation: create video transitioning from start frame to end frame
        // Using Kling 2.6 Pro image-to-video with tail_image support for interpolation
        // IMPORTANT: Kling 2.6 Pro only accepts duration values of 5 or 10
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.6-pro/image-to-video';
        
        if (!params.startFrameUrl) {
          throw new Error('Start frame image is required for keyframe interpolation');
        }

        // Clamp duration to allowed values: 5 or 10 only
        const klingDuration = duration >= 8 ? 10 : 5;
        console.log(`Keyframe interpolation: requested duration ${duration}s, using ${klingDuration}s (allowed: 5 or 10)`);

        requestBody = {
          image: params.startFrameUrl,
          prompt: params.prompt || 'Smooth transition between scenes',
          duration: klingDuration,
          aspect_ratio: params.aspectRatio || '16:9'
        };

        // Add end frame if provided for true interpolation
        if (params.endFrameUrl) {
          requestBody.tail_image = params.endFrameUrl;
        }

        console.log('Using keyframe interpolation with start and end frames');
      } else if (params.model === 'alibaba/wan-2.5/text-to-video') {
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
      } else if (params.model === 'vidu-start-end') {
        // VIDU Start-End to Video 2.0 model - optimized for start/end frame transitions
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/vidu/start-end-to-video-2.0';
        
        if (!params.startFrameUrl) {
          throw new Error('Start frame image is required for VIDU start-end model');
        }
        
        if (!params.endFrameUrl) {
          throw new Error('End frame image is required for VIDU start-end model');
        }

        requestBody = {
          image: params.startFrameUrl,
          last_image: params.endFrameUrl,
          prompt: params.prompt || 'Smooth cinematic transition between scenes',
          movement_amplitude: 'auto',
          seed: -1
        };
        
        console.log('Using VIDU start-end-to-video-2.0 for frame interpolation');
      } else if (params.model === 'seedance-i2v') {
        // ByteDance Seedance V1 Lite I2V 720p - optimized for image-to-video with optional end frame
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/bytedance/seedance-v1-lite-i2v-720p';
        
        if (!params.startFrameUrl && (!params.imageUrls || params.imageUrls.length === 0)) {
          throw new Error('Image is required for Seedance I2V model');
        }
        
        // Clamp duration to allowed range: 5-10 seconds
        const seedanceDuration = Math.max(5, Math.min(10, duration));
        console.log(`Seedance I2V: requested duration ${duration}s, using ${seedanceDuration}s (allowed: 5-10)`);
        
        requestBody = {
          image: params.startFrameUrl || params.imageUrls?.[0],
          prompt: params.prompt || 'Smooth cinematic motion, professional quality',
          seed: -1,
          duration: seedanceDuration
        };
        
        // Add end frame for interpolation if provided
        if (params.endFrameUrl) {
          requestBody.last_image = params.endFrameUrl;
        }
        
        console.log('Using ByteDance Seedance V1 Lite I2V 720p for video generation');
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
          duration: duration,
          ...(params.prompt && { prompt: params.prompt })
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
      } else if (params.model === 'sora-2') {
        // Sora 2 - OpenAI's cinematic image-to-video model via WaveSpeed
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Image is required for Sora 2 model');
        }

        // Sora 2 supports 4s, 8s, or 12s durations
        const sora2Duration = duration <= 5 ? 4 : duration <= 10 ? 8 : 12;
        console.log(`Sora 2: requested duration ${duration}s, using ${sora2Duration}s (allowed: 4, 8, 12)`);

        requestBody = {
          image: params.imageUrls[0],
          prompt: params.prompt || 'Premium cinematic motion, smooth professional quality',
          duration: sora2Duration,
          aspect_ratio: params.aspectRatio || '9:16'
        };

        console.log('Using Sora 2 for cinematic image-to-video generation');
      } else if (params.model === 'kling-v3.0-pro') {
        // Kling V3.0 Pro - high quality image-to-video
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video';
        
        if (!params.imageUrls || params.imageUrls.length === 0) {
          throw new Error('Image is required for Kling V3.0 Pro model');
        }

        // Kling 3.0 Pro supports duration 5 or 10
        const klingDuration = duration >= 8 ? 10 : 5;
        console.log(`Kling V3.0 Pro: requested duration ${duration}s, using ${klingDuration}s (allowed: 5 or 10)`);

        requestBody = {
          image: params.imageUrls[0],
          prompt: params.prompt || 'Professional cinematic video, smooth natural motion',
          duration: klingDuration,
          aspect_ratio: params.aspectRatio || '9:16'
        };

        // Add audio if provided
        if (params.audioUrl) {
          requestBody.audio = params.audioUrl;
        }

        console.log('Using Kling V3.0 Pro for high-quality image-to-video generation');
      } else {
        // Text-to-Video model (default wan-2.2)
        // IMPORTANT: wan-2.2 only accepts duration values of [5, 8]
        apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.2/t2v-720p-ultra-fast';
        
        const size = params.aspectRatio === '9:16' ? '720*1280' : '1280*720';
        
        // Clamp duration to allowed values: 5 or 8 only
        const wan22Duration = duration >= 7 ? 8 : 5;
        console.log(`WAN 2.2 T2V: requested duration ${duration}s, using ${wan22Duration}s (allowed: 5 or 8)`);
        
        requestBody = {
          prompt: params.prompt,
          size: size,
          duration: wan22Duration,
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
        
        // Check for credit errors in the response body
        const isCreditsError = errorText.includes('Insufficient credits') || errorText.includes('insufficient_credits');
        const isProductNotFound = errorText.includes('product not found') || errorText.includes('model not found');
        
        if (isCreditsError) {
          // Return 200 with error so client can read the message
          return new Response(
            JSON.stringify({ 
              error: 'Insufficient WaveSpeed credits. Please top up your account at wavespeed.ai.',
              creditError: true 
            }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ error: 'Invalid WaveSpeed AI API key' }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // For model not found errors, try smart fallback chain
        if (isProductNotFound) {
          console.log('Model not found, trying fallback chain...');
          
          // Fallback 1: Try kling-v3.0-pro for image-to-video if we have an image
          if (params.imageUrls && params.imageUrls.length > 0) {
            console.log('Fallback: trying kling-v3.0-pro image-to-video...');
            const klingEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video';
            const klingDuration = duration >= 8 ? 10 : 5;
            const klingBody = {
              image: params.imageUrls[0],
              prompt: params.prompt,
              duration: klingDuration,
              aspect_ratio: params.aspectRatio || '9:16'
            };
            
            const klingResponse = await fetch(klingEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${waveSpeedApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(klingBody),
            });
            
            if (klingResponse.ok) {
              const klingData = await klingResponse.json();
              if (klingData.code === 200 && klingData.data) {
                console.log('Kling fallback successful');
                return new Response(
                  JSON.stringify({ taskId: klingData.data.id }), 
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } else {
              const klingErr = await klingResponse.text();
              console.error('Kling fallback failed:', klingErr);
              if (klingErr.includes('Insufficient credits')) {
                return new Response(
                  JSON.stringify({ error: 'Insufficient WaveSpeed credits. Please top up.', creditError: true }), 
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }
          
          // Fallback 2: Try wan-2.2 text-to-video
          console.log('Fallback: trying wan-2.2 text-to-video...');
          const fallbackEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.2/t2v-720p-ultra-fast';
          const wan22Duration = duration >= 7 ? 8 : 5;
          const fallbackBody = {
            prompt: params.prompt,
            size: params.aspectRatio === '9:16' ? '720*1280' : '1280*720',
            duration: wan22Duration,
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
            if (fallbackData.code === 200 && fallbackData.data) {
              console.log('wan-2.2 fallback successful');
              return new Response(
                JSON.stringify({ taskId: fallbackData.data.id }), 
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            const fbErr = await fallbackResponse.text();
            if (fbErr.includes('Insufficient credits')) {
              return new Response(
                JSON.stringify({ error: 'Insufficient WaveSpeed credits. Please top up.', creditError: true }), 
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }
        
        // Return 200 with error so client can always read the message
        return new Response(
          JSON.stringify({ error: `Video generation failed: ${errorText}` }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isCreditError = message.includes('Insufficient credits');
    // Return 200 so client can always read the error message
    return new Response(
      JSON.stringify({ error: message, ...(isCreditError ? { creditError: true } : {}) }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});