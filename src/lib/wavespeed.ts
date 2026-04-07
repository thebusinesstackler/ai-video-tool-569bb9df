import { supabase } from '@/integrations/supabase/client';

export interface WaveSpeedVideoParams {
  prompt: string;
  negativePrompt?: string;
  imageUrls?: string[];
  audioUrl?: string;
  videoUrl?: string;
  model?: 'wan-2.2' | 'alibaba/wan-2.5/text-to-video' | 'wan-2.5-i2v' | 'wan-2.5-a2v' | 'wan-2.6-i2v' | 'hunyuan-video' | 'seedream-v4' | 'vidu' | 'veo3' | 'veo3-fast' | 'avatar-omni-human-1.5' | 'infinitetalk' | 'infinitetalk-hd' | 'wan-animate' | 'video-face-swap' | 'sora-2' | 'alibaba/wan-2.7/video-edit' | 'alibaba/wan-2.5/video-extend';
  aspectRatio?: '16:9' | '9:16';
  seeds?: number;
  enableFallback?: boolean;
  watermark?: string;
  characterId?: string;
  duration?: number;
  resolution?: '480p' | '720p' | '1080p';
  // Task tracking metadata
  userId?: string;
  source?: string;
  sourceId?: string;
  sceneNumber?: number;
}

export interface WaveSpeedVideoJob {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

// DEPRECATED: ElevenLabs TTS removed - VEO3 Fast and other models now have built-in audio generation
export async function generateConsistentVoice(text: string, voice: string = 'alloy'): Promise<string> {
  console.warn('generateConsistentVoice is deprecated. Use VEO3 Fast or other models with built-in audio.');
  throw new Error('ElevenLabs TTS has been removed. Please use VEO3 Fast or other models with native audio generation.');
}

export async function createWaveSpeedVideo(params: WaveSpeedVideoParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke('wavespeed-video', {
    body: {
      action: 'create',
      ...params
    }
  });

  if (error) {
    console.error('WaveSpeed video creation error:', error);
    throw new Error(error.message || 'Failed to create video');
  }

  if (!data?.taskId) {
    throw new Error(data?.error || 'Failed to create video task');
  }
  
  return data.taskId;
}

export async function getWaveSpeedVideoJob(taskId: string): Promise<WaveSpeedVideoJob> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke('wavespeed-video', {
      body: {
        action: 'status',
        taskId
      }
    });

    if (!error) {
      if (!data) throw new Error('No status data received');
      return {
        taskId: data.taskId || taskId,
        status: data.status || 'pending',
        progress: data.progress,
        videoUrl: data.videoUrl,
        error: data.error
      };
    }

    lastError = error;
    console.warn(`WaveSpeed status check attempt ${attempt + 1} failed:`, error.message);
    if (attempt === 0) await new Promise(r => setTimeout(r, 2000));
  }

  console.error('WaveSpeed status check error after retries:', lastError);
  throw new Error('Failed to get video job status');

  if (!data) {
    throw new Error('No status data received');
  }

  return {
    taskId: data.taskId || taskId,
    status: data.status || 'pending',
    progress: data.progress,
    videoUrl: data.videoUrl,
    error: data.error
  };
}

// This function now always returns true since we use server-side secrets
export function isWaveSpeedConfigured(): boolean {
  return true;
}
