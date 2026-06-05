import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Scissors, Zap, MessageSquare, Music, User, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CutSuggestion {
  time: number;
  type: 'pause' | 'filler' | 'scene_change' | 'beat' | 'breath' | 'jump_cut';
  confidence: number;
  reason: string;
}

interface SmartCutSuggestionsProps {
  suggestions: CutSuggestion[];
  duration: number;
  pixelsPerSecond: number;
  zoom: number;
  onApplyCut: (time: number) => void;
  onApplyAll: () => void;
  showLabels?: boolean;
}

/**
 * SmartCutSuggestions
 * -------------------
 * AI-powered cut suggestions overlaid on the timeline.
 * Analyzes audio/video to suggest optimal cut points:
 * - Pauses in speech
 * - Filler words (um, uh, like)
 * - Scene changes
 * - Beat hits (music)
 * - Natural breaths
 * - Jump-cut opportunities
 * 
 * Features:
 * - Visual markers on timeline
 * - Confidence indicators
 * - One-click apply
 * - Batch apply all
 * - Type-specific icons/colors
 */
export const SmartCutSuggestions: React.FC<SmartCutSuggestionsProps> = ({
  suggestions,
  duration,
  pixelsPerSecond,
  zoom,
  onApplyCut,
  onApplyAll,
  showLabels = true,
}) => {
  // Sort by confidence (highest first)
  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => b.confidence - a.confidence);
  }, [suggestions]);

  // Group by type for stats
  const stats = useMemo(() => {
    const grouped = suggestions.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return grouped;
  }, [suggestions]);

  const getTypeConfig = (type: CutSuggestion['type']) => {
    switch (type) {
      case 'pause':
        return {
          icon: MessageSquare,
          color: 'text-blue-500',
          bg: 'bg-blue-500/20',
          border: 'border-blue-500',
          label: 'Pause',
        };
      case 'filler':
        return {
          icon: Zap,
          color: 'text-yellow-500',
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500',
          label: 'Filler',
        };
      case 'scene_change':
        return {
          icon: Activity,
          color: 'text-purple-500',
          bg: 'bg-purple-500/20',
          border: 'border-purple-500',
          label: 'Scene',
        };
      case 'beat':
        return {
          icon: Music,
          color: 'text-pink-500',
          bg: 'bg-pink-500/20',
          border: 'border-pink-500',
          label: 'Beat',
        };
      case 'breath':
        return {
          icon: User,
          color: 'text-green-500',
          bg: 'bg-green-500/20',
          border: 'border-green-500',
          label: 'Breath',
        };
      case 'jump_cut':
        return {
          icon: Scissors,
          color: 'text-red-500',
          bg: 'bg-red-500/20',
          border: 'border-red-500',
          label: 'Jump',
        };
      default:
        return {
          icon: Scissors,
          color: 'text-gray-500',
          bg: 'bg-gray-500/20',
          border: 'border-gray-500',
          label: 'Cut',
        };
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  if (suggestions.length === 0) return null;

  return (
    <>
      {/* Stats header */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b border-border">
        <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          {suggestions.length} AI Cut Suggestions
        </span>
        
        {/* Type badges */}
        <div className="flex gap-1 ml-2">
          {Object.entries(stats).map(([type, count]) => {
            const config = getTypeConfig(type as CutSuggestion['type']);
            const Icon = config.icon;
            return (
              <Badge
                key={type}
                variant="outline"
                className={cn('text-[10px] h-5 gap-1', config.color)}
              >
                <Icon className="w-2.5 h-2.5" />
                {count}
              </Badge>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Apply all button */}
        <Button
          size="sm"
          variant="outline"
          onClick={onApplyAll}
          className="h-6 text-xs gap-1.5"
        >
          <Zap className="w-3 h-3" />
          Apply All ({suggestions.length})
        </Button>
      </div>

      {/* Timeline markers */}
      <div className="absolute inset-0 pointer-events-none">
        {suggestions.map((suggestion, index) => {
          const x = suggestion.time * pixelsPerSecond * zoom;
          const config = getTypeConfig(suggestion.type);
          const Icon = config.icon;

          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 bottom-0 pointer-events-auto cursor-pointer group"
                  style={{
                    left: `${x}px`,
                    transform: 'translateX(-50%)',
                    width: '20px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyCut(suggestion.time);
                  }}
                >
                  {/* Vertical guide line */}
                  <div
                    className={cn(
                      'absolute top-0 bottom-0 w-px left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 transition-opacity',
                      config.border.replace('border-', 'bg-')
                    )}
                  />

                  {/* Marker icon */}
                  <div
                    className={cn(
                      'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                      'rounded-full p-1.5 border-2 shadow-lg',
                      'opacity-80 group-hover:opacity-100 group-hover:scale-110',
                      'transition-all duration-150',
                      config.bg,
                      config.border,
                      config.color
                    )}
                  >
                    <Icon className="w-3 h-3" />
                  </div>

                  {/* Confidence indicator (as ring around icon) */}
                  <svg
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    width="32"
                    height="32"
                  >
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${suggestion.confidence * 88} 88`}
                      className={cn('opacity-30', config.color)}
                      transform="rotate(-90 16 16)"
                    />
                  </svg>

                  {/* Label (only visible when zoomed in enough) */}
                  {showLabels && zoom > 2 && (
                    <div
                      className={cn(
                        'absolute top-full left-1/2 -translate-x-1/2 mt-1',
                        'px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap',
                        'opacity-0 group-hover:opacity-100 transition-opacity',
                        config.bg,
                        config.color
                      )}
                    >
                      {config.label}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {config.label} at {formatTime(suggestion.time)}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {suggestion.reason}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Confidence: {Math.round(suggestion.confidence * 100)}%
                  </div>
                  <div className="text-[10px] font-medium text-primary pt-1 border-t border-border">
                    Click to cut here
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </>
  );
};

/**
 * generateSmartCutSuggestions
 * ---------------------------
 * Analyze audio/video and generate cut suggestions.
 * This is a placeholder - you'd integrate with actual audio analysis.
 */
export const generateSmartCutSuggestions = async (
  audioUrl: string,
  duration: number
): Promise<CutSuggestion[]> => {
  // TODO: Integrate with actual audio analysis
  // For now, return mock suggestions based on duration
  
  const suggestions: CutSuggestion[] = [];
  const pauseInterval = duration / 10; // Mock: suggest cuts every ~10% of duration

  for (let i = 1; i < 10; i++) {
    const time = pauseInterval * i + (Math.random() - 0.5) * 2;
    if (time > 0 && time < duration) {
      suggestions.push({
        time,
        type: ['pause', 'filler', 'breath', 'jump_cut'][Math.floor(Math.random() * 4)] as CutSuggestion['type'],
        confidence: 0.6 + Math.random() * 0.4,
        reason: 'Detected natural pause in speech',
      });
    }
  }

  return suggestions.sort((a, b) => a.time - b.time);
};
