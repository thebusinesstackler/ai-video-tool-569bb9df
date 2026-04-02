import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VideoClip {
  url: string;
  duration: number;
  caption?: string;
  audioDuration?: number;
}

interface StitchRequest {
  clips: VideoClip[];
  audioUrl?: string;
  backgroundMusicUrl?: string;
  backgroundMusicVolume?: number;
  transition?: 'fade' | 'slide' | 'zoom' | 'crossfade' | 'wipe' | 'blur' | 'dissolve' | 'spin' | 'flip' | 'none';
  captionStyle?: 'bottom' | 'center' | 'top';
  transitionDuration?: number;
  // Dynamic resolution
  width?: number;
  height?: number;
  // Caption customization
  captionFont?: string;
  captionFontSize?: 'small' | 'medium' | 'large' | 'xl';
  captionFontColor?: string;
  captionBackground?: 'glass' | 'solid' | 'gradient' | 'outline' | 'neon';
  captionAnimation?: string;
  // Logo overlay
  logoUrl?: string;
  logoAnimation?: 'fade' | 'zoom' | 'bounce' | 'glitch' | 'rotate' | 'scale-fade';
}

const FONT_SIZE_MAP: Record<string, string> = {
  small: '4 vmin',
  medium: '5.5 vmin',
  large: '7 vmin',
  xl: '9 vmin',
};

function getCaptionBackgroundProps(bg: string): Record<string, string> {
  switch (bg) {
    case 'solid':
      return { background_color: 'rgba(0,0,0,0.9)' };
    case 'gradient':
      return { background_color: 'rgba(139,92,246,0.8)' };
    case 'outline':
      return { background_color: 'rgba(0,0,0,0)', stroke_color: '#ffffff', stroke_width: '0.5 vmin' };
    case 'neon':
      return { background_color: 'rgba(0,0,0,0.8)', shadow_color: 'rgba(139,92,246,0.6)', shadow_blur: '4 vmin' };
    case 'glass':
    default:
      return { background_color: 'rgba(0,0,0,0.5)' };
  }
}

