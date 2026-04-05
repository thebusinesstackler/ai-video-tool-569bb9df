import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { videoUrl, audioUrl, duration } = await req.json();
    if (!videoUrl && !audioUrl) throw new Error('videoUrl or audioUrl is required');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('Detecting scenes:', { videoUrl, audioUrl, duration });

    // Pass 1: Audio-based scene detection via Gemini
    const audioSource = audioUrl || videoUrl;
    const audioPrompt = `You are a professional video editor analyzing audio for scene boundaries.

Analyze the audio from this video/audio file and identify timestamps where there are:
- Natural silence gaps (>0.3 seconds)
- Topic or speaker changes
- Tone/mood shifts
- Musical transitions

The total duration is approximately ${duration || 'unknown'} seconds.

Return ONLY a JSON array of scene break objects. Each object must have:
- "timestamp": number (seconds, 1 decimal)
- "confidence": number (0-1)
- "reason": short string explaining the break

Example: [{"timestamp": 4.2, "confidence": 0.95, "reason": "Audio pause + topic shift"}]

If no clear scene breaks are found, return an empty array [].`;

    const audioMessages: any[] = [
      { role: 'user', content: [
        { type: 'text', text: audioPrompt },
      ]}
    ];

    // If we have a video URL, add it for visual analysis too
    if (videoUrl) {
      audioMessages[0].content.push({
        type: 'text',
        text: `\n\nVideo URL for reference: ${videoUrl}\nAnalyze both audio patterns AND visual changes (camera angles, backgrounds, subjects) to detect scene boundaries. Combine both signals for higher accuracy.`
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert video editor. Always respond with valid JSON only, no markdown or extra text.' },
          ...audioMessages,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '[]';
    console.log('Raw scene detection response:', rawText);

    // Parse JSON from response (handle markdown code blocks)
    let sceneBreaks: any[] = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        sceneBreaks = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse scene breaks:', e);
      sceneBreaks = [];
    }

    // Filter low-confidence results and sort by timestamp
    sceneBreaks = sceneBreaks
      .filter((b: any) => b.timestamp > 0.5 && b.confidence >= 0.5)
      .sort((a: any, b: any) => a.timestamp - b.timestamp);

    // Remove breaks that are too close together (< 1.5s apart)
    const filtered: any[] = [];
    for (const b of sceneBreaks) {
      if (filtered.length === 0 || b.timestamp - filtered[filtered.length - 1].timestamp >= 1.5) {
        filtered.push(b);
      }
    }

    console.log(`Detected ${filtered.length} scene breaks`);

    return new Response(
      JSON.stringify({ success: true, sceneBreaks: filtered }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in detect-scenes:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', sceneBreaks: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
