import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function transcribeWithWhisper(videoBlob: Blob, apiKey: string) {
  const formData = new FormData();
  const ext = videoBlob.type.includes('mp4') ? 'mp4' : videoBlob.type.includes('webm') ? 'webm' : 'mp4';
  formData.append('file', new File([videoBlob], `video.${ext}`, { type: videoBlob.type || 'video/mp4' }));
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  console.log('Trying Whisper API...');
  const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!whisperResp.ok) {
    const errText = await whisperResp.text();
    console.error('Whisper API error:', whisperResp.status, errText);
    throw new Error(`Whisper API error: ${whisperResp.status}`);
  }

  const result = await whisperResp.json();
  return {
    text: result.text || '',
    segments: (result.segments || []).map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text?.trim(),
    })),
    language: result.language || 'unknown',
    duration: result.duration || null,
  };
}

async function transcribeWithGemini(videoBlob: Blob, apiKey: string) {
  console.log('Falling back to Gemini for transcription...');

  // Convert video to base64
  const arrayBuffer = await videoBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  // Process in chunks to avoid stack overflow
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64Video = btoa(binary);

  const mimeType = videoBlob.type || 'video/mp4';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are a professional transcription service. Transcribe the audio from this video with precise timestamps. Output ONLY valid JSON with this exact format:
{
  "text": "full transcript text",
  "language": "en",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "First sentence"},
    {"start": 2.5, "end": 5.0, "text": "Second sentence"}
  ]
}
Rules:
- Timestamps must be in seconds (float)
- Each segment should be 1-2 sentences
- Include ALL spoken words
- If there is no speech, return {"text": "", "language": "unknown", "segments": []}
- Output ONLY the JSON, no markdown fences or extra text`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe this video with timestamps:' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Video}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini transcription error:', response.status, errText);
    throw new Error(`Gemini transcription failed: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';

  // Strip markdown fences if present
  content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(content);
    return {
      text: parsed.text || '',
      segments: (parsed.segments || []).map((s: any) => ({
        start: Number(s.start) || 0,
        end: Number(s.end) || 0,
        text: (s.text || '').trim(),
      })),
      language: parsed.language || 'unknown',
      duration: parsed.segments?.length > 0
        ? Math.max(...parsed.segments.map((s: any) => Number(s.end) || 0))
        : null,
    };
  } catch (e) {
    console.error('Failed to parse Gemini transcript JSON:', content.slice(0, 200));
    // Return raw text as single segment
    return {
      text: content,
      segments: [{ start: 0, end: 0, text: content }],
      language: 'unknown',
      duration: null,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { videoUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'videoUrl is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Downloading video for transcription:', videoUrl.slice(0, 100));

    const videoResp = await fetch(videoUrl);
    if (!videoResp.ok) {
      throw new Error(`Failed to download video: ${videoResp.status}`);
    }

    const videoBlob = await videoResp.blob();
    console.log('Video downloaded, size:', videoBlob.size, 'type:', videoBlob.type);

    let result;

    // Try Whisper first, fall back to Gemini on quota/rate errors
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (OPENAI_API_KEY) {
      try {
        result = await transcribeWithWhisper(videoBlob, OPENAI_API_KEY);
        console.log('Whisper transcription complete, text length:', result.text?.length);
      } catch (err: any) {
        console.warn('Whisper failed, trying Gemini fallback:', err.message);
      }
    }

    // Fallback to Gemini via Lovable AI Gateway
    if (!result) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('No transcription service available');
      }
      // Gemini has a ~20MB inline limit; check size
      if (videoBlob.size > 20 * 1024 * 1024) {
        throw new Error('Video too large for fallback transcription (max 20MB). Please use a shorter clip.');
      }
      result = await transcribeWithGemini(videoBlob, LOVABLE_API_KEY);
      console.log('Gemini transcription complete, text length:', result.text?.length);
    }

    const timestampedTranscript = result.segments
      .map((s: any) => {
        const mins = Math.floor(s.start / 60);
        const secs = Math.floor(s.start % 60).toString().padStart(2, '0');
        return `[${mins}:${secs}] ${s.text}`;
      })
      .join('\n');

    return new Response(JSON.stringify({
      success: true,
      text: result.text,
      segments: result.segments,
      timestampedTranscript,
      language: result.language,
      duration: result.duration,
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
