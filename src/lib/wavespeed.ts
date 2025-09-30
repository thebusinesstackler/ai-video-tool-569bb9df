import { supabase } from '@/integrations/supabase/client';

export interface WaveSpeedVideoParams {
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

export interface WaveSpeedVideoJob {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

// DEPRECATED: ElevenLabs TTS removed - VEO3 Fast and other models now have built-in audio generation
// This function is kept for backwards compatibility but should not be used
export async function generateConsistentVoice(text: string, voice: string = 'alloy'): Promise<string> {
  console.warn('generateConsistentVoice is deprecated. Use VEO3 Fast or other models with built-in audio.');
  throw new Error('ElevenLabs TTS has been removed. Please use VEO3 Fast or other models with native audio generation.');
}

export async function createWaveSpeedVideo(params: WaveSpeedVideoParams): Promise<string> {
  const apiKey = localStorage.getItem('wavespeed_api_key');
  
  if (!apiKey) {
    throw new Error('WaveSpeed AI API key not configured');
  }

  const response = await fetch('https://api.wavespeed.ai/v1/video/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
    const error = await response.text();
    throw new Error(`WaveSpeed AI video creation failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`WaveSpeed AI API error: ${data.error || 'Unknown error'}`);
  }
  
  return data.task_id;
}

export async function getWaveSpeedVideoJob(taskId: string): Promise<WaveSpeedVideoJob> {
  const apiKey = localStorage.getItem('wavespeed_api_key');
  
  if (!apiKey) {
    throw new Error('WaveSpeed AI API key not configured');
  }

  const response = await fetch(`https://api.wavespeed.ai/v1/video/status/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get video job status');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`WaveSpeed AI API error: ${data.error || 'Unknown error'}`);
  }

  const taskData = data.data;
  let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
  
  // Map WaveSpeed AI status to our status with expanded intermediate states
  console.log('WaveSpeed AI task status:', taskData.status);
  
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
  } else {
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

  return {
    taskId: taskData.task_id || taskId,
    status,
    progress,
    videoUrl: taskData.video_url,
    error: taskData.error_message || undefined
  };
}

export function isWaveSpeedConfigured(): boolean {
  return !!localStorage.getItem('wavespeed_api_key');
}