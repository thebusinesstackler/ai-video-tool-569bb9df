import { supabase } from '@/integrations/supabase/client';

interface WaveSpeedVideoParams {
  prompt: string;
  imageUrls?: string[];
  model?: 'wan-2.2' | 'vidu' | 'veo3';
  aspectRatio?: '16:9' | '9:16';
  seeds?: number;
  enableFallback?: boolean;
  watermark?: string;
}

interface WaveSpeedVideoJob {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

// OpenAI TTS integration for consistent voice across segments
export async function generateConsistentVoice(text: string, voice: string = 'alloy'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('openai-tts', {
    body: {
      text,
      voice,
      model: 'eleven_multilingual_v2'
    }
  });

  if (error) {
    throw new Error(`TTS generation failed: ${error.message}`);
  }

  return data.audioUrl;
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

  return {
    taskId: taskData.task_id || taskId,
    status,
    progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
    videoUrl: taskData.video_url,
    error: taskData.error_message || undefined
  };
}

export function isWaveSpeedConfigured(): boolean {
  return !!localStorage.getItem('wavespeed_api_key');
}