import React, { useMemo } from 'react';

export type CaptionStyle = 'boldPop' | 'hype' | 'cinematic' | 'subtitle' | 'minimal';
export type CaptionBackground = 'glass' | 'solid' | 'gradient' | 'outline' | 'neon';
export type CaptionPosition = 'bottom' | 'center' | 'top';
export type CaptionFontFamily = 'Montserrat' | 'Inter' | 'Poppins' | 'Oswald' | 'Bebas Neue';
export type CaptionFontSize = 'small' | 'medium' | 'large' | 'xl';

interface KaraokeCaptionProps {
  text: string;
  currentTime: number;
  duration: number;
  isIntro?: boolean;
  isOutro?: boolean;
  style?: CaptionStyle;
  background?: CaptionBackground;
  position?: CaptionPosition;
  fontFamily?: string;
  fontSize?: string;
  fontColor?: string;
  /**
   * Aspect ratio of the underlying video (width / height). When provided,
   * captions automatically scale up for vertical 9:16 reels and down for
   * landscape — matching TikTok / Reels conventions.
   */
  videoAspect?: number;
}

const FONT_SIZE_REM: Record<string, number> = {
  small: 0.95,
  medium: 1.25,
  large: 1.6,
  xl: 2.0,
};

// Helper — convert hex (#rrggbb) to "r, g, b" for rgba shadows
const hexToRgb = (hex: string): string => {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned.padEnd(6, 'f');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
  text,
  currentTime,
  duration,
  isIntro,
  isOutro,
  style = 'boldPop',
  background = 'glass',
  position = 'bottom',
  fontFamily = 'Montserrat',
  fontSize = 'medium',
  fontColor = '#ffffff',
  videoAspect,
}) => {
  const words = useMemo(() => (text || '').split(/\s+/).filter((w) => w.length > 0), [text]);

  const isStaticMode = duration <= 0.1;
  const progress = isStaticMode ? 1 : Math.min(currentTime / duration, 1);
  const currentWordIndex = isStaticMode ? words.length : Math.floor(progress * words.length);

  const totalChars = text.length;
  const visibleChars = Math.floor(progress * totalChars);

  // Auto-scale captions for portrait (reel) videos.
  // 9:16 → ~1.4x, 1:1 → ~1.15x, 16:9 → 1x.
  const aspectScale = useMemo(() => {
    if (!videoAspect || !isFinite(videoAspect)) return 1;
    if (videoAspect <= 0.75) return 1.4; // 9:16 and taller
    if (videoAspect <= 1.05) return 1.15; // square-ish
    return 1;
  }, [videoAspect]);

  const baseRem = FONT_SIZE_REM[fontSize as string] ?? FONT_SIZE_REM.medium;
  const finalFontSizeRem = baseRem * aspectScale;

  const rgb = hexToRgb(fontColor);
  const colorGlow = (intensity: number) => `0 0 ${intensity}px rgba(${rgb}, 0.85)`;
  const blackStroke = '0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 1px 1px 2px rgba(0,0,0,0.85)';

  // Background container — kept tight to text; never a fixed wide bar that clashes with color.
  const getContainerStyle = (): React.CSSProperties => {
    switch (background) {
      case 'solid':
        return { backgroundColor: 'rgba(0, 0, 0, 0.85)' };
      case 'gradient':
        return {
          background: 'linear-gradient(135deg, rgba(0,0,0,0.75), rgba(0,0,0,0.55))',
          backdropFilter: 'blur(6px)',
        };
      case 'outline':
        return { backgroundColor: 'transparent' };
      case 'neon':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          boxShadow: `0 0 22px rgba(${rgb}, 0.55), 0 0 44px rgba(${rgb}, 0.3)`,
        };
      case 'glass':
      default:
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        };
    }
  };

  const renderWord = (word: string, index: number) => {
    const isCurrent = !isStaticMode && index === currentWordIndex;
    const isPast = isStaticMode || index < currentWordIndex;

    const baseColor = fontColor;
    const dimColor = `rgba(${rgb}, 0.45)`;

    const sharedStyle: React.CSSProperties = {
      color: isCurrent ? baseColor : isPast ? baseColor : dimColor,
      textShadow: blackStroke,
      transition: 'transform 180ms ease-out, color 180ms ease-out, text-shadow 180ms ease-out',
      display: 'inline-block',
    };

    switch (style) {
      case 'hype': {
        // Big bouncy current word with a saturated glow + slight rotation
        const rotate = isCurrent ? (index % 2 === 0 ? -3 : 3) : 0;
        return (
          <span
            key={index}
            style={{
              ...sharedStyle,
              transform: isCurrent ? `scale(1.22) rotate(${rotate}deg) translateY(-2px)` : 'scale(1)',
              textShadow: isCurrent ? `${blackStroke}, ${colorGlow(18)}` : blackStroke,
              fontWeight: 900,
            }}
          >
            {word}
            {index < words.length - 1 && <span style={{ display: 'inline-block', width: '0.45em' }} />}
          </span>
        );
      }

      case 'cinematic': {
        // Letter-spacing reveal — past words are color, future are dim, current scales gently
        return (
          <span
            key={index}
            style={{
              ...sharedStyle,
              transform: isCurrent ? 'scale(1.06)' : 'scale(1)',
              letterSpacing: '0.02em',
              fontWeight: 700,
            }}
          >
            {word}
            {index < words.length - 1 && <span style={{ display: 'inline-block', width: '0.45em' }} />}
          </span>
        );
      }

      case 'subtitle': {
        // Clean Netflix-like — no per-word highlight; everything in the chosen color
        return (
          <span
            key={index}
            style={{
              ...sharedStyle,
              color: baseColor,
              fontWeight: 600,
            }}
          >
            {word}
            {index < words.length - 1 && <span style={{ display: 'inline-block', width: '0.35em' }} />}
          </span>
        );
      }

      case 'minimal': {
        // Subtle fade-in per word
        return (
          <span
            key={index}
            style={{
              ...sharedStyle,
              opacity: isPast || isCurrent ? 1 : 0.35,
              transform: isCurrent ? 'translateY(-1px)' : 'translateY(0)',
              fontWeight: 600,
            }}
          >
            {word}
            {index < words.length - 1 && <span style={{ display: 'inline-block', width: '0.35em' }} />}
          </span>
        );
      }

      case 'boldPop':
      default: {
        // TikTok-default: chunky black stroke, current word pops + glows in user's color
        return (
          <span
            key={index}
            style={{
              ...sharedStyle,
              transform: isCurrent ? 'scale(1.18) translateY(-2px)' : 'scale(1)',
              textShadow: isCurrent ? `${blackStroke}, ${colorGlow(14)}` : blackStroke,
              fontWeight: 800,
            }}
          >
            {word}
            {index < words.length - 1 && <span style={{ display: 'inline-block', width: '0.4em' }} />}
          </span>
        );
      }
    }
  };

  // Typewriter-ish reveal for `subtitle` is intentionally NOT used — subtitle stays static for clarity.
  // visibleChars kept around in case a future preset wants character-level reveal.
  void visibleChars;

  const isSpecial = isIntro || isOutro;

  return (
    <div
      className="rounded-2xl mx-auto inline-block"
      style={{
        ...getContainerStyle(),
        padding: `${0.4 * aspectScale}rem ${0.9 * aspectScale}rem`,
        maxWidth: '92%',
        // Outline background uses no background fill
        ...(background === 'outline'
          ? { border: `2px solid ${fontColor}`, boxShadow: `0 0 0 1px rgba(0,0,0,0.4)` }
          : {}),
      }}
    >
      <p
        className="text-center leading-tight"
        style={{
          fontFamily: `'${fontFamily}', system-ui, sans-serif`,
          fontSize: `${finalFontSizeRem * (isSpecial ? 1.1 : 1)}rem`,
          margin: 0,
          color: fontColor,
        }}
      >
        {words.map((word, index) => renderWord(word, index))}
      </p>
    </div>
  );
};

export interface CaptionSettings {
  style: CaptionStyle;
  background: CaptionBackground;
  position: CaptionPosition;
  enabled: boolean;
  fontFamily: CaptionFontFamily;
  fontSize: CaptionFontSize;
  fontColor: string;
}

export const defaultCaptionSettings: CaptionSettings = {
  style: 'boldPop',
  background: 'glass',
  position: 'bottom',
  enabled: true,
  fontFamily: 'Montserrat',
  fontSize: 'medium',
  fontColor: '#ffffff',
};
