interface KieVideoParams {
  prompt: string;
  imageUrls?: string[];
  model?: 'veo3' | 'veo3-fast';
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

// Note: Kie.ai doesn't provide TTS - use ElevenLabs or OpenAI for TTS
export function kieTTSNotSupported(): Error {
  return new Error('Kie.ai does not support TTS. Use ElevenLabs or OpenAI TTS instead.');
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
      model: params.model || 'veo3',
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

  const response = await fetch(`https://api.kie.ai/api/v1/veo/fetch/${taskId}`, {
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
  
  // Map Kie.ai status to our status
  switch (taskData.status) {
    case 'pending':
    case 'in-queue':
      status = 'pending';
      break;
    case 'in-progress':
    case 'processing':
      status = 'processing';
      break;
    case 'completed':
    case 'succeeded':
      status = 'completed';
      break;
    case 'failed':
    case 'error':
      status = 'failed';
      break;
    default:
      status = 'pending';
  }

  return {
    taskId: taskData.taskId || taskId,
    status,
    progress: taskData.progress || 0,
    videoUrl: taskData.videoUrl,
    error: taskData.error
  };
}

export function isKieConfigured(): boolean {
  return !!localStorage.getItem('kie_api_key');
}