import { supabase } from '@/integrations/supabase/client';

interface ScriptParams {
  topic: string;
  duration: string;
  style: string;
  audience: string;
  tone: string;
  callToAction: string;
}

export async function generateScript(params: ScriptParams): Promise<string> {
  const prompt = createScriptPrompt(params);

  const { data, error } = await supabase.functions.invoke('ai', {
    body: { message: prompt }
  });

  if (error) {
    console.error('Script generation error:', error);
    throw new Error(error.message || 'Failed to generate script');
  }

  if (!data?.response) {
    throw new Error('No response received from AI');
  }

  return data.response;
}

function createScriptPrompt(params: ScriptParams): string {
  return `Create a ${params.duration}-second video script with the following specifications:

TOPIC: ${params.topic}
STYLE: ${params.style}
AUDIENCE: ${params.audience}
TONE: ${params.tone}
${params.callToAction ? `CALL TO ACTION: ${params.callToAction}` : ''}

Requirements:
- Start with a strong hook within the first 3 seconds
- Structure the script with clear sections: Hook, Main Content, Call to Action
- Include timing cues and scene descriptions
- Write in a ${params.tone} tone suitable for ${params.audience}
- Keep it engaging and concise for a ${params.duration}-second duration
- Include visual suggestions in brackets [like this]
- Format as a professional video script with clear sections

Please provide a complete, production-ready script that maximizes engagement and retention.`;
}

// This function now always returns true since we use server-side secrets
export function isOpenAIConfigured(): boolean {
  return true;
}
