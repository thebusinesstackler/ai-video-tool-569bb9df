interface ScriptParams {
  topic: string;
  duration: string;
  style: string;
  audience: string;
  tone: string;
  callToAction: string;
}

export async function generateScript(params: ScriptParams): Promise<string> {
  // For now, we'll create a client-side implementation
  // In production, this should be moved to a Supabase Edge Function for security
  
  const apiKey = localStorage.getItem('openai_api_key');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please add your API key in settings.');
  }

  const prompt = createScriptPrompt(params);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an expert video script writer who creates engaging, concise scripts optimized for social media and marketing videos. Focus on strong hooks, clear messaging, and compelling calls to action.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate script');
    }

    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
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

// Utility function to check if API key is available
export function isOpenAIConfigured(): boolean {
  return !!localStorage.getItem('openai_api_key');
}