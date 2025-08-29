import { supabase } from '@/integrations/supabase/client';

interface KieVideoParams {
  prompt: string;
  imageUrls?: string[];
  model?: 'veo3' | 'veo3-fast' | 'nano-banana';
  aspectRatio?: '16:9' | '9:16';
  seeds?: number;
  enableFallback?: boolean;
  watermark?: string;
}

interface KieVideoJob {
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
      model: 'tts-1'
    }
  });

  if (error) {
    throw new Error(`TTS generation failed: ${error.message}`);
  }

  return data.audioUrl;
}

export async function createKieVideo(params: KieVideoParams): Promise<string> {
  const apiKey = localStorage.getItem('kie_api_key');
  
  if (!apiKey) {
    throw new Error('Kie.ai API key not configured');
  }

  const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      imageUrls: params.imageUrls || [],
      model: params.model || 'nano-banana',
      aspectRatio: params.aspectRatio || '16:9',
      seeds: params.seeds || Math.floor(Math.random() * 90000) + 10000,
      enableFallback: params.enableFallback !== undefined ? params.enableFallback : true,
      watermark: params.watermark || ''
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kie.ai video creation failed: ${error}`);
  }

  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error(`Kie.ai API error: ${data.msg || 'Unknown error'}`);
  }
  
  return data.data.taskId;
}

export async function getKieVideoJob(taskId: string): Promise<KieVideoJob> {
  const apiKey = localStorage.getItem('kie_api_key');
  
  if (!apiKey) {
    throw new Error('Kie.ai API key not configured');
  }

  const response = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get video job status');
  }

  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error(`Kie.ai API error: ${data.msg || 'Unknown error'}`);
  }

  const taskData = data.data;
  let status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
  
  // Map Kie.ai successFlag to our status
  if (taskData.successFlag === 1) {
    status = 'completed';
  } else if (taskData.successFlag === 2 || taskData.successFlag === 3) {
    status = 'failed';
  } else {
    status = 'processing'; // successFlag 0 means generating
  }

  // Get video URL from response.resultUrls
  const videoUrl = taskData.response?.resultUrls?.[0];

  return {
    taskId: taskData.taskId || taskId,
    status,
    progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
    videoUrl: videoUrl,
    error: taskData.errorMessage || undefined
  };
}

export function isKieConfigured(): boolean {
  return !!localStorage.getItem('kie_api_key');
}