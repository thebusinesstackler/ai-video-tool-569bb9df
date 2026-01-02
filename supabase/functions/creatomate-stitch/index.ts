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
  transition?: 'fade' | 'slide' | 'zoom' | 'crossfade' | 'none';
  captionStyle?: 'bottom' | 'center' | 'top';
  transitionDuration?: number; // Duration in seconds (0.3 - 1.5)
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

    const { clips, audioUrl, transition = 'crossfade', captionStyle = 'bottom', transitionDuration = 0.8 } = await req.json() as StitchRequest;

    if (!clips || clips.length === 0) {
      throw new Error('No video clips provided');
    }

    console.log(`Starting Creatomate stitch with ${clips.length} clips, audio: ${!!audioUrl}`);

    // Build the Creatomate source JSON
    // Each clip becomes a composition element with duration matching the AUDIO duration
    const elements: any[] = [];
    let currentTime = 0;

    clips.forEach((clip, index) => {
      // Use the actual video duration (capped at 8s by WaveSpeed), NOT the audio duration
      // The merged audio track will continue seamlessly across video clips
      const videoDuration = Math.min(clip.audioDuration || clip.duration || 5, 8);
      console.log(`Clip ${index + 1}: video duration ${videoDuration}s (audio was ${clip.audioDuration}s, preset was ${clip.duration}s)`);
      
      // Build transition animations based on type
      const getTransitionAnimations = () => {
        if (index === 0 || transition === 'none') return [];
        
        const duration = Math.min(Math.max(transitionDuration, 0.3), 1.5);
        
        switch (transition) {
          case 'fade':
            return [{
              type: 'fade',
              fade: 'in',
              duration,
              easing: 'ease-in-out'
            }];
          case 'slide':
            return [{
              type: 'slide',
              direction: index % 2 === 0 ? 'left' : 'right', // Alternate directions
              duration,
              easing: 'ease-out'
            }];
          case 'zoom':
            return [{
              type: 'scale',
              start_scale: '120%',
              end_scale: '100%',
              duration,
              easing: 'ease-out'
            }, {
              type: 'fade',
              fade: 'in',
              duration: duration * 0.5
            }];
          case 'crossfade':
            // Crossfade: overlap with previous clip
            return [{
              type: 'fade',
              fade: 'in',
              duration,
              easing: 'linear'
            }];
          default:
            return [];
        }
      };
      
      // For crossfade, start this clip earlier to overlap
      const overlapTime = transition === 'crossfade' && index > 0 ? transitionDuration * 0.5 : 0;
      const adjustedTime = Math.max(0, currentTime - overlapTime);
      
      // Add video element
      elements.push({
        type: 'video',
        source: clip.url,
        time: adjustedTime,
        duration: videoDuration + overlapTime, // Extend to cover overlap
        fit: 'cover',
        animations: getTransitionAnimations()
      });

      // Add caption text overlay if provided
      if (clip.caption) {
        const yPosition = captionStyle === 'bottom' ? '85%' : captionStyle === 'top' ? '15%' : '50%';
        elements.push({
          type: 'text',
          text: clip.caption,
          time: currentTime,
          duration: videoDuration,
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
            { type: 'fade', fade: 'out', start: videoDuration - 0.3, duration: 0.3 }
          ]
        });
      }

      currentTime += videoDuration;
    });

    // Add background audio if provided - with proper fade out at the end
    if (audioUrl) {
      // Voiceover audio - ends earlier to allow music fade
      elements.push({
        type: 'audio',
        source: audioUrl,
        time: 0,
        duration: currentTime - 2, // Stop voiceover 2 seconds before end for CTA hold
        volume: '100%',
        audio_fade_out: 0.5 // Quick fade to not overlap with music fade
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
