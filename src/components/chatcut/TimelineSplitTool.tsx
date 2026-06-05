import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Scissors, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineSplitToolProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  currentTime: number;
  onSplit: () => void;
}

/**
 * TimelineSplitTool
 * -----------------
 * Razor/split tool for cutting clips at the playhead.
 * 
 * Features:
 * - Toggle razor mode (C key)
 * - Visual indicator when active
 * - Click anywhere on timeline to split at playhead
 * - Shows current time for precision
 */
export const TimelineSplitTool: React.FC<TimelineSplitToolProps> = ({
  active,
  onToggle,
  currentTime,
  onSplit,
}) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(!active)}
            className={cn(
              'gap-2',
              active && 'bg-primary text-primary-foreground'
            )}
          >
            <Scissors className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">
              {active ? 'Razor Active' : 'Razor Tool'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Toggle Razor Tool (C)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click on timeline to split clips at playhead
          </p>
        </TooltipContent>
      </Tooltip>

      {active && (
        <>
          <Badge variant="secondary" className="font-mono text-xs">
            {formatTime(currentTime)}
          </Badge>

          <Button
            size="sm"
            variant="ghost"
            onClick={onSplit}
            className="gap-1.5"
          >
            <Check className="h-3 w-3" />
            <span className="text-xs">Split Now</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(false)}
            className="gap-1.5"
          >
            <X className="h-3 w-3" />
            <span className="text-xs">Cancel</span>
          </Button>
        </>
      )}
    </div>
  );
};
