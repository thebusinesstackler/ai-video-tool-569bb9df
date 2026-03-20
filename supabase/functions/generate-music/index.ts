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
    const { mood, duration } = await req.json();

    if (!mood) {
      return new Response(JSON.stringify({ error: 'Mood/prompt is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
    if (!WAVESPEED_API_KEY) {
      throw new Error('WaveSpeed API key not configured');
    }

    const targetDuration = Math.min(duration || 30, 120);
    const musicLengthMs = targetDuration * 1000;

    console.log(`Generating music via WaveSpeed: "${mood}" for ${targetDuration}s (${musicLengthMs}ms)`);

    // Submit music generation task
    const submitResponse = await fetch('https://api.wavespeed.ai/api/v3/elevenlabs/music', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: mood,
        music_length_ms: musicLengthMs,
        force_instrumental: true,
        output_format: "mp3_standard",
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('WaveSpeed music submit error:', submitResponse.status, errorText);
      throw new Error(`Music generation submit failed: ${submitResponse.status}`);
    }

    const submitData = await submitResponse.json();
    const taskId = submitData.data?.id;

    if (!taskId) {
      console.error('No task ID returned:', JSON.stringify(submitData));
      throw new Error('No task ID returned from WaveSpeed');
    }

    console.log(`Music task submitted: ${taskId}`);

    // Poll for result
    const maxAttempts = 120;
    const pollInterval = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(
        `https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`,
        {
          headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
        }
      );

      if (!pollResponse.ok) {
        console.warn(`Poll attempt ${attempt + 1} failed: ${pollResponse.status}`);
        continue;
      }

      const pollData = await pollResponse.json();
      const status = pollData.data?.status;

      if (status === 'completed') {
        const audioUrl = pollData.data?.outputs?.[0];
        if (!audioUrl) {
          throw new Error('No audio URL in completed result');
        }

        console.log(`Music generated successfully: ${audioUrl}`);

        // Download and upload to storage
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) throw new Error('Failed to download generated music');
        const audioBuffer = await audioResponse.arrayBuffer();

        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const fileName = `music/${crypto.randomUUID()}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Return WaveSpeed URL as fallback
          return new Response(JSON.stringify({ audioUrl, mood }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);

        return new Response(JSON.stringify({ audioUrl: publicUrl, mood }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(`Music generation failed: ${pollData.data?.error || 'Unknown error'}`);
      }

      console.log(`Poll ${attempt + 1}/${maxAttempts}: status=${status}`);
    }

    throw new Error('Music generation timed out after polling');

  } catch (error) {
    console.error('Error in generate-music:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
