import React from 'react';

interface KaraokeCaptionProps {
  text: string;
  currentTime: number;
  duration: number;
  isIntro?: boolean;
  isOutro?: boolean;
  animationStyle?: 'highlight' | 'bounce' | 'fade' | 'typewriter';
}

export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
  text,
  currentTime,
  duration,
  isIntro,
  isOutro,
  animationStyle = 'highlight'
}) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const currentWordIndex = Math.floor(progress * words.length);

  const getWordStyle = (index: number) => {
    const isCurrentWord = index === currentWordIndex;
    const isPastWord = index < currentWordIndex;
    const isFutureWord = index > currentWordIndex;

    switch (animationStyle) {
      case 'bounce':
        return {
          className: `inline-block transition-all duration-150 ${
            isCurrentWord 
              ? 'text-yellow-400 scale-125 animate-caption-bounce' 
              : isPastWord 
                ? 'text-white opacity-80' 
                : 'text-white/40'
          }`,
          style: {}
        };
      case 'fade':
        return {
          className: `inline-block transition-all duration-300 ${
            isPastWord || isCurrentWord
              ? 'text-white opacity-100 translate-y-0'
              : 'text-white/20 translate-y-1'
          }`,
          style: {}
        };
      case 'typewriter':
        return {
          className: `inline-block transition-opacity duration-100 ${
            isPastWord || isCurrentWord
              ? 'opacity-100'
              : 'opacity-0'
          }`,
          style: {}
        };
      case 'highlight':
      default:
        return {
          className: `inline-block transition-all duration-200 ${
            isCurrentWord 
              ? 'text-yellow-400 scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' 
              : isPastWord 
                ? 'text-white' 
                : 'text-white/50'
          }`,
          style: {}
        };
    }
  };

  return (
    <div className={`text-center px-4 py-3 rounded-lg backdrop-blur-sm ${
      isIntro || isOutro 
        ? 'bg-primary/90' 
        : 'bg-black/70'
    }`}>
      <p className={`font-bold leading-relaxed ${
        isIntro || isOutro ? 'text-lg' : 'text-sm'
      }`}>
        {words.map((word, index) => {
          const { className, style } = getWordStyle(index);
          return (
            <span key={index} className={className} style={style}>
              {word}
              {index < words.length - 1 && <span className="inline-block w-1.5" />}
            </span>
          );
        })}
      </p>
    </div>
  );
};