function getLogoAnimations(animation: string, totalDuration: number): any[] {
  const logoDuration = Math.min(3, totalDuration);
  const logoStart = Math.max(0, totalDuration - logoDuration);
  
  switch (animation) {
    case 'fade':
      return [
        { type: 'fade', fade: 'in', duration: 0.8, easing: 'ease-in-out' },
      ];
    case 'zoom':
      return [
        { type: 'scale', start_scale: '0%', end_scale: '100%', duration: 0.6, easing: 'ease-out' },
        { type: 'fade', fade: 'in', duration: 0.3 },
      ];
    case 'bounce':
      return [
        { type: 'scale', start_scale: '0%', end_scale: '110%', duration: 0.4, easing: 'ease-out' },
        { type: 'scale', start_scale: '110%', end_scale: '100%', start: 0.4, duration: 0.2, easing: 'ease-in-out' },
        { type: 'fade', fade: 'in', duration: 0.2 },
      ];
    case 'glitch':
      return [
        { type: 'fade', fade: 'in', duration: 0.1 },
        { type: 'fade', fade: 'out', start: 0.1, duration: 0.05 },
        { type: 'fade', fade: 'in', start: 0.15, duration: 0.05 },
        { type: 'fade', fade: 'out', start: 0.2, duration: 0.05 },
        { type: 'fade', fade: 'in', start: 0.25, duration: 0.1 },
        { type: 'scale', start_scale: '102%', end_scale: '100%', duration: 0.3, easing: 'linear' },
      ];
    case 'rotate':
      return [
        { type: 'spin', revolutions: 0.5, duration: 0.6, easing: 'ease-out' },
        { type: 'fade', fade: 'in', duration: 0.3 },
      ];
    case 'scale-fade':
      return [
        { type: 'scale', start_scale: '60%', end_scale: '100%', duration: 0.8, easing: 'ease-out' },
        { type: 'fade', fade: 'in', duration: 0.8, easing: 'ease-in-out' },
      ];
    default:
      return [{ type: 'fade', fade: 'in', duration: 0.5 }];
  }
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
      backgroundMusicUrl,
      backgroundMusicVolume = 25,
      transition = 'crossfade',
      captionStyle = 'bottom',
      transitionDuration = 0.8,
      width = 1080,
      height = 1920,
      captionFont = 'Montserrat',
      captionFontSize = 'medium',
      captionFontColor = '#ffffff',
      captionBackground = 'glass',
      logoUrl,
      logoAnimation = 'fade',
    } = await req.json() as StitchRequest;

    if (!clips || clips.length === 0) {
      throw new Error('No video clips provided');
    }

    console.log(`Starting Creatomate stitch: ${clips.length} clips, ${width}x${height}, audio: ${!!audioUrl}, font: ${captionFont}/${captionFontSize}/${captionFontColor}, bg: ${captionBackground}`);

    const elements: any[] = [];
    let currentTime = 0;

    clips.forEach((clip, index) => {
      const videoDuration = clip.audioDuration || clip.duration || 5;
      console.log(`Clip ${index + 1}: duration ${videoDuration}s`);

      const getTransitionAnimations = () => {
        if (index === 0 || transition === 'none') return [];
        const duration = Math.min(Math.max(transitionDuration, 0.3), 1.5);
        switch (transition) {
          case 'fade':
            return [{ type: 'fade', fade: 'in', duration, easing: 'ease-in-out' }];
          case 'slide':
            return [{ type: 'slide', direction: index % 2 === 0 ? 'left' : 'right', duration, easing: 'ease-out' }];
          case 'zoom':
            return [
              { type: 'scale', start_scale: '120%', end_scale: '100%', duration, easing: 'ease-out' },
              { type: 'fade', fade: 'in', duration: duration * 0.5 },
            ];
          case 'crossfade':
            return [{ type: 'fade', fade: 'in', duration, easing: 'linear' }];
          case 'wipe':
            return [{ type: 'wipe', direction: index % 2 === 0 ? 'right' : 'down', duration, easing: 'ease-in-out' }];
          case 'blur':
            return [{ type: 'fade', fade: 'in', duration, easing: 'ease-in-out' }];
          case 'dissolve':
            return [{ type: 'fade', fade: 'in', duration: duration * 1.2, easing: 'ease-in-out' }];
          case 'spin':
            return [
              { type: 'spin', revolutions: 0.25, duration, easing: 'ease-out' },
              { type: 'fade', fade: 'in', duration: duration * 0.5 },
            ];
          case 'flip':
            return [
              { type: 'spin', revolutions: 0.5, duration, easing: 'ease-in-out' },
              { type: 'fade', fade: 'in', duration: duration * 0.3 },
            ];
          default:
            return [];
        }
      };

      const overlapTime = transition === 'crossfade' && index > 0 ? Math.min(transitionDuration * 0.15, 0.3) : 0;
      const adjustedTime = Math.max(0, currentTime - overlapTime);

      elements.push({
        type: 'video',
        source: clip.url,
        time: adjustedTime,
        duration: videoDuration,
        fit: 'cover',
        animations: getTransitionAnimations(),
      });

      // Add caption text overlay if provided — using user's font/color/background
      if (clip.caption) {
        const yPosition = captionStyle === 'bottom' ? '85%' : captionStyle === 'top' ? '15%' : '50%';
        const resolvedFontSize = FONT_SIZE_MAP[captionFontSize] || '5.5 vmin';
        const bgProps = getCaptionBackgroundProps(captionBackground);

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
          font_family: captionFont,
          font_weight: '700',
          font_size: resolvedFontSize,
          fill_color: captionFontColor,
          stroke_color: bgProps.stroke_color || '#000000',
          stroke_width: bgProps.stroke_width || '0.4 vmin',
          shadow_color: bgProps.shadow_color || 'rgba(0,0,0,0.5)',
          shadow_blur: bgProps.shadow_blur || '2 vmin',
          background_color: bgProps.background_color,
          text_align: 'center',
          animations: [
            { type: 'fade', fade: 'in', duration: 0.3 },
            { type: 'fade', fade: 'out', start: videoDuration - 0.3, duration: 0.3 },
          ],
        });
      }

      currentTime += videoDuration;
    });

    // Add background audio if provided
    if (audioUrl) {
      elements.push({
        type: 'audio',
        source: audioUrl,
        time: 0,
        duration: currentTime,
        volume: '100%',
        audio_fade_out: 0.5,
      });
    }

    // Add logo overlay if provided
    if (logoUrl) {
      const logoDuration = Math.min(3, currentTime);
      const logoStart = Math.max(0, currentTime - logoDuration);
      const logoAnims = getLogoAnimations(logoAnimation, currentTime);

      elements.push({
        type: 'image',
        source: logoUrl,
        time: logoStart,
        duration: logoDuration,
        width: '25%',
        height: '15%',
        x: '50%',
        y: '50%',
        x_alignment: '50%',
        y_alignment: '50%',
        fit: 'contain',
        animations: [
          ...logoAnims,
          { type: 'fade', fade: 'out', start: logoDuration - 0.3, duration: 0.3 },
        ],
      });

      console.log(`Logo overlay added: ${logoAnimation} animation, ${logoDuration}s at end`);
    }

    const source = {
      output_format: 'mp4',
      width,
      height,
      frame_rate: 30,
      render_scale: 1,
      elements,
    };

    console.log('Creatomate source:', JSON.stringify(source, null, 2));

    const response = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
