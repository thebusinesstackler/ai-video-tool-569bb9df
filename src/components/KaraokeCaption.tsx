import React, { useMemo } from 'react';

export type CaptionStyle = 'karaoke' | 'wordPop' | 'typewriter' | 'spotlight' | 'wave';
export type CaptionBackground = 'glass' | 'solid' | 'gradient' | 'outline' | 'neon';
export type CaptionPosition = 'bottom' | 'center' | 'top';

interface KaraokeCaptionProps {
  text: string;
  currentTime: number;
  duration: number;
  isIntro?: boolean;
  isOutro?: boolean;
  style?: CaptionStyle;
  background?: CaptionBackground;
  position?: CaptionPosition;
}

export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
  text,
  currentTime,
  duration,
  isIntro,
  isOutro,
  style = 'karaoke',
  background = 'glass',
  position = 'bottom'
}) => {
  const words = useMemo(() => text.split(/\s+/).filter(w => w.length > 0), [text]);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  
  // Calculate which word should be visible based on progress
  const currentWordIndex = Math.floor(progress * words.length);
  const wordProgress = (progress * words.length) % 1;

  // For typewriter, calculate how many characters should be visible
  const totalChars = text.length;
  const visibleChars = Math.floor(progress * totalChars);

  // Get background classes based on selected style
  const getBackgroundClasses = () => {
    const baseClasses = 'px-4 py-3 rounded-xl';
    
    switch (background) {
      case 'solid':
        return `${baseClasses} bg-black/90`;
      case 'gradient':
        return `${baseClasses} bg-gradient-to-r from-primary/90 via-primary/80 to-secondary/90`;
      case 'outline':
        return `${baseClasses} bg-transparent border-2 border-white/80`;
      case 'neon':
        return `${baseClasses} bg-black/80 shadow-[0_0_20px_rgba(139,92,246,0.5),0_0_40px_rgba(139,92,246,0.3)]`;
      case 'glass':
      default:
        return `${baseClasses} bg-black/60 backdrop-blur-md`;
    }
  };

  // Render word with appropriate style
  const renderWord = (word: string, index: number) => {
    const isCurrentWord = index === currentWordIndex;
    const isPastWord = index < currentWordIndex;
    const isFutureWord = index > currentWordIndex;

    switch (style) {
      case 'wordPop':
        // Word pops in when it's current, scales up and has glow
        return (
          <span
            key={index}
            className={`inline-block transition-all duration-200 ${
              isCurrentWord
                ? 'text-yellow-300 scale-125 animate-bounce drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]'
                : isPastWord
                  ? 'text-white scale-100'
                  : 'text-white/0 scale-75'
            }`}
            style={{
              transform: isCurrentWord ? 'translateY(-4px)' : 'translateY(0)',
            }}
          >
            {word}
            {index < words.length - 1 && <span className="inline-block w-2" />}
          </span>
        );

      case 'spotlight':
        // Only current and nearby words visible, rest faded
        const distanceFromCurrent = Math.abs(index - currentWordIndex);
        const opacity = distanceFromCurrent === 0 ? 1 : distanceFromCurrent === 1 ? 0.6 : distanceFromCurrent === 2 ? 0.3 : 0.1;
        return (
          <span
            key={index}
            className={`inline-block transition-all duration-300 ${
              isCurrentWord ? 'text-white font-bold scale-110' : 'text-white'
            }`}
            style={{ opacity }}
          >
            {word}
            {index < words.length - 1 && <span className="inline-block w-2" />}
          </span>
        );

      case 'wave':
        // Words wave up as they're spoken
        const waveOffset = isCurrentWord ? -8 : isPastWord ? 0 : 8;
        return (
          <span
            key={index}
            className={`inline-block transition-all duration-300 ease-out ${
              isCurrentWord
                ? 'text-cyan-300 font-bold'
                : isPastWord
                  ? 'text-white'
                  : 'text-white/40'
            }`}
            style={{
              transform: `translateY(${waveOffset}px)`,
            }}
          >
            {word}
            {index < words.length - 1 && <span className="inline-block w-2" />}
          </span>
        );

      case 'typewriter':
        // Text appears character by character
        let charCount = 0;
        for (let i = 0; i < index; i++) {
          charCount += words[i].length + 1; // +1 for space
        }
        const wordStart = charCount;
        const wordEnd = charCount + word.length;
        
        return (
          <span
            key={index}
            className="inline-block text-white"
          >
            {word.split('').map((char, charIndex) => {
              const charPosition = wordStart + charIndex;
              const isVisible = charPosition < visibleChars;
              return (
                <span
                  key={charIndex}
                  className={`transition-opacity duration-75 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    textShadow: charPosition === visibleChars - 1 ? '0 0 10px currentColor' : 'none'
                  }}
                >
                  {char}
                </span>
              );
            })}
            {index < words.length - 1 && <span className="inline-block w-2" />}
          </span>
        );

      case 'karaoke':
      default:
        // Classic karaoke: highlight current word, past words white, future dimmed
        return (
          <span
            key={index}
            className={`inline-block transition-all duration-200 ${
              isCurrentWord
                ? 'text-yellow-400 scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                : isPastWord
                  ? 'text-white'
                  : 'text-white/50'
            }`}
          >
            {word}
            {index < words.length - 1 && <span className="inline-block w-2" />}
          </span>
        );
    }
  };

  // Special styling for intro/outro
  const isSpecialScene = isIntro || isOutro;

  return (
    <div className={`text-center ${getBackgroundClasses()}`}>
      <p className={`font-bold leading-relaxed ${
        isSpecialScene ? 'text-lg' : 'text-base'
      }`}>
        {words.map((word, index) => renderWord(word, index))}
      </p>
    </div>
  );
};

// Caption settings component for the UI
export interface CaptionSettings {
  style: CaptionStyle;
  background: CaptionBackground;
  position: CaptionPosition;
  enabled: boolean;
}

export const defaultCaptionSettings: CaptionSettings = {
  style: 'karaoke',
  background: 'glass',
  position: 'bottom',
  enabled: true
};