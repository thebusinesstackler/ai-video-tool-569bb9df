import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScriptParams {
  topic: string;
  duration: number;
  style: string;
  audience: string;
  tone: string;
  callToAction: string;
}

function createScriptPrompt(params: ScriptParams): string {
  return `Create a video script with the following requirements:

Topic: ${params.topic}
Duration: ${params.duration} seconds
Style: ${params.style}
Target Audience: ${params.audience}
Tone: ${params.tone}
Call to Action: ${params.callToAction}

Please create an engaging video script that:
1. Hooks the viewer in the first 3 seconds
2. Maintains engagement throughout
3. Delivers clear, valuable content
4. Includes natural transitions
5. Ends with the specified call to action

Format the script with clear scene descriptions and dialogue. Make it suitable for ${params.style} style video content.`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the LOVABLE_API_KEY from environment (automatically provided)
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const params: ScriptParams = await req.json();
    console.log('Generating script with params:', params);

    const prompt = createScriptPrompt(params);

    // Call the Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional video script writer. Create engaging, well-structured scripts that capture attention and deliver value to the audience. Format scripts with clear scene breaks and include visual descriptions.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AI Gateway response received successfully');
    
    // Extract the generated script
    const generatedScript = data?.choices?.[0]?.message?.content;

    if (!generatedScript || typeof generatedScript !== 'string' || !generatedScript.trim()) {
      console.error('No usable script content in AI response:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ error: 'No script content generated' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ script: generatedScript.trim() }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in generate-script function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});