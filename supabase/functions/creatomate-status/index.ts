import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('CREATOMATE_API_KEY');
    if (!apiKey) {
      throw new Error('CREATOMATE_API_KEY is not configured');
    }

    const { renderId } = await req.json();

    if (!renderId) {
      throw new Error('Render ID is required');
    }

    console.log(`Checking Creatomate status for render: ${renderId}`);

    const response = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Creatomate status error:', response.status, errorText);
      throw new Error(`Creatomate API error: ${response.status}`);
    }

    const renderData = await response.json();
    console.log('Creatomate render status:', renderData);

    // Creatomate statuses: planned, rendering, succeeded, failed
    return new Response(
      JSON.stringify({
        success: true,
        status: renderData.status,
        progress: renderData.progress || 0,
        url: renderData.url || null,
        error: renderData.error_message || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in creatomate-status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
