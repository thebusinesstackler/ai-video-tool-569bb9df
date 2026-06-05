import React from 'react';
import { cn } from '@/lib/utils';

interface TimelineRulerProps {
  duration: number;
  zoom: number;
  pixelsPerSecond: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

/**
 * TimelineRuler
 * -------------
 * Professional timeline ruler with second/frame markings.
 * Shows time intervals that adapt to zoom level.
 * 
 * Features:
 * - Dynamic tick intervals based on zoom
 * - Major and minor tick marks
 * - Time labels (MM:SS or MM:SS:FF)
 * - Click to seek
 * - Playhead indicator
 */
export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  duration,
  zoom,
  pixelsPerSecond,
  currentTime = 0,
  onSeek,
}) => {
  const formatTime = (seconds: number, showFrames: boolean = false): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    
    if (showFrames) {
      const frames = Math.floor((seconds % 1) * 30); // Assume 30fps
      return `${m}:${s.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    }
    
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Determine tick interval based on zoom level
  const getTickInterval = () => {
    const pixelWidth = duration * pixelsPerSecond * zoom;
    const idealTickSpacing = 80; // pixels between major ticks
    const secondsPerTick = idealTickSpacing / (pixelsPerSecond * zoom);

    // Round to nice intervals
    if (secondsPerTick < 0.1) return 0.1;
    if (secondsPerTick < 0.25) return 0.25;
    if (secondsPerTick < 0.5) return 0.5;
    if (secondsPerTick < 1) return 1;
    if (secondsPerTick < 2) return 2;
    if (secondsPerTick < 5) return 5;
    if (secondsPerTick < 10) return 10;
    if (secondsPerTick < 15) return 15;
    if (secondsPerTick < 30) return 30;
    return 60;
  };

  const majorInterval = getTickInterval();
  const minorInterval = majorInterval / 4;
  const showFrames = zoom > 5; // Show frames when zoomed in enough

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / (pixelsPerSecond * zoom);
    
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  // Generate tick marks
  const ticks: { time: number; isMajor: boolean }[] = [];
  let time = 0;
  
  while (time <= duration) {
    const isMajor = Math.abs(time % majorInterval) < 0.001;
    ticks.push({ time, isMajor });
    time += minorInterval;
  }

  return (
    <div
      className={cn(
        'relative h-8 bg-muted/30 border-b border-border',
        onSeek && 'cursor-pointer'
      )}
      onClick={handleClick}
    >
      {/* Tick marks and labels */}
      {ticks.map(({ time, isMajor }, index) => {
        const x = time * pixelsPerSecond * zoom;
        
        return (
          <div
            key={index}
            className="absolute top-0"
            style={{ left: `${x}px` }}
          >
            {/* Tick mark */}
            <div
              className={cn(
                'absolute top-0 bg-border',
                isMajor ? 'h-4 w-px' : 'h-2 w-px opacity-50'
              )}
            />
            
            {/* Time label (major ticks only) */}
            {isMajor && (
              <div
                className="absolute top-4 -translate-x-1/2 text-[10px] font-mono text-muted-foreground whitespace-nowrap"
                style={{ left: 0 }}
              >
                {formatTime(time, showFrames)}
              </div>
            )}
          </div>
        );
      })}

      {/* Playhead indicator */}
      {currentTime >= 0 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
          style={{ left: `${currentTime * pixelsPerSecond * zoom}px` }}
        >
          {/* Playhead triangle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-red-500" />
        </div>
      )}

      {/* Click hint overlay */}
      {onSeek && (
        <div className="absolute inset-0 hover:bg-primary/5 transition-colors pointer-events-none" />
      )}
    </div>
  );
};
