import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoClip {
  url: string;
  duration: number;
  caption?: string;
  audioDuration?: number;
  angle?: 'wide' | 'medium' | 'close-up' | 'over-shoulder' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'pov';
  movement?: 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'tracking' | 'handheld' | 'dolly';
  isAroll?: boolean;
  isMontage?: boolean;
}

interface LogoConfig {
  url: string;
  animation?: 'fade' | 'zoom' | 'slide';
  duration?: number;
}

interface BackgroundMusicConfig {
  url: string;
  volume: number; // 0-100
  fadeIn: number; // seconds
  fadeOut: number; // seconds
}

interface StitchRequest {
  clips: VideoClip[];
  audioUrl?: string;
  transition?: 'fade' | 'slide' | 'zoom' | 'crossfade' | 'none' | 'smart';
  captionStyle?: 'bottom' | 'center' | 'top';
  transitionDuration?: number;
  introLogo?: LogoConfig;
  outroLogo?: LogoConfig;
  backgroundMusic?: BackgroundMusicConfig;
}

// Smart transition selection based on shot types
function getSmartTransition(prevClip: VideoClip | null, currentClip: VideoClip, index: number): { type: string; duration: number } {
  if (!prevClip || index === 0) {
    return { type: 'fade', duration: 0.5 };
  }

  // Same angle = cut (simulating same camera, different take)
  if (prevClip.angle === currentClip.angle) {
    return { type: 'cut', duration: 0 };
  }

  // Wide to close-up or close-up to wide = crossfade
  const isWideToClose = prevClip.angle === 'wide' && currentClip.angle === 'close-up';
  const isCloseToWide = prevClip.angle === 'close-up' && currentClip.angle === 'wide';
  if (isWideToClose || isCloseToWide) {
    return { type: 'crossfade', duration: 0.6 };
  }

  // Montage clips = fast cuts
  if (currentClip.isMontage) {
    return { type: 'cut', duration: 0 };
  }

  // A-roll switches = slightly longer crossfade
  if (currentClip.isAroll && prevClip.isAroll) {
    return { type: 'crossfade', duration: 0.4 };
  }

  // B-roll to A-roll = clean cut
  if (!prevClip.isAroll && currentClip.isAroll) {
    return { type: 'cut', duration: 0 };
  }

  // A-roll to B-roll = subtle crossfade
  if (prevClip.isAroll && !currentClip.isAroll) {
    return { type: 'crossfade', duration: 0.5 };
  }

  // Default: crossfade
  return { type: 'crossfade', duration: 0.5 };
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

    const { 
      clips, 
      audioUrl, 
      transition = 'crossfade', 
      captionStyle = 'bottom', 
      transitionDuration = 0.8, 
      introLogo, 
      outroLogo,
      backgroundMusic 
    } = await req.json() as StitchRequest;

    if (!clips || clips.length === 0) {
      throw new Error('No video clips provided');
    }

    console.log(`Starting enhanced Creatomate stitch with ${clips.length} clips, smart transitions: ${transition === 'smart'}`);

    const elements: any[] = [];
    let currentTime = 0;
    
    // Add intro logo if provided
    const introDuration = introLogo?.duration || 3;
    if (introLogo?.url) {
      elements.push({
        type: 'shape',
        shape: 'rectangle',
        time: 0,
        duration: introDuration,
        width: '100%',
        height: '100%',
        fill_color: '#000000'
      });
      
      const introAnimations: any[] = [];
      const animType = introLogo.animation || 'fade';
      
      if (animType === 'fade') {
        introAnimations.push(
          { type: 'fade', fade: 'in', duration: 0.8, easing: 'ease-out' },
          { type: 'fade', fade: 'out', start: introDuration - 0.8, duration: 0.8, easing: 'ease-in' }
        );
      } else if (animType === 'zoom') {
        introAnimations.push(
          { type: 'scale', start_scale: '80%', end_scale: '100%', duration: 1, easing: 'ease-out' },
          { type: 'fade', fade: 'in', duration: 0.5 },
          { type: 'fade', fade: 'out', start: introDuration - 0.5, duration: 0.5 }
        );
      } else if (animType === 'slide') {
        introAnimations.push(
          { type: 'slide', direction: 'up', duration: 0.8, easing: 'ease-out' },
          { type: 'fade', fade: 'out', start: introDuration - 0.5, duration: 0.5 }
        );
      }
      
      elements.push({
        type: 'image',
        source: introLogo.url,
        time: 0,
        duration: introDuration,
        fit: 'contain',
        width: '60%',
        height: '40%',
        x: '50%',
        y: '50%',
        x_alignment: '50%',
        y_alignment: '50%',
        animations: introAnimations
      });
      
      currentTime = introDuration;
    }

    clips.forEach((clip, index) => {
      const videoDuration = Math.min(clip.audioDuration || clip.duration || 5, 8);
      const prevClip = index > 0 ? clips[index - 1] : null;
      
      console.log(`Clip ${index + 1}: ${videoDuration}s, angle: ${clip.angle || 'default'}, montage: ${clip.isMontage}`);
      
      // Get transition based on mode
      let transitionConfig: { type: string; duration: number };
      
      if (transition === 'smart') {
        transitionConfig = getSmartTransition(prevClip, clip, index);
      } else if (index === 0 || transition === 'none') {
        transitionConfig = { type: 'none', duration: 0 };
      } else {
        transitionConfig = { type: transition, duration: Math.min(Math.max(transitionDuration, 0.3), 1.5) };
      }
      
      const getTransitionAnimations = () => {
        if (transitionConfig.type === 'none' || transitionConfig.type === 'cut') return [];
        
        switch (transitionConfig.type) {
          case 'fade':
            return [{
              type: 'fade',
              fade: 'in',
              duration: transitionConfig.duration,
              easing: 'ease-in-out'
            }];
          case 'slide':
            return [{
              type: 'slide',
              direction: index % 2 === 0 ? 'left' : 'right',
              duration: transitionConfig.duration,
              easing: 'ease-out'
            }];
          case 'zoom':
            return [{
              type: 'scale',
              start_scale: '120%',
              end_scale: '100%',
              duration: transitionConfig.duration,
              easing: 'ease-out'
            }, {
              type: 'fade',
              fade: 'in',
              duration: transitionConfig.duration * 0.5
            }];
          case 'crossfade':
            return [{
              type: 'fade',
              fade: 'in',
              duration: transitionConfig.duration,
              easing: 'linear'
            }];
          default:
            return [];
        }
      };
      
      // For crossfade, start this clip earlier to overlap
      const overlapTime = transitionConfig.type === 'crossfade' && index > 0 ? transitionConfig.duration * 0.5 : 0;
      const adjustedTime = Math.max(0, currentTime - overlapTime);
      
      // Add video element
      elements.push({
        type: 'video',
        source: clip.url,
        time: adjustedTime,
        duration: videoDuration + overlapTime,
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

    // Add outro logo if provided
    const outroDuration = outroLogo?.duration || 3;
    if (outroLogo?.url) {
      const outroStart = currentTime;
      
      elements.push({
        type: 'shape',
        shape: 'rectangle',
        time: outroStart,
        duration: outroDuration,
        width: '100%',
        height: '100%',
        fill_color: '#000000'
      });
      
      const outroAnimations: any[] = [];
      const animType = outroLogo.animation || 'fade';
      
      if (animType === 'fade') {
        outroAnimations.push(
          { type: 'fade', fade: 'in', duration: 0.8, easing: 'ease-out' },
          { type: 'fade', fade: 'out', start: outroDuration - 0.8, duration: 0.8, easing: 'ease-in' }
        );
      } else if (animType === 'zoom') {
        outroAnimations.push(
          { type: 'scale', start_scale: '80%', end_scale: '100%', duration: 1, easing: 'ease-out' },
          { type: 'fade', fade: 'in', duration: 0.5 },
          { type: 'fade', fade: 'out', start: outroDuration - 0.5, duration: 0.5 }
        );
      } else if (animType === 'slide') {
        outroAnimations.push(
          { type: 'slide', direction: 'down', duration: 0.8, easing: 'ease-out' },
          { type: 'fade', fade: 'out', start: outroDuration - 0.5, duration: 0.5 }
        );
      }
      
      elements.push({
        type: 'image',
        source: outroLogo.url,
        time: outroStart,
        duration: outroDuration,
        fit: 'contain',
        width: '60%',
        height: '40%',
        x: '50%',
        y: '50%',
        x_alignment: '50%',
        y_alignment: '50%',
        animations: outroAnimations
      });
      
      currentTime += outroDuration;
    }

    // Add background audio (voiceover)
    if (audioUrl) {
      elements.push({
        type: 'audio',
        source: audioUrl,
        time: introLogo?.url ? introDuration : 0,
        duration: currentTime - (introLogo?.url ? introDuration : 0) - (outroLogo?.url ? outroDuration : 0) - 2,
        volume: '100%',
        audio_fade_out: 0.5
      });
    }

    // Add background music if provided
    if (backgroundMusic?.url) {
      const musicVolume = Math.min(Math.max(backgroundMusic.volume || 30, 0), 100);
      const fadeIn = backgroundMusic.fadeIn || 1;
      const fadeOut = backgroundMusic.fadeOut || 2;
      
      elements.push({
        type: 'audio',
        source: backgroundMusic.url,
        time: 0,
        duration: currentTime,
        volume: `${musicVolume}%`,
        audio_fade_in: fadeIn,
        audio_fade_out: fadeOut
      });
    }

    const source = {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      frame_rate: 30,
      elements
    };

    console.log('Enhanced Creatomate source with', elements.length, 'elements');

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
