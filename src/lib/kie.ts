interface KieTTSParams {
  text: string;
  voiceId?: string;
  model?: string;
  speed?: number;
  format?: 'mp3' | 'wav';
}

interface KieVideoParams {
  script: string;
  audioUrl?: string;
  style?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number;
  model?: string;
  seed?: number;
}

interface KieVideoJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  outputUrl?: string;
  error?: string;
}

export async function kieTTS(params: KieTTSParams): Promise<Blob> {
  const apiKey = localStorage.getItem('kie_api_key');
  
  if (!apiKey) {
    throw new Error('Kie.ai API key not configured');
  }

  const response = await fetch('https://api.kie.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: params.text,
      voice_id: params.voiceId || 'default',
      model: params.model || 'standard',
      speed: params.speed || 1.0,
      format: params.format || 'mp3'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kie.ai TTS failed: ${error}`);
  }

  return await response.blob();
}

export async function createKieVideo(params: KieVideoParams): Promise<string> {
  const apiKey = localStorage.getItem('kie_api_key');
  
  if (!apiKey) {
    throw new Error('Kie.ai API key not configured');
  }

  const response = await fetch('https://api.kie.ai/v1/video/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script: params.script,
      audio_url: params.audioUrl,
      style: params.style || 'default',
      aspect_ratio: params.aspectRatio || '16:9',
      duration: params.duration || 60,
      model: params.model || 'standard',
      seed: params.seed
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kie.ai video creation failed: ${error}`);
  }

  const data = await response.json();
  return data.job_id;
}

export async function getKieVideoJob(jobId: string): Promise<KieVideoJob> {
  const apiKey = localStorage.getItem('kie_api_key');
  
  if (!apiKey) {
    throw new Error('Kie.ai API key not configured');
  }

  const response = await fetch(`https://api.kie.ai/v1/video/job/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get video job status');
  }

  const data = await response.json();
  return {
    id: data.job_id,
    status: data.status,
    progress: data.progress,
    outputUrl: data.output_url,
    error: data.error
  };
}

export function isKieConfigured(): boolean {
  return !!localStorage.getItem('kie_api_key');
}