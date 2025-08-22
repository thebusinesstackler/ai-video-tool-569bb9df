import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const kieApiKey = Deno.env.get('KIE_API_KEY');
    
    if (!kieApiKey) {
      console.error('Kie.ai API key not found in environment');
      return new Response(
        JSON.stringify({ error: 'Kie.ai API key not configured' }), 
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
      const params: KieVideoParams = body;
      console.log('Creating video with params:', params);

      const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kieApiKey}`,
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
        const errorText = await response.text();
        console.error('Kie.ai video creation error:', response.status, errorText);
        throw new Error(`Kie.ai video creation failed: ${errorText}`);
      }

      const data = await response.json();
      console.log('Kie.ai create response:', data);
      
      if (data.code !== 200) {
        throw new Error(`Kie.ai API error: ${data.msg || 'Unknown error'}`);
      }
      
      return new Response(
        JSON.stringify({ taskId: data.data.taskId }), 
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

      console.log('Checking status for taskId:', taskId);

      const response = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${kieApiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Kie.ai status check error:', response.status, errorText);
        throw new Error('Failed to get video job status');
      }

      const data = await response.json();
      console.log('Kie.ai status response:', data);
      
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

      const jobStatus: KieVideoJob = {
        taskId: taskData.taskId || taskId,
        status,
        progress: status === 'completed' ? 100 : status === 'processing' ? 50 : 0,
        videoUrl: videoUrl,
        error: taskData.errorMessage || undefined
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
    console.error('Error in kie-video function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});