import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { videoUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'videoUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Downloading video for transcription:', videoUrl.slice(0, 100));

    // Download the video file
    const videoResp = await fetch(videoUrl);
    if (!videoResp.ok) {
      throw new Error(`Failed to download video: ${videoResp.status}`);
    }

    const videoBlob = await videoResp.blob();
    console.log('Video downloaded, size:', videoBlob.size, 'type:', videoBlob.type);

    // Send directly to OpenAI Whisper API
    // Whisper accepts video files and extracts audio internally
    const formData = new FormData();
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : videoBlob.type.includes('webm') ? 'webm' : 'mp4';
    formData.append('file', new File([videoBlob], `video.${ext}`, { type: videoBlob.type || 'video/mp4' }));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    console.log('Sending to Whisper API...');
    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResp.ok) {
      const errText = await whisperResp.text();
      console.error('Whisper API error:', whisperResp.status, errText);
      throw new Error(`Whisper API error: ${whisperResp.status} - ${errText}`);
    }

    const result = await whisperResp.json();
    console.log('Transcription complete, text length:', result.text?.length);

    // Format a timestamped transcript
    const segments = (result.segments || []).map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text?.trim(),
    }));

    const timestampedTranscript = segments
      .map((s: any) => {
        const mins = Math.floor(s.start / 60);
        const secs = Math.floor(s.start % 60).toString().padStart(2, '0');
        return `[${mins}:${secs}] ${s.text}`;
      })
      .join('\n');

    return new Response(JSON.stringify({
      success: true,
      text: result.text || '',
      segments,
      timestampedTranscript,
      language: result.language || 'unknown',
      duration: result.duration || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
      text: '',
      segments: [],
      timestampedTranscript: '',
    }), {
      status: 200, // Return 200 so the client can still proceed without transcript
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
