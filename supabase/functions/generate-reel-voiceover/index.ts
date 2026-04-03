import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// This function is now deprecated — Sora-2 native audio is used instead.
// Kept as a stub so existing callers don't break.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice, sceneNumber } = await req.json();
    console.log(`generate-reel-voiceover called for scene ${sceneNumber} — returning skip signal (Sora-2 native audio used)`);

    return new Response(
      JSON.stringify({ 
        skipped: true, 
        reason: 'Sora-2 native audio is used instead of separate TTS',
        sceneNumber 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
