import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoClip {
  url: string;
  duration: number;
  caption?: string;
  audioDuration?: number; // Actual voiceover duration - takes precedence over duration
}

interface StitchRequest {
  clips: VideoClip[];
  audioUrl?: string; // Combined voiceover audio URL
  transition?: 'fade' | 'slide' | 'none';
  captionStyle?: 'bottom' | 'center' | 'top';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('CREATOMATE_API_KEY');
    if (!apiKey) {
      throw new Error('CREATOMATE_API_KEY is not configured');
    }

    const { clips, audioUrl, transition = 'fade', captionStyle = 'bottom' } = await req.json() as StitchRequest;

    if (!clips || clips.length === 0) {
      throw new Error('No video clips provided');
    }

    console.log(`Starting Creatomate stitch with ${clips.length} clips, audio: ${!!audioUrl}`);

    // Build the Creatomate source JSON
    // Each clip becomes a composition element with duration matching the AUDIO duration
    const elements: any[] = [];
    let currentTime = 0;

    clips.forEach((clip, index) => {
      // Use audioDuration if provided (actual voiceover length), otherwise fall back to duration
      const clipDuration = clip.audioDuration || clip.duration || 5;
      console.log(`Clip ${index + 1}: using duration ${clipDuration}s (audio: ${clip.audioDuration}, video: ${clip.duration})`);
      
      // Add video element
      elements.push({
        type: 'video',
        source: clip.url,
        time: currentTime,
        duration: clipDuration,
        // Add fade transition between clips
        ...(transition === 'fade' && index > 0 ? {
          animations: [{
            type: 'fade',
            fade: 'in',
            duration: 0.5
          }]
        } : {}),
        ...(transition === 'slide' && index > 0 ? {
          animations: [{
            type: 'slide',
            direction: 'left',
            duration: 0.5
          }]
        } : {})
      });

      // Add caption text overlay if provided
      if (clip.caption) {
        const yPosition = captionStyle === 'bottom' ? '85%' : captionStyle === 'top' ? '15%' : '50%';
        elements.push({
          type: 'text',
          text: clip.caption,
          time: currentTime,
          duration: clipDuration,
          width: '90%',
          height: '20%',
          x: '50%',
          y: yPosition,
          x_alignment: '50%',
          y_alignment: '50%',
          font_family: 'Montserrat',
          font_weight: '700',
          font_size: '5.5 vmin',
          fill_color: '#ffffff',
          stroke_color: '#000000',
          stroke_width: '0.4 vmin',
          shadow_color: 'rgba(0,0,0,0.5)',
          shadow_blur: '2 vmin',
          text_align: 'center',
          animations: [
            { type: 'fade', fade: 'in', duration: 0.3 },
            { type: 'fade', fade: 'out', start: clipDuration - 0.3, duration: 0.3 }
          ]
        });
      }

      currentTime += clipDuration;
    });

    // Add background audio if provided
    if (audioUrl) {
      elements.push({
        type: 'audio',
        source: audioUrl,
        time: 0,
        duration: currentTime,
        audio_fade_out: 1
      });
    }

    const source = {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      frame_rate: 30,
      elements
    };

    console.log('Creatomate source:', JSON.stringify(source, null, 2));

    // Start the render
    const response = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Creatomate API error:', response.status, errorText);
      throw new Error(`Creatomate API error: ${response.status} - ${errorText}`);
    }

    const renderData = await response.json();
    console.log('Creatomate render started:', renderData);

    // Return the render ID for status polling
    return new Response(
      JSON.stringify({
        success: true,
        renderId: renderData[0]?.id,
        status: renderData[0]?.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in creatomate-stitch:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
